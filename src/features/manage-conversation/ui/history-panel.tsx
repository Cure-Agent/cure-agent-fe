'use client';

/**
 * 대화 히스토리 2-pane (docs/specs/11 기준 6~9 — §5.7).
 * 좌: 목록(검색) / 우: 선택 대화 상세(메시지·이름 변경·보관).
 */
import { FormEvent, useMemo, useState, type ReactElement } from 'react';
import { useChatAutoScroll } from '@/shared/lib/use-chat-auto-scroll';
import { useInfiniteListScroll } from '@/shared/lib/use-infinite-list-scroll';
import {
  type ConversationSummary,
  type MessageDto,
  flatMessagesChronological,
  useArchiveConversation,
  useConversationHistory,
  useMessages,
  useRenameConversation,
} from '../api/conversation.api';

export function HistoryPanel(): ReactElement {
  const [searchInput, setSearchInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<ConversationSummary | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  const conversations = useConversationHistory({ query: submittedQuery });
  const messages = useMessages(selected?.id ?? null);
  const renameConversation = useRenameConversation(selected?.id ?? null);
  const archiveConversation = useArchiveConversation(selected?.id ?? null);

  const conversationItems = useMemo(
    () => (conversations.data?.pages ?? []).flatMap((page) => page.items),
    [conversations.data],
  );
  const listScroll = useInfiniteListScroll({
    hasNext: conversations.hasNextPage ?? false,
    isFetching: conversations.isFetchingNextPage,
    fetchNext: () => void conversations.fetchNextPage(),
    itemCount: conversationItems.length,
  });

  const messageItems = useMemo(() => flatMessagesChronological(messages.data), [messages.data]);
  const chatScroll = useChatAutoScroll({
    resetKey: selected?.id ?? null,
    itemCount: messageItems.length,
    hasOlder: messages.hasNextPage ?? false,
    isLoadingOlder: messages.isFetchingNextPage,
    loadOlder: () => void messages.fetchNextPage(),
  });

  const handleSearch = (event: FormEvent): void => {
    event.preventDefault();
    setSubmittedQuery(searchInput.trim() || undefined);
  };

  const handleSelect = (conversation: ConversationSummary): void => {
    setSelected(conversation);
    setIsRenaming(false);
  };

  const handleRenameSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const title = titleInput.trim();
    if (!title || renameConversation.isPending) return;
    renameConversation.mutate(
      { title },
      {
        onSuccess: (updated) => {
          setSelected(updated);
          setIsRenaming(false);
        },
      },
    );
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-[20rem_1fr] gap-4">
      <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-3">
        <form onSubmit={handleSearch} className="mb-3 flex gap-2">
          <input
            aria-label="대화 검색"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="제목으로 검색"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            검색
          </button>
        </form>

        <div
          ref={listScroll.containerRef}
          onScroll={listScroll.handleScroll}
          className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto"
        >
          <ul className="space-y-1">
            {conversationItems.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(conversation)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                    selected?.id === conversation.id ? 'bg-emerald-50 text-emerald-900' : 'text-gray-800'
                  }`}
                >
                  {conversation.title}
                  {conversation.status === 'ARCHIVED' && (
                    <span className="ml-1.5 text-xs text-gray-400">(보관됨)</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {/* 하단 sentinel — 보이면 다음 페이지를 당긴다 (무한 스크롤) */}
          <div ref={listScroll.bottomSentinelRef} aria-hidden="true" />
          {conversations.isFetchingNextPage && (
            <p className="py-2 text-center text-xs text-gray-400">불러오는 중…</p>
          )}
        </div>
      </div>

      {selected ? (
        <section className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
          <header className="flex items-center justify-between border-b border-gray-200 pb-3">
            <h2 className="text-lg font-semibold text-gray-900">{selected.title}</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTitleInput(selected.title);
                  setIsRenaming(true);
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                이름 변경
              </button>
              <button
                type="button"
                onClick={() => archiveConversation.mutate()}
                disabled={archiveConversation.isPending}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                보관
              </button>
            </div>
          </header>

          {isRenaming && (
            <form onSubmit={handleRenameSubmit} className="mt-3 flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="history-rename-title" className="text-xs font-medium text-gray-500">
                  대화 제목
                </label>
                <input
                  id="history-rename-title"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={renameConversation.isPending}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                저장
              </button>
            </form>
          )}

          <div
            ref={chatScroll.containerRef}
            onScroll={chatScroll.handleScroll}
            className="scrollbar-hidden mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto"
          >
            {/* 상단 sentinel — 최신부터 보여주고 위로 스크롤하면 과거를 당긴다 */}
            <div ref={chatScroll.topSentinelRef} aria-hidden="true" />
            {messages.isFetchingNextPage && (
              <p className="text-center text-xs text-gray-400">이전 대화를 불러오는 중…</p>
            )}
            {messageItems.map((message) => (
              <HistoryMessage key={message.id} message={message} />
            ))}
          </div>
        </section>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 text-sm text-gray-400">
          왼쪽에서 대화를 선택하세요
        </div>
      )}
    </div>
  );
}

function HistoryMessage({ message }: { message: MessageDto }): ReactElement {
  const isUser = message.role === 'USER';
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap rounded-xl p-3 text-sm ${
          isUser ? 'bg-emerald-700 text-white' : 'bg-gray-50 text-gray-800'
        }`}
      >
        {message.content}
      </p>
    </div>
  );
}
