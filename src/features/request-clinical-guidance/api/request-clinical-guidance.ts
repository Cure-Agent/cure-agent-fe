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
import { resolveUiLang } from '@/shared/i18n/ui-lang';
import { buildGuidanceTitle } from '../lib/guidance-title';

export type ConversationSummary = components['schemas']['ConversationSummaryResponseDto'];

export interface RequestGuidanceInput {
  patientId: string;
  /** 제목에 실을 케이스 라벨 — 목록에서 이 대화를 환자로 찾는 축이다 */
  caseLabel: string;
}

export function useRequestClinicalGuidance(): UseMutationResult<
  ConversationSummary,
  Error,
  RequestGuidanceInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ patientId, caseLabel }: RequestGuidanceInput) => {
      const result = await api.POST('/api/v1/conversations', {
        body: {
          type: 'PATIENT_GUIDANCE',
          patientId,
          // 표시 언어는 **호출 시점에** 읽는다 — 모듈 로드 시점에 굳히면 토글이 반영되지 않는다
          title: buildGuidanceTitle(caseLabel, resolveUiLang()),
        },
      });
      return unwrap<ConversationSummary>(result);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}
