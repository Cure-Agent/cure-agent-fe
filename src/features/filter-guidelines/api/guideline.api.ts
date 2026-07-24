'use client';

/** 지침 탐색 훅 (docs/specs/08) */
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/api-client';
import { unwrap, unwrapPage } from '@/shared/api/api-error';
import type { components } from '@/shared/api/generated/schema';

export type GuidelineSummary = components['schemas']['GuidelineSummaryResponseDto'];
export type GuidelineDetail = components['schemas']['GuidelineDetailResponseDto'];
export type EvidenceSummary = components['schemas']['EvidenceSummaryResponseDto'];

export interface PageInfo {
  size: number;
  hasNext: boolean;
  nextCursor: string | null;
}

export function useGuidelines(params: {
  query?: string;
  cursor?: string;
}): UseQueryResult<{ items: GuidelineSummary[]; page: PageInfo }> {
  return useQuery({
    queryKey: ['guidelines', { query: params.query ?? null, cursor: params.cursor ?? null }],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (params.query) query.query = params.query;
      if (params.cursor) query.cursor = params.cursor;
      const result = await api.GET('/api/v1/guidelines', { params: { query } });
      const { items, page } = unwrapPage<GuidelineSummary>(result);
      return { items, page };
    },
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

export function useGuidelineEvidence(
  guidelineId: string,
): UseQueryResult<{ items: EvidenceSummary[]; page: PageInfo }> {
  return useQuery({
    queryKey: ['guidelines', guidelineId, 'evidence'],
    queryFn: async () => {
      const result = await api.GET('/api/v1/guidelines/{guidelineId}/evidence', {
        params: { path: { guidelineId } },
      });
      const { items, page } = unwrapPage<EvidenceSummary>(result);
      return { items, page };
    },
  });
}
