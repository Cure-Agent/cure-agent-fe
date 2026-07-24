'use client';

/** 임상 가이던스 검토 (docs/specs/10 기준 11·12) */
import type { components } from '@/shared/api/generated/schema';

export type ClinicalGuidance = components['schemas']['ClinicalGuidanceResponseDto'];
export type ReviewDecision = components['schemas']['ReviewClinicalGuidanceRequestDto']['decision'];

export interface ReviewClinicalGuidanceInput {
  decision: ReviewDecision;
  note?: string;
}

export function useReviewClinicalGuidance(): never {
  throw new Error('NOT_IMPLEMENTED');
}
