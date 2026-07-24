'use client';

/** 환자 상세 → PATIENT_GUIDANCE 대화 시작 버튼 (docs/specs/10 기준 9) */
import type { ReactElement } from 'react';

export interface RequestGuidanceButtonProps {
  patientId: string;
  /** 생성된 대화 id로 이동 콜백 */
  onStarted: (conversationId: string) => void;
}

export function RequestGuidanceButton(_props: RequestGuidanceButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={() => {
        throw new Error('NOT_IMPLEMENTED');
      }}
    >
      임상 참고 대화 시작
    </button>
  );
}
