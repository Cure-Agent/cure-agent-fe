'use client';

import { useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useReducer, useState } from 'react';
import { messagesKey, useMessages } from '@/features/manage-conversation/api/conversation.api';
import { sendMessageStream } from '../api/send-message';
import {
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
}

interface LastRequest {
  content: string;
  clientRequestId: string;
}

export function ChatPanel({
  conversationId,
  onEvidenceChange,
  onSelectMarker,
}: ChatPanelProps): React.ReactElement {
  const queryClient = useQueryClient();
  const messages = useMessages(conversationId);
  const [state, dispatch] = useReducer(streamReducer, initialStreamState);
  const [question, setQuestion] = useState('');
  const [lastRequest, setLastRequest] = useState<LastRequest | null>(null);

  const inFlight =
    state.phase === 'accepted' || state.phase === 'retrieving' || state.phase === 'streaming';

  // 대화 전환 시 스트림 상태 초기화
  useEffect(() => {
    dispatch({ type: 'reset' });
    setLastRequest(null);
  }, [conversationId]);

  useEffect(() => {
    onEvidenceChange?.(state.evidence);
  }, [state.evidence, onEvidenceChange]);

  // 종결 시 서버 상태로 동기화 (§8 복구 폴백: GET messages가 최종 진실)
  useEffect(() => {
    if (state.phase === 'completed' || state.phase === 'abstained') {
      void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
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
    } catch (error) {
      // 스트림 비정상 종료 → 오류 상태 + 서버 상태 재확인 (§8)
      dispatch({
        type: 'streamFailed',
        message: error instanceof Error ? error.message : '스트림이 중단되었습니다.',
      });
      void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
    }
  };

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const content = question.trim();
    if (!content || inFlight) return;
    setQuestion('');
    void send(content, crypto.randomUUID());
  };

  const handleRetry = (): void => {
    if (!lastRequest || inFlight) return;
    void send(lastRequest.content, crypto.randomUUID()); // 새 clientRequestId (§8)
  };

  const persisted = messages.data?.items ?? [];
  // 스트림 종결 후 invalidate가 반영되기 전까지는 로컬 최종 메시지를 보여준다
  const localFinal =
    state.message && !persisted.some((m) => m.id === state.message?.id) ? state.message : null;

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {persisted.map((message) => (
          <MessageBubble key={message.id} message={message} onSelectMarker={onSelectMarker} />
        ))}

        {localFinal && (
          <MessageBubble message={localFinal} onSelectMarker={onSelectMarker} />
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

        {state.phase === 'abstained' && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            검색 조건에 해당하는 지침 근거를 찾지 못해 답변을 보류했습니다.
          </p>
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

function MessageBubble({
  message,
  onSelectMarker,
}: {
  message: MessageDto;
  onSelectMarker?: (marker: number) => void;
}): React.ReactElement {
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
                onClick={() => onSelectMarker?.(citation.marker)}
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
