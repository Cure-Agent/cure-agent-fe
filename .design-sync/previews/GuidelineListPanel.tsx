import { GuidelineListPanel } from 'cure-agent-fe';

/**
 * 지침 목록 + 제목 검색. guidelines/page.tsx 의 화면 조립을 그대로 옮겼다.
 * 개정으로 대체된 지침은 status 가 SUPERSEDED 로 표시된다.
 */
export const GuidelinesScreen = () => (
  <section className="mx-auto w-[720px] max-w-full">
    <h1 className="mb-4 text-2xl font-bold text-gray-900">지침 탐색</h1>
    <GuidelineListPanel onSelect={() => undefined} />
  </section>
);
