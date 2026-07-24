'use client';

export interface PatientDetailPanelProps {
  patientId: string;
}

/**
 * 상세 + 수정 폼('체중(kg)'·'임상 메모' 등, 제출 버튼 name='저장') — PATCH body에
 * 로드된 detail의 version 포함. 409 PATIENT_VERSION_CONFLICT 수신 시 role="alert"로
 * 충돌 안내(서버 message) 렌더. 보관 토글 버튼 name='보관'/'보관 해제'.
 */
export function PatientDetailPanel(_props: PatientDetailPanelProps): React.ReactElement {
  throw new Error('NOT_IMPLEMENTED');
}
