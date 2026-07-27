import { PATIENT_SUMMARIES, PatientDetailPanel } from 'cure-agent-fe';

/**
 * 환자 상세 — 헤더(요약·액션), 진단/복용약/알레르기 정의 목록, 프로필 수정 폼이 한 화면에 있다.
 * 헤더의 "임상 참고 대화 시작"은 RequestGuidanceButton 이며, 보관된 환자에서는 사라진다.
 */
export const Default = () => (
  <div className="w-[760px] max-w-full">
    <PatientDetailPanel patientId={PATIENT_SUMMARIES[0].id} />
  </div>
);
