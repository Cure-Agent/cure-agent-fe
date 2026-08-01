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
}): UseInfiniteQueryResult<InfiniteData<GuidelinePage>> {
  return useInfiniteQuery({
    queryKey: ['guidelines', { query: params.query ?? null }],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const query: Record<string, string> = {};
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

export function useEvidenceDetail(
  evidenceId: string,
  options?: { enabled?: boolean },
): UseQueryResult<EvidenceDetail> {
  return useQuery({
    queryKey: ['evidence', evidenceId],
    enabled: options?.enabled ?? true,
    queryFn: async () =>
      unwrap<EvidenceDetail>(
        await api.GET('/api/v1/evidence/{evidenceId}', {
          params: { path: { evidenceId } },
        }),
      ),
  });
}
