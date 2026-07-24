'use client';

/** 임상 가이던스 검토 (docs/specs/10 기준 11·12) */
import { type UseMutationResult, useMutation } from '@tanstack/react-query';
import { api } from '@/shared/api/api-client';
import { unwrap } from '@/shared/api/api-error';
import type { components } from '@/shared/api/generated/schema';

export type ClinicalGuidance = components['schemas']['ClinicalGuidanceResponseDto'];
export type ReviewDecision = components['schemas']['ReviewClinicalGuidanceRequestDto']['decision'];

export interface ReviewClinicalGuidanceInput {
  decision: ReviewDecision;
  note?: string;
}

export function useReviewClinicalGuidance(
  guidanceId: string,
): UseMutationResult<ClinicalGuidance, Error, ReviewClinicalGuidanceInput> {
  return useMutation({
    mutationFn: async (input: ReviewClinicalGuidanceInput) => {
      const result = await api.POST('/api/v1/clinical-guidance/{guidanceId}/reviews', {
        params: { path: { guidanceId } },
        body: input,
      });
      return unwrap<ClinicalGuidance>(result);
    },
  });
}
