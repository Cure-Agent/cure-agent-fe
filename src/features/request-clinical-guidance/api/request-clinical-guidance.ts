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

export interface RequestGuidanceInput {
  patientId: string;
}

export function useRequestClinicalGuidance(): UseMutationResult<
  ConversationSummary,
  Error,
  RequestGuidanceInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ patientId }: RequestGuidanceInput) => {
      const result = await api.POST('/api/v1/conversations', {
        // 제목을 싣지 않는다 — BE가 케이스 라벨을 기본 제목으로 두고, 첫 질문이 수락되면
        // `<라벨> · <첫 질문>`으로 완성한다(BE docs/specs/56). 제목을 실으면 BE가 사람이
        // 지은 이름으로 굳혀 그 자동 제목이 영영 걸리지 않는다.
        body: { type: 'PATIENT_GUIDANCE', patientId },
      });
      return unwrap<ConversationSummary>(result);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}
