'use client';

/**
 * 어시스턴트 좌측 대화 목록 (docs/specs/08 기준 5 + docs/specs/11 개정 기준 6~9).
 * 검색·이름 변경·보관을 이 목록에 통합한다 — 전용 /history 화면은 폐지됨.
 */
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteListScroll } from '@/shared/lib/use-infinite-list-scroll';
import {
  type ConversationSummary,
  useArchiveConversation,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useRenameConversation,
  useUnarchiveConversation,
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

const UnarchiveIcon = iconSvg(
  <>
    <rect x="2" y="3" width="20" height="5" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M12 17v-5" />
    <path d="m9.5 14.5 2.5-2.5 2.5 2.5" />
  </>,
);

const TrashIcon = iconSvg(
  <>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </>,
);

type StatusFilter = 'ALL' | 'ACTIVE' | 'ARCHIVED';

/**
 * 라벨 '보관됨' — 보관 액션 버튼(aria-label "보관")과 접근성 이름이 겹치면
 * 목록에 같은 이름의 버튼이 둘 생긴다.
 */
const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ACTIVE', label: '활성' },
  { value: 'ARCHIVED', label: '보관됨' },
  { value: 'ALL', label: '전체' },
];

export interface ConversationListProps {
  selectedId: string | null;
  onSelect: (conversation: ConversationSummary) => void;
  /** 선택 중인 대화가 삭제됐을 때 — 상위가 선택을 풀지 않으면 없는 대화의 채팅 화면이 남는다 */
  onDeleted: () => void;
}

export function ConversationList({
  selectedId,
  onSelect,
  onDeleted,
}: ConversationListProps): React.ReactElement {
  const [searchInput, setSearchInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState<string | undefined>(undefined);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState('');
  // 환자 목록과 달리 기본값이 '활성' — 대화는 찾아야 하는 대상이 아니라 치워야 하는 대상이다.
  // 대신 검색이 빈손으로 끝나면 보관된 대화까지 넓히는 버튼을 그 자리에 띄운다.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  // 보관 직후 그 대화는 목록에서 사라진다 — 되돌릴 자리를 잃지 않도록 한 번 잡아둔다
  const [justArchived, setJustArchived] = useState<{ id: string; title: string } | null>(null);
  // 삭제는 서버에 복구 경로가 없다(spec 34) — 되돌리기 배너가 아니라 사전 확인으로 막는다
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const conversations = useConversations({
    query: submittedQuery,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  });
  const createConversation = useCreateConversation();
  const renameConversation = useRenameConversation(renamingId);
  const archiveConversation = useArchiveConversation(selectedId);
  const unarchiveConversation = useUnarchiveConversation(selectedId);
  const deleteConversation = useDeleteConversation(pendingDeleteId);
  const confirmRef = useRef<HTMLDivElement | null>(null);

  /**
   * 확인 블록은 행보다 훨씬 높아, 목록 하단에서 열면 늘어난 만큼 스크롤 밖으로 나가
   * 취소·삭제 버튼이 가린다. 'nearest'는 이미 다 보이면 움직이지 않고 넘칠 때만
   * 최소한으로 끌어당기므로, 하단에서는 블록이 위로 올라오고 최상단에서도 안전하다.
   */
  useEffect(() => {
    if (pendingDeleteId) confirmRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [pendingDeleteId]);

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
    setJustArchived(null);
    setPendingDeleteId(null);
    onSelect(created);
  };

  const handleSearch = (event: FormEvent): void => {
    event.preventDefault();
    setSubmittedQuery(searchInput.trim() || undefined);
    setJustArchived(null);
    setPendingDeleteId(null);
  };

  const handleFilterChange = (next: StatusFilter): void => {
    setStatusFilter(next);
    setJustArchived(null);
    setPendingDeleteId(null);
  };

  const handleSelect = (conversation: ConversationSummary): void => {
    setRenamingId(null);
    setJustArchived(null);
    setPendingDeleteId(null);
    onSelect(conversation);
  };

  // 되돌리기 배너는 selectedId에 묶인 훅을 쓴다 — 선택이 바뀌면 배너도 사라져야 짝이 맞는다
  const handleArchive = (conversation: ConversationSummary): void => {
    archiveConversation.mutate(undefined, {
      onSuccess: () => setJustArchived({ id: conversation.id, title: conversation.title }),
    });
  };

  const handleUndoArchive = (): void => {
    unarchiveConversation.mutate(undefined, { onSuccess: () => setJustArchived(null) });
  };

  // 삭제 확인은 그 자리에서 열린다 — 이름 변경 폼과 동시에 열리면 취소 후 엉뚱한 폼이 남는다
  const startDelete = (conversation: ConversationSummary): void => {
    setRenamingId(null);
    setPendingDeleteId(conversation.id);
  };

  const handleDelete = (): void => {
    const deletingId = pendingDeleteId;
    deleteConversation.mutate(undefined, {
      onSuccess: () => {
        setPendingDeleteId(null);
        setJustArchived(null);
        if (deletingId === selectedId) onDeleted();
      },
    });
  };

  const startRename = (conversation: ConversationSummary): void => {
    setTitleInput(conversation.title);
    setPendingDeleteId(null);
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

      <div
        role="group"
        aria-label="보관 상태 필터"
        className="mb-3 flex shrink-0 rounded-lg border border-gray-200 bg-gray-100 p-0.5"
      >
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={statusFilter === filter.value}
            onClick={() => handleFilterChange(filter.value)}
            className={`flex-1 rounded-md px-2 py-1 text-xs ${
              statusFilter === filter.value
                ? 'bg-white font-medium text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {justArchived?.id === selectedId && (
        <div className="mb-3 flex shrink-0 items-center gap-2 rounded-lg bg-gray-100 px-2.5 py-2">
          <p className="min-w-0 flex-1 truncate text-xs text-gray-600">
            <span className="font-medium text-gray-800">{justArchived.title}</span> 보관됨
          </p>
          <button
            type="button"
            onClick={handleUndoArchive}
            disabled={unarchiveConversation.isPending}
            className="shrink-0 text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
          >
            되돌리기
          </button>
        </div>
      )}

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
                ) : pendingDeleteId === conversation.id ? (
                  /* 되돌리기 배너가 없는 대신 여기서 막는다 — 서버에 restore가 없다(spec 34) */
                  <div ref={confirmRef} className="rounded-lg border border-red-200 bg-red-50/60 p-2">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {conversation.title}
                    </p>
                    <p className="mt-0.5 text-xs text-red-700">
                      영구 삭제됩니다. 되돌릴 수 없습니다.
                    </p>
                    {deleteConversation.isError && (
                      <p role="alert" className="mt-1 text-xs text-red-600">
                        삭제하지 못했습니다. 다시 시도해 주세요.
                      </p>
                    )}
                    <div className="mt-2 flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleteConversation.isPending}
                        className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
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
                        {conversation.status === 'ARCHIVED' ? (
                          <button
                            type="button"
                            onClick={handleUndoArchive}
                            disabled={unarchiveConversation.isPending}
                            aria-label="보관 해제"
                            title="보관 해제"
                            className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <UnarchiveIcon className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleArchive(conversation)}
                            disabled={archiveConversation.isPending}
                            aria-label="보관"
                            title="보관"
                            className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <ArchiveIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* 파괴적 액션이라 나머지 emerald 액션과 시각적 무게를 달리한다 */}
                        <button
                          type="button"
                          onClick={() => startDelete(conversation)}
                          aria-label="삭제"
                          title="삭제"
                          className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {/* 활성만 보는 기본값이 보관된 대화를 조용히 숨기는 자리 — 넓히는 길을 그 자리에 둔다 */}
        {conversations.isSuccess && items.length === 0 && (
          <div className="px-1 py-6 text-center">
            <p className="text-sm text-gray-400">
              {submittedQuery ? '검색 결과가 없습니다' : '대화가 없습니다'}
            </p>
            {statusFilter === 'ACTIVE' && (
              <button
                type="button"
                onClick={() => handleFilterChange('ALL')}
                className="mt-1.5 text-xs font-medium text-emerald-700 hover:underline"
              >
                보관된 대화까지 보기
              </button>
            )}
          </div>
        )}
        {/* 하단 sentinel — 보이면 다음 페이지를 당긴다 (무한 스크롤) */}
        <div ref={listScroll.bottomSentinelRef} aria-hidden="true" />
        {conversations.isFetchingNextPage && (
          <p className="py-2 text-center text-xs text-gray-400">불러오는 중…</p>
        )}
      </div>
    </div>
  );
}
