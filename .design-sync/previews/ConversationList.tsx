import { ConversationList, CONVERSATIONS } from 'cure-agent-fe';

/**
 * 어시스턴트 좌측 대화 목록. assistant/page.tsx 와 같은 16rem 컬럼 + 카드 껍데기에 담는다.
 */
const Column = ({ children }: { children: React.ReactNode }) => (
  <div className="w-64 overflow-hidden rounded-xl border border-gray-200 bg-white p-3">
    {children}
  </div>
);

/** 아직 아무 대화도 고르지 않은 상태. */
export const NoSelection = () => (
  <Column>
    <ConversationList selectedId={null} onSelect={() => undefined} />
  </Column>
);

/** 선택된 대화가 emerald 로 강조된 상태. */
export const WithSelection = () => (
  <Column>
    <ConversationList selectedId={CONVERSATIONS[0].id} onSelect={() => undefined} />
  </Column>
);
