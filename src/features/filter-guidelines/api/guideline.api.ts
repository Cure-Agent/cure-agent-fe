'use client';

/** 지침 탐색 훅 (docs/specs/08) */
import type { UseQueryResult } from '@tanstack/react-query';
import type { components } from '@/shared/api/generated/schema';

export type GuidelineSummary = components['schemas']['GuidelineSummaryResponseDto'];
export type GuidelineDetail = components['schemas']['GuidelineDetailResponseDto'];
export type EvidenceSummary = components['schemas']['EvidenceSummaryResponseDto'];

export interface PageInfo {
  size: number;
  hasNext: boolean;
  nextCursor: string | null;
}

export function useGuidelines(_params: {
  query?: string;
  cursor?: string;
}): UseQueryResult<{ items: GuidelineSummary[]; page: PageInfo }> {
  throw new Error('NOT_IMPLEMENTED');
}

export function useGuideline(_guidelineId: string): UseQueryResult<GuidelineDetail> {
  throw new Error('NOT_IMPLEMENTED');
}

export function useGuidelineEvidence(
  _guidelineId: string,
): UseQueryResult<{ items: EvidenceSummary[]; page: PageInfo }> {
  throw new Error('NOT_IMPLEMENTED');
}
