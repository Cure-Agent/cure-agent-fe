'use client';

/** 임상 참고 대화 시작 (docs/specs/10 기준 9) */
import {
  type UseMutationResult,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { CONVERSATIONS_KEY } from '@/features/manage-conversation/api/conversation.api';
import { api } from '@/shared/api/api-client';
import { unwrap } from '@/shared/api/api-error';
import type { components } from '@/shared/api/generated/schema';

export type ConversationSummary = components['schemas']['ConversationSummaryResponseDto'];

export function useRequestClinicalGuidance(): UseMutationResult<
  ConversationSummary,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patientId: string) => {
      const result = await api.POST('/api/v1/conversations', {
        body: { type: 'PATIENT_GUIDANCE', patientId },
      });
      return unwrap<ConversationSummary>(result);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}
