import { PATIENT_SUMMARIES, PatientDetailPanel } from 'cure-agent-fe';

/**
 * 환자 상세 — 헤더(요약·액션) 아래 프로필 수정 폼 하나가 전부다. 신장·체중·진단·복용약·
 * 알레르기·임상 메모가 모두 이 폼의 칸이며, 보관된 환자에서는 전부 비활성(열람 전용)이 된다.
 * 헤더의 "임상 참고 대화 시작"은 RequestGuidanceButton 이며, 보관된 환자에서는 사라진다.
 */
export const Default = () => (
  <div className="w-[760px] max-w-full">
    <PatientDetailPanel patientId={PATIENT_SUMMARIES[0].id} />
  </div>
);
