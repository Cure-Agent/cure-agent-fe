'use client';

import {
  type ConversationSummary,
  useConversations,
  useCreateConversation,
} from '../api/conversation.api';

export interface ConversationListProps {
  selectedId: string | null;
  onSelect: (conversation: ConversationSummary) => void;
}

export function ConversationList({
  selectedId,
  onSelect,
}: ConversationListProps): React.ReactElement {
  const conversations = useConversations();
  const createConversation = useCreateConversation();

  const handleCreate = async (): Promise<void> => {
    const created = await createConversation.mutateAsync();
    onSelect(created);
  };

  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={handleCreate}
        disabled={createConversation.isPending}
        className="mb-3 rounded-lg bg-emerald-700 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        새 대화
      </button>

      {conversations.isPending && <p className="text-sm text-gray-400">불러오는 중…</p>}
      {conversations.isError && <p className="text-sm text-red-500">목록을 불러오지 못했습니다</p>}

      <ul className="flex-1 space-y-1 overflow-y-auto">
        {(conversations.data?.items ?? []).map((conversation) => (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() => onSelect(conversation)}
              className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm ${
                selectedId === conversation.id
                  ? 'bg-emerald-50 font-medium text-emerald-800'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {conversation.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
