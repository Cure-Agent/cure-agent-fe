import { HistoryPanel } from 'cure-agent-fe';

/**
 * 대화 히스토리 2-pane 화면 전체. history/page.tsx 는 이 컴포넌트 하나만 렌더한다.
 * 우측 상세는 목록에서 대화를 골라야 채워지므로, 정적 카드에는 선택 전 안내 상태가 담긴다.
 */
export const TwoPane = () => (
  <div className="h-[640px] w-[1040px] max-w-full">
    <HistoryPanel />
  </div>
);
