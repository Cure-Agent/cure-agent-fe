'use client';

/** 환자 상세 → PATIENT_GUIDANCE 대화 시작 버튼 (docs/specs/10 기준 9) */
import type { ReactElement } from 'react';
import { useRequestClinicalGuidance } from '../api/request-clinical-guidance';

export interface RequestGuidanceButtonProps {
  patientId: string;
  /** 생성된 대화 id로 이동 콜백 — 미지정 시 /assistant?conversation={id}로 이동 */
  onStarted?: (conversationId: string) => void;
}

export function RequestGuidanceButton({
  patientId,
  onStarted,
}: RequestGuidanceButtonProps): ReactElement {
  const requestGuidance = useRequestClinicalGuidance();

  const handleClick = (): void => {
    if (requestGuidance.isPending) return;
    requestGuidance.mutate(patientId, {
      onSuccess: (conversation) => {
        if (onStarted) onStarted(conversation.id);
        else window.location.assign(`/assistant?conversation=${conversation.id}`);
      },
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={requestGuidance.isPending}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        임상 참고 대화 시작
      </button>
      {requestGuidance.isError && (
        <p className="mt-1 text-xs text-red-600">임상 참고 대화 생성에 실패했습니다.</p>
      )}
    </div>
  );
}
