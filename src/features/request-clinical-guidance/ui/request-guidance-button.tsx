'use client';

/** 환자 상세 → PATIENT_GUIDANCE 대화 시작 버튼 (docs/specs/10 기준 9) */
import type { ReactElement } from 'react';
import { completeTourStep, useTourHighlight } from '@/features/onboarding-tour/model/tour-state';
import { useRequestClinicalGuidance } from '../api/request-clinical-guidance';
import { messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';

export interface RequestGuidanceButtonProps {
  patientId: string;
  /** 대화 제목이 될 케이스 라벨 (예: CASE-001) */
  caseLabel: string;
  /** 생성된 대화 id로 이동 콜백 — 미지정 시 /assistant?conversation={id}로 이동 */
  onStarted?: (conversationId: string) => void;
}

export function RequestGuidanceButton({
  patientId,
  caseLabel,
  onStarted,
}: RequestGuidanceButtonProps): ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const requestGuidance = useRequestClinicalGuidance();
  const highlight = useTourHighlight('start-patient-conversation');

  const handleClick = (): void => {
    if (requestGuidance.isPending) return;
    requestGuidance.mutate(
      { patientId, caseLabel },
      {
        onSuccess: (conversation) => {
          /**
           * 이동보다 **먼저** 단계를 넘긴다 — 아래 `window.location.assign`은 페이지를 통째로
           * 다시 띄우므로 그 뒤의 코드는 실행되지 않는다. `completeTourStep`은 저장소에
           * 동기로 쓰므로, 새로 뜬 화면이 다음 단계(예시 질의문)부터 이어받는다.
           */
          completeTourStep('start-patient-conversation');
          if (onStarted) onStarted(conversation.id);
          else window.location.assign(`/assistant?conversation=${conversation.id}`);
        },
      },
    );
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={requestGuidance.isPending}
        className={`rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 ${highlight}`}
      >
        {t.startPatientConversation}
      </button>
      {requestGuidance.isError && (
        <p className="mt-1 text-xs text-red-600">{t.startPatientConversationFailed}</p>
      )}
    </div>
  );
}
