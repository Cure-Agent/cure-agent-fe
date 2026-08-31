'use client';

/** 지침 탐색 훅 (docs/specs/08) */
import {
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseQueryResult,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { api } from '@/shared/api/api-client';
import { unwrap, unwrapPage } from '@/shared/api/api-error';
import type { components } from '@/shared/api/generated/schema';
import type { UiLang } from '@/shared/i18n/ui-lang';

export type GuidelineSummary = components['schemas']['GuidelineSummaryResponseDto'];
export type GuidelineDetail = components['schemas']['GuidelineDetailResponseDto'];
export type EvidenceSummary = components['schemas']['EvidenceSummaryResponseDto'];
export type EvidenceDetail = components['schemas']['EvidenceDetailResponseDto'];

export interface PageInfo {
  size: number;
  hasNext: boolean;
  nextCursor: string | null;
}

type GuidelinePage = { items: GuidelineSummary[]; page: PageInfo };

export function useGuidelines(params: {
  query?: string;
  /** 목록 제목의 번역 언어 — 대화 맥락이 없는 탐색 화면이므로 UI 토글이 채운다 (§44) */
  lang: UiLang;
}): UseInfiniteQueryResult<InfiniteData<GuidelinePage>> {
  return useInfiniteQuery({
    // lang이 키에 없으면 언어를 바꿔도 이전 언어의 제목이 캐시에 남는다 (§44 기준 33과 같은 이유)
    queryKey: ['guidelines', { query: params.query ?? null, lang: params.lang }],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const query: Record<string, string> = { lang: params.lang };
      if (params.query) query.query = params.query;
      if (pageParam) query.cursor = pageParam;
      const result = await api.GET('/api/v1/guidelines', { params: { query } });
      const { items, page } = unwrapPage<GuidelineSummary>(result);
      return { items, page };
    },
    getNextPageParam: (lastPage) => (lastPage.page.hasNext ? lastPage.page.nextCursor : undefined),
  });
}

export function useGuideline(guidelineId: string): UseQueryResult<GuidelineDetail> {
  return useQuery({
    queryKey: ['guidelines', guidelineId],
    queryFn: async () =>
      unwrap<GuidelineDetail>(
        await api.GET('/api/v1/guidelines/{guidelineId}', {
          params: { path: { guidelineId } },
        }),
      ),
  });
}

type EvidencePage = { items: EvidenceSummary[]; page: PageInfo };

export function useGuidelineEvidence(
  guidelineId: string,
): UseInfiniteQueryResult<InfiniteData<EvidencePage>> {
  return useInfiniteQuery({
    queryKey: ['guidelines', guidelineId, 'evidence'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const result = await api.GET('/api/v1/guidelines/{guidelineId}/evidence', {
        params: {
          path: { guidelineId },
          query: pageParam ? { cursor: pageParam } : {},
        },
      });
      const { items, page } = unwrapPage<EvidenceSummary>(result);
      return { items, page };
    },
    getNextPageParam: (lastPage) => (lastPage.page.hasNext ? lastPage.page.nextCursor : undefined),
  });
}

/**
 * 근거 전문 — `lang`은 **선택이 아니라 필수**다 (BE docs/specs/44).
 *
 * 근거는 대화에 매이지 않은 코퍼스 리소스라 「저장된 언어」가 없다. 그래서 요청이 말해야 하고,
 * 안 넘기면 조용히 한국어가 되는 것이 이 결함의 구조적 원인이었다 — 호출자마다 언어를 정하게
 * 강제한다(채팅은 그 메시지의 `responseLang`, 지침 탐색기는 UI 토글).
 */
export function useEvidenceDetail(
  evidenceId: string,
  lang: UiLang,
  options?: { enabled?: boolean },
): UseQueryResult<EvidenceDetail> {
  return useQuery({
    // 키에 lang이 없으면 언어가 달라져도 이전 응답이 그대로 남는다 (§44 기준 33)
    queryKey: ['evidence', evidenceId, lang],
    enabled: options?.enabled ?? true,
    queryFn: async () =>
      unwrap<EvidenceDetail>(
        await api.GET('/api/v1/evidence/{evidenceId}', {
          params: { path: { evidenceId }, query: { lang } },
        }),
      ),
  });
}
