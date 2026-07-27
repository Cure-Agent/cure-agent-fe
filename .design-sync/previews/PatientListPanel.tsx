import { PatientListPanel } from 'cure-agent-fe';

/**
 * 환자 목록 + 케이스 라벨 검색. patients/page.tsx 의 max-w-3xl 본문 폭에 맞춘다.
 * 보관된 환자는 목록에 "보관됨" 배지로 남는다 (CASE-003).
 */
export const Default = () => (
  <div className="w-[720px] max-w-full">
    <PatientListPanel onSelect={() => undefined} />
  </div>
);
