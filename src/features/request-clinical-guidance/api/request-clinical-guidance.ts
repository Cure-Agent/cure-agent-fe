'use client';

/** 임상 참고 대화 시작 (docs/specs/10 기준 9) */
import type { components } from '@/shared/api/generated/schema';

export type ConversationSummary = components['schemas']['ConversationSummaryResponseDto'];

export interface RequestClinicalGuidanceInput {
  patientId: string;
}

export function useRequestClinicalGuidance(): never {
  throw new Error('NOT_IMPLEMENTED');
}
