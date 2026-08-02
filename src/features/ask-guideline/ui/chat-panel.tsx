'use client';

import { useQueryClient } from '@tanstack/react-query';
import { FormEvent, KeyboardEvent, useEffect, useMemo, useReducer, useState } from 'react';
import {
  CONVERSATIONS_KEY,
  flatMessagesChronological,
  messagesKey,
  useMessages,
} from '@/features/manage-conversation/api/conversation.api';
import { useChatAutoScroll } from '@/shared/lib/use-chat-auto-scroll';
import { GuidanceCard } from '@/features/review-clinical-guidance/ui/guidance-card';
import { GuidanceCardLoader } from '@/features/review-clinical-guidance/ui/guidance-card-loader';
import { sendMessageStream } from '../api/send-message';
import {
  type AnswerCitation,
  type EvidenceDetail,
  type MessageDto,
  initialStreamState,
  streamReducer,
} from '../model/stream-state.model';

export interface ChatPanelProps {
  conversationId: string;
  /** retrieval.completed 시 근거 패널(evidence-inspector)로 전달 */
  onEvidenceChange?: (evidence: EvidenceDetail[]) => void;
  /** answer.completed의 citation marker 선택 시 */
  onSelectMarker?: (marker: number) => void;
  /** 인용 마커 클릭 시 해당 메시지의 인용 목록 전달 — 과거 저장분도 근거 패널이 복원한다 */
  onShowCitations?: (citations: AnswerCitation[], marker: number) => void;
}

interface LastRequest {
  content: string;
  clientRequestId: string;
}

export function ChatPanel({
  conversationId,
  onEvidenceChange,
  onSelectMarker,
  onShowCitations,
}: ChatPanelProps): React.ReactElement {
  const queryClient = useQueryClient();
  const messages = useMessages(conversationId);
  const [state, dispatch] = useReducer(streamReducer, initialStreamState);
  const [question, setQuestion] = useState('');
  const [lastRequest, setLastRequest] = useState<LastRequest | null>(null);

  const inFlight =
    state.phase === 'accepted' || state.phase === 'retrieving' || state.phase === 'streaming';

  const persisted = useMemo(() => flatMessagesChronological(messages.data), [messages.data]);
  // 스트림 종결 후 invalidate가 반영되기 전까지는 로컬 최종 메시지를 보여준다
  const localFinal =
    state.message && !persisted.some((m) => m.id === state.message?.id) ? state.message : null;

  const scroll = useChatAutoScroll({
    resetKey: conversationId,
    itemCount: persisted.length,
    hasOlder: messages.hasNextPage ?? false,
    isLoadingOlder: messages.isFetchingNextPage,
    loadOlder: () => void messages.fetchNextPage(),
  });

  // 스트리밍 delta·카드 렌더처럼 메시지 개수 밖의 성장도 하단 고정을 따라간다
  const { scrollToBottomIfSticky } = scroll;
  useEffect(() => {
    scrollToBottomIfSticky();
  }, [state.content, state.phase, localFinal, scrollToBottomIfSticky]);

  // 대화 전환 시 스트림 상태 초기화
  useEffect(() => {
    dispatch({ type: 'reset' });
    setLastRequest(null);
  }, [conversationId]);

  useEffect(() => {
    onEvidenceChange?.(state.evidence);
  }, [state.evidence, onEvidenceChange]);

  // 종결 시 서버 상태로 동기화 (§8 복구 폴백: GET messages가 최종 진실).
  // error도 포함한다 — 비정상 종료 뒤 서버가 이미 COMPLETED로 확정했을 수 있다.
  useEffect(() => {
    if (state.phase === 'completed' || state.phase === 'abstained' || state.phase === 'error') {
      void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
      // 대화 목록은 updatedAt 최신순 — 방금 대화한 방이 맨 위로 오도록 재조회한다
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    }
  }, [state.phase, conversationId, queryClient]);

  const send = async (content: string, clientRequestId: string): Promise<void> => {
    setLastRequest({ content, clientRequestId });
    try {
      await sendMessageStream({
        conversationId,
        content,
        clientRequestId,
        onEvent: (event) => dispatch({ type: 'event', event }),
      });
      // 종결 이벤트 없이 연결이 닫힌 경우(예: 스트리밍 도중 토큰 만료)도 실패로 확정한다.
      // 정상 종결·대화 전환 뒤라면 reducer가 무시하므로 무조건 보내도 안전하다.
      dispatch({
        type: 'streamFailed',
        message: '답변이 완료되기 전에 연결이 끊겼습니다.',
      });
    } catch (error) {
      // 스트림 비정상 종료 → 오류 상태 (서버 상태 재확인은 phase 동기화 effect가 담당)
      dispatch({
        type: 'streamFailed',
        message: error instanceof Error ? error.message : '스트림이 중단되었습니다.',
      });
    }
  };

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const content = question.trim();
    if (!content || inFlight) return;
    setQuestion('');
    scroll.scrollToBottom(); // 위를 보던 중이라도 내 질문·답변은 따라가도록 하단 고정 재개
    void send(content, crypto.randomUUID());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // 한글 IME 조합 확정용 Enter는 전송으로 취급하지 않는다
    if (event.nativeEvent.isComposing) return;
    if (event.key !== 'Enter' || event.shiftKey) return;
    // 모바일 가상 키보드의 Enter는 줄바꿈 그대로 둔다
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const handleRetry = (): void => {
    if (!lastRequest || inFlight) return;
    void send(lastRequest.content, crypto.randomUUID()); // 새 clientRequestId (§8)
  };

  // 인용 클릭 = 그 메시지의 인용 목록으로 근거 패널 복원 + 마커 선택
  const handleCite = (citations: AnswerCitation[], marker: number): void => {
    onShowCitations?.(citations, marker);
    onSelectMarker?.(marker);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div
        ref={scroll.containerRef}
        onScroll={scroll.handleScroll}
        data-testid="chat-messages"
        className="scrollbar-hidden flex-1 space-y-4 overflow-y-auto p-4"
      >
        {/* 상단 sentinel — 보이면 과거 페이지를 당긴다 (위로 무한 스크롤) */}
        <div ref={scroll.topSentinelRef} aria-hidden="true" />
        {messages.isFetchingNextPage && (
          <p className="text-center text-xs text-gray-400">이전 대화를 불러오는 중…</p>
        )}
        {persisted.map((message) => (
          <div key={message.id} className="space-y-4">
            <MessageBubble message={message} onCite={handleCite} />
            {/* 새로고침 복원 경로 — 방금 스트림으로 받은 카드(아래)가 있으면 중복 표시하지 않는다 */}
            {message.guidanceId && message.id !== state.message?.id && (
              <GuidanceCardLoader guidanceId={message.guidanceId} />
            )}
          </div>
        ))}

        {localFinal && <MessageBubble message={localFinal} onCite={handleCite} />}

        {state.phase === 'completed' && state.guidance && (
          <GuidanceCard key={state.guidance.id} guidance={state.guidance} />
        )}

        {inFlight && (
          <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-800">
            {state.phase !== 'streaming' && (
              <p className="text-xs text-gray-400">지침 근거를 검색하는 중…</p>
            )}
            {state.content && (
              <p className="whitespace-pre-wrap">
                <span>{state.content}</span>
                <span aria-hidden="true" className="animate-pulse">
                  ▍
                </span>
              </p>
            )}
          </div>
        )}

        {/* message가 실려 있으면 위 localFinal(MessageBubble)이 같은 안내를 그린다 — 없을 때만 폴백 */}
        {state.phase === 'abstained' && !state.message && <AbstainedNotice />}

        {/* 중단 시점까지 받은 본문은 버리지 않는다 — 사용자가 읽던 답변이다 */}
        {state.phase === 'error' && state.content && (
          <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-800">
            <p className="whitespace-pre-wrap">{state.content}</p>
          </div>
        )}

        {state.phase === 'error' && state.error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p>{state.error.message}</p>
            {state.error.retryable && lastRequest && (
              <button
                type="button"
                onClick={handleRetry}
                className="mt-2 rounded-lg border border-red-300 px-3 py-1 text-xs hover:bg-red-100"
              >
                다시 시도
              </button>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-200 p-3">
        <textarea
          aria-label="질문 입력"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="지침에 대해 질문하세요 (예: 만성 요통에 침 치료가 효과적인가요?)"
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={inFlight || question.trim().length === 0}
          className="self-end rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          전송
        </button>
      </form>
    </div>
  );
}

function AbstainedNotice(): React.ReactElement {
  return (
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
      검색 조건에 해당하는 지침 근거를 찾지 못해 답변을 보류했습니다.
    </p>
  );
}

function MessageBubble({
  message,
  onCite,
}: {
  message: MessageDto;
  onCite?: (citations: AnswerCitation[], marker: number) => void;
}): React.ReactElement {
  // 보류 답변은 본문이 비어 있을 수 있다 — 대화를 다시 열어도 스트림 때와 같은 안내를 그린다
  if (message.status === 'ABSTAINED') {
    return <AbstainedNotice />;
  }
  const isUser = message.role === 'USER';
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={`max-w-[85%] rounded-xl p-3 text-sm ${
          isUser ? 'bg-emerald-700 text-white' : 'bg-gray-50 text-gray-800'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.citations.map((citation) => (
              <button
                key={citation.marker}
                type="button"
                onClick={() => onCite?.(message.citations, citation.marker)}
                className="rounded border border-emerald-300 bg-white px-1.5 py-0.5 font-mono text-xs text-emerald-700 hover:bg-emerald-50"
                title={citation.guidelineTitle}
              >
                [{citation.marker}]
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
