'use client';

import { useConversation } from '@/features/manage-conversation/api/conversation.api';
import { resolveConversationTitle } from '@/features/manage-conversation/lib/conversation-title';
import { messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';

/**
 * 좁은 화면의 채팅방 머리 — 뒤로가기 · 대화 제목 · 근거 열기.
 *
 * 넓은 화면에는 그리지 않는다(`lg:hidden`). 거기서는 목록이 옆에 그대로 있어 돌아갈 곳을
 * 가리킬 필요가 없고, 제목은 목록의 선택 표시가, 근거는 오른쪽 칸이 이미 보여 준다.
 *
 * 제목은 목록을 거치지 않고 딥링크로 들어와도 서야 하므로 대화 단건에서 읽는다 —
 * `ChatPanel`이 같은 쿼리를 이미 부르고 있어 요청이 늘지는 않는다.
 */
export function ChatRoomHeader({
  conversationId,
  evidenceCount,
  onBack,
  onShowEvidence,
}: {
  conversationId: string;
  /** 지금 근거 시트에 실린 근거 수 — 0이면 열 것이 없으므로 버튼을 두지 않는다 */
  evidenceCount: number;
  onBack: () => void;
  onShowEvidence: () => void;
}): React.ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const conversation = useConversation(conversationId);
  const title = conversation.data ? resolveConversationTitle(conversation.data.title, lang) : '';

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-gray-200 bg-white px-2 lg:hidden">
      <button
        type="button"
        onClick={onBack}
        aria-label={t.backToConversations}
        className="shrink-0 rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-gray-900">{title}</h1>
      {evidenceCount > 0 && (
        <button
          type="button"
          onClick={onShowEvidence}
          aria-label={t.showEvidence}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          {/* 버튼의 이름은 aria-label이 진다 — 숫자는 눈으로 보는 사람의 몫이다 */}
          <span aria-hidden="true">{evidenceCount}</span>
        </button>
      )}
    </header>
  );
}
