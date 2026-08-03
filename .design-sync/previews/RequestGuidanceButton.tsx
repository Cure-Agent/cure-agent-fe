import { RequestGuidanceButton } from 'cure-agent-fe';

/** 환자 상세 헤더에서 PATIENT_GUIDANCE 대화를 시작하는 단일 액션. */
export const Default = () => (
  <RequestGuidanceButton
    patientId="pat_01HQ8ZP5C1"
    caseLabel="CASE-001"
    onStarted={() => undefined}
  />
);
