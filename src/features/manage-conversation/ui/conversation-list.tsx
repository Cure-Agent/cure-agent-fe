'use client';

/**
 * 어시스턴트 좌측 대화 목록 (docs/specs/08 기준 5 + docs/specs/11 개정 기준 6~9).
 * 검색·이름 변경·보관을 이 목록에 통합한다 — 전용 /history 화면은 폐지됨.
 */
import { FormEvent, useMemo, useState } from 'react';
import { useInfiniteListScroll } from '@/shared/lib/use-infinite-list-scroll';
import {
  type ConversationSummary,
  useArchiveConversation,
  useConversations,
  useCreateConversation,
  useRenameConversation,
} from '../api/conversation.api';

type IconProps = { className?: string };

function iconSvg(children: React.ReactNode) {
  return function Icon({ className }: IconProps): React.ReactElement {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
      >
        {children}
      </svg>
    );
  };
}

const PencilIcon = iconSvg(
  <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />,
);

const ArchiveIcon = iconSvg(
  <>
    <rect x="2" y="3" width="20" height="5" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </>,
);

export interface ConversationListProps {
  selectedId: string | null;
  onSelect: (conversation: ConversationSummary) => void;
}

export function ConversationList({
  selectedId,
  onSelect,
}: ConversationListProps): React.ReactElement {
  const [searchInput, setSearchInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState<string | undefined>(undefined);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState('');

  const conversations = useConversations({ query: submittedQuery });
  const createConversation = useCreateConversation();
  const renameConversation = useRenameConversation(renamingId);
  const archiveConversation = useArchiveConversation(selectedId);

  const items = useMemo(
    () => (conversations.data?.pages ?? []).flatMap((page) => page.items),
    [conversations.data],
  );
  const listScroll = useInfiniteListScroll({
    hasNext: conversations.hasNextPage ?? false,
    isFetching: conversations.isFetchingNextPage,
    fetchNext: () => void conversations.fetchNextPage(),
    itemCount: items.length,
  });

  const handleCreate = async (): Promise<void> => {
    const created = await createConversation.mutateAsync();
    setRenamingId(null);
    onSelect(created);
  };

  const handleSearch = (event: FormEvent): void => {
    event.preventDefault();
    setSubmittedQuery(searchInput.trim() || undefined);
  };

  const handleSelect = (conversation: ConversationSummary): void => {
    setRenamingId(null);
    onSelect(conversation);
  };

  const startRename = (conversation: ConversationSummary): void => {
    setTitleInput(conversation.title);
    setRenamingId(conversation.id);
  };

  const handleRenameSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const title = titleInput.trim();
    if (!title || renameConversation.isPending) return;
    renameConversation.mutate(
      { title },
      { onSuccess: () => setRenamingId(null) },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <button
        type="button"
        onClick={handleCreate}
        disabled={createConversation.isPending}
        className="mb-3 shrink-0 rounded-lg bg-emerald-700 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        새 대화
      </button>

      <form onSubmit={handleSearch} className="mb-3 flex shrink-0 gap-2">
        <input
          aria-label="대화 검색"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="제목으로 검색"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          검색
        </button>
      </form>

      {conversations.isPending && <p className="text-sm text-gray-400">불러오는 중…</p>}
      {conversations.isError && <p className="text-sm text-red-500">목록을 불러오지 못했습니다</p>}

      <div
        ref={listScroll.containerRef}
        onScroll={listScroll.handleScroll}
        className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto"
      >
        <ul className="space-y-1">
          {items.map((conversation) => {
            const isSelected = selectedId === conversation.id;
            return (
              <li key={conversation.id}>
                {renamingId === conversation.id ? (
                  <form
                    onSubmit={handleRenameSubmit}
                    className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2"
                  >
                    <label
                      htmlFor="conversation-rename-title"
                      className="text-xs font-medium text-gray-500"
                    >
                      대화 제목
                    </label>
                    <input
                      id="conversation-rename-title"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                    <div className="mt-2 flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        disabled={renameConversation.isPending}
                        className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        저장
                      </button>
                    </div>
                  </form>
                ) : (
                  <div
                    className={`flex items-center rounded-lg ${
                      isSelected ? 'bg-emerald-50' : 'hover:bg-gray-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(conversation)}
                      className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-sm ${
                        isSelected ? 'font-medium text-emerald-800' : 'text-gray-700'
                      }`}
                    >
                      {conversation.title}
                      {conversation.status === 'ARCHIVED' && (
                        <span className="ml-1.5 text-xs text-gray-400">(보관됨)</span>
                      )}
                    </button>
                    {isSelected && (
                      <div className="flex shrink-0 items-center gap-0.5 pr-1.5">
                        <button
                          type="button"
                          onClick={() => startRename(conversation)}
                          aria-label="이름 변경"
                          title="이름 변경"
                          className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-100"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                        {conversation.status !== 'ARCHIVED' && (
                          <button
                            type="button"
                            onClick={() => archiveConversation.mutate()}
                            disabled={archiveConversation.isPending}
                            aria-label="보관"
                            title="보관"
                            className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <ArchiveIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {/* 하단 sentinel — 보이면 다음 페이지를 당긴다 (무한 스크롤) */}
        <div ref={listScroll.bottomSentinelRef} aria-hidden="true" />
        {conversations.isFetchingNextPage && (
          <p className="py-2 text-center text-xs text-gray-400">불러오는 중…</p>
        )}
      </div>
    </div>
  );
}
