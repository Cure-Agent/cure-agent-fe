import { PatientCreateForm } from 'cure-agent-fe';

/**
 * 환자 등록 폼. patients/page.tsx 는 이 폼을 카드 안에 넣어 보여준다.
 * 케이스 라벨은 비식별 값이며, 진단·복용약·알레르기는 쉼표로 구분해 입력받는다.
 */
export const InCard = () => (
  <div className="w-[720px] max-w-full rounded-xl border border-gray-200 bg-white p-6">
    <PatientCreateForm onCreated={() => undefined} />
  </div>
);
