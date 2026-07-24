'use client';

import type { ConversationSummary } from '../api/conversation.api';

export interface ConversationListProps {
  selectedId: string | null;
  onSelect: (conversation: ConversationSummary) => void;
}

/** "새 대화" 버튼(name='새 대화') + 대화 항목 버튼(제목 텍스트) 목록 */
export function ConversationList(_props: ConversationListProps): React.ReactElement {
  throw new Error('NOT_IMPLEMENTED');
}
