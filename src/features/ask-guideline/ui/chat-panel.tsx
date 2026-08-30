'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  CONVERSATIONS_KEY,
  flatMessagesChronological,
  messagesKey,
  useConversation,
  useMessages,
} from '@/features/manage-conversation/api/conversation.api';
import { usePatient } from '@/features/manage-patient/api/patient.api';
import { useChatAutoScroll } from '@/shared/lib/use-chat-auto-scroll';
import { GuidanceCard } from '@/features/review-clinical-guidance/ui/guidance-card';
import { GuidanceCardLoader } from '@/features/review-clinical-guidance/ui/guidance-card-loader';
import { type MessageKey, messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';
import { sendMessageStream } from '../api/send-message';
import { resolveResponseLang } from '../lib/response-lang';
import { resolveSuggestedPrompts } from '../lib/suggested-prompts';
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
  const lang = useUiLang();
  const t = messagesFor(lang);
  const messages = useMessages(conversationId);
  const [state, dispatch] = useReducer(streamReducer, initialStreamState);
  const [question, setQuestion] = useState('');
  const [lastRequest, setLastRequest] = useState<LastRequest | null>(null);
  const questionRef = useRef<HTMLTextAreaElement | null>(null);

  /**
   * 예시 질의문에 필요한 두 가지 — 대화의 성격과, 환자 맞춤이라면 그 환자의 진단.
   * 목록을 거치지 않고 `?conversation={id}`로 바로 들어와도 성립해야 하므로 상위에서
   * 내려받지 않고 여기서 대화 단건을 직접 읽는다.
   */
  const conversation = useConversation(conversationId);
  const patient = usePatient(conversation.data?.patientId ?? null);

  const inFlight =
    state.phase === 'accepted' || state.phase === 'retrieving' || state.phase === 'streaming';

  const persisted = useMemo(() => flatMessagesChronological(messages.data), [messages.data]);
  // 스트림 종결 후 invalidate가 반영되기 전까지는 로컬 최종 메시지를 보여준다
  const localFinal =
    state.message && !persisted.some((m) => m.id === state.message?.id) ? state.message : null;
  // 내 질문도 같은 규칙 — 서버 목록에 같은 id가 들어오면 그쪽으로 넘긴다(중복 방지)
  const localUser =
    state.pendingUser && !persisted.some((m) => m.id === state.pendingUser?.id)
      ? state.pendingUser
      : null;

  /**
   * 예시 질의문은 **아직 아무 말도 오가지 않은 대화에만** 띄운다. 대화가 시작되면 입력창 위
   * 자리는 방금 받은 답변이 차지해야 하고, 그때부터 예시는 다음 질문을 가리는 방해물이 된다.
   * 내 질문을 낙관적으로 그리는 `localUser`까지 함께 보는 이유는, 전송 직후 서버 목록이
   * 갱신되기 전의 짧은 순간에 예시가 되살아나 보이지 않게 하기 위해서다.
   */
  const isConversationEmpty =
    messages.isSuccess && persisted.length === 0 && !localUser && !localFinal && state.phase === 'idle';

  const suggestedPrompts = useMemo(() => {
    if (!isConversationEmpty || !conversation.data) return [];
    return resolveSuggestedPrompts({
      type: conversation.data.type,
      lang,
      // 환자를 못 불러온 경우(삭제된 환자 등)는 빈 배열 = 「걸리는 진단 없음」으로 넘겨
      // 일반 질의문으로 떨어뜨린다 — 무한정 빈 자리로 두지 않는다
      diagnoses: patient.isError ? [] : patient.data?.diagnoses,
    });
  }, [isConversationEmpty, conversation.data, patient.data, patient.isError, lang]);

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
  }, [state.content, state.phase, localUser, localFinal, scrollToBottomIfSticky]);

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
    }
  }, [state.phase, conversationId, queryClient]);

  /**
   * 대화 목록은 답변 종결이 아니라 질문 수락 시점에 갱신한다 — 목록이 보여주는 두 가지가
   * 서버에서 이미 그때 확정되기 때문이다. 수락 tx가 lastMessageAt을 올려 정렬을 정하고,
   * 기본 제목인 대화라면 첫 질문으로 제목까지 같은 tx에서 확정한다. 답변을 기다릴 이유가 없다.
   * (목록은 lastMessagePreview를 그리지 않는다 — 그리게 되면 종결 시점 재조회가 다시 필요하다.)
   *
   * phase로 판정하지 않는 이유: 'send' 액션이 전송 버튼을 잠그려고 서버 응답 전에 이미
   * phase를 'accepted'로 올린다(stream-state.model). 그 시점에 재조회하면 커밋 전 목록을
   * 받아 제목도 순서도 그대로다. userMessageId는 서버 message.accepted만 채우므로
   * 「서버가 실제로 수락했다」의 유일한 신호다.
   */
  useEffect(() => {
    if (state.userMessageId) {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    }
  }, [state.userMessageId, queryClient]);

  const send = async (content: string, clientRequestId: string): Promise<void> => {
    setLastRequest({ content, clientRequestId });
    // 내 질문은 서버 왕복을 기다리지 않고 즉시 그린다 — 본문은 이미 여기 있고, 서버는 id만 돌려준다
    dispatch({
      type: 'send',
      message: {
        id: clientRequestId,
        role: 'USER',
        content,
        status: 'COMPLETED',
        citations: [],
        createdAt: new Date().toISOString(),
      },
    });
    try {
      await sendMessageStream({
        conversationId,
        content,
        clientRequestId,
        // 답변 언어는 **화면 언어가 아니라 방금 쓴 문장**이 정한다 — 예시를 누르면 보이던
        // 문장이 그대로 전송되므로(spec 41 기준 27), 이 유도가 질의 언어와 답변 언어를
        // 저절로 일치시킨다. 한국어 화면에 영문을 붙여넣어 던져도 답은 영어로 온다.
        responseLang: resolveResponseLang(content),
        onEvent: (event) => dispatch({ type: 'event', event }),
      });
      // 종결 이벤트 없이 연결이 닫힌 경우(예: 스트리밍 도중 토큰 만료)도 실패로 확정한다.
      // 정상 종결·대화 전환 뒤라면 reducer가 무시하므로 무조건 보내도 안전하다.
      dispatch({ type: 'streamFailed', message: t.streamDisconnected });
    } catch (error) {
      // 스트림 비정상 종료 → 오류 상태 (서버 상태 재확인은 phase 동기화 effect가 담당)
      dispatch({
        type: 'streamFailed',
        message: error instanceof Error ? error.message : t.streamAborted,
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

  /**
   * 예시를 누르면 **보내지 않고 입력창을 채운다.** 클릭 한 번이 곧 LLM 호출이면 실수로 눌렀을 때
   * 되돌릴 방법이 없고, 예시를 자기 환자에 맞게 고쳐 던지는 흐름도 막힌다. 커서를 문장 끝에
   * 두는 것까지가 「채운다」의 완성이다 — focus만 주면 캐럿이 맨 앞에 붙어 이어 쓸 수 없다.
   */
  const handleSelectPrompt = (prompt: string): void => {
    setQuestion(prompt);
    const textarea = questionRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange?.(prompt.length, prompt.length);
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
          <p className="text-center text-xs text-gray-400">{t.loadingOlderMessages}</p>
        )}
        {persisted.map((message) => (
          <div key={message.id} className="space-y-4">
            <MessageBubble message={message} onCite={handleCite} t={t} />
            {/* 새로고침 복원 경로 — 방금 스트림으로 받은 카드(아래)가 있으면 중복 표시하지 않는다 */}
            {message.guidanceId && message.id !== state.message?.id && (
              <GuidanceCardLoader guidanceId={message.guidanceId} />
            )}
          </div>
        ))}

        {localUser && <MessageBubble message={localUser} onCite={handleCite} t={t} />}

        {localFinal && <MessageBubble message={localFinal} onCite={handleCite} t={t} />}

        {state.phase === 'completed' && state.guidance && (
          <GuidanceCard key={state.guidance.id} guidance={state.guidance} />
        )}

        {inFlight && (
          <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-800">
            {state.phase !== 'streaming' && (
              <p className="text-xs text-gray-400">{t.retrievingEvidence}</p>
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
        {state.phase === 'abstained' && !state.message && <AbstainedNotice t={t} />}

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
                {t.retry}
              </button>
            )}
          </div>
        )}
      </div>

      {suggestedPrompts.length > 0 && (
        <SuggestedPrompts prompts={suggestedPrompts} onSelect={handleSelectPrompt} t={t} />
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-200 p-3">
        <textarea
          ref={questionRef}
          aria-label={t.questionInputLabel}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder={t.questionInputPlaceholder}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={inFlight || question.trim().length === 0}
          className="self-end rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {t.send}
        </button>
      </form>
    </div>
  );
}

/**
 * 입력창 바로 위에 붙는 예시 질의문. 메시지 영역이 아니라 폼 위에 두는 이유는 이것이
 * 대화 기록이 아니라 **입력 보조**이기 때문이다 — 스크롤과 함께 떠내려가면 안 된다.
 *
 * 질문 문장이 길어 한 줄에 담기지 않으므로 칩이 아니라 세로 목록이다. 높이는 내용에 맡긴다 —
 * 이 목록이 뜨는 것은 메시지가 하나도 없을 때뿐이라, 위쪽 메시지 영역(`flex-1` + `overflow-y-auto`
 * 라 0까지 줄어든다)이 그만큼을 그대로 내준다. `max-h`는 세 줄을 자르지 않는 선의 안전장치일
 * 뿐이다 — 고정 rem 값으로 잡으면 낮은 뷰포트에서 마지막 항목이 글자 중간에서 잘린다.
 */
function SuggestedPrompts({
  prompts,
  onSelect,
  t,
}: {
  prompts: readonly string[];
  onSelect: (prompt: string) => void;
  t: Record<MessageKey, string>;
}): React.ReactElement {
  return (
    <div className="shrink-0 border-t border-gray-200 px-3 pt-3">
      <p className="mb-1.5 text-xs font-medium text-gray-500">{t.suggestedPromptsHeading}</p>
      <ul aria-label={t.suggestedPromptsListLabel} className="max-h-[45vh] space-y-1 overflow-y-auto">
        {prompts.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => onSelect(prompt)}
              className="w-full rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-left text-xs leading-relaxed text-emerald-900 hover:bg-emerald-50"
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 스트림이 종결 이벤트 없이 닫혔을 때의 폴백 문구.
 *
 * **보류라는 사실은 이 컨테이너가 진다 — 문구가 아니라 프레이밍이다** (BE docs/specs/43).
 * BE의 사유 문장은 「무엇을 찾지 못했나」만 말하고 「그래서 답을 보류했다」를 말하지 않는데,
 * spec 42 기준 27이 그 자구를 잠갔으므로 덧붙일 수 없다. amber notice가 이미 프레이밍을
 * 지고 있으므로 사유 문장을 **그 안에** 넣는다 — 프레이밍은 유지되고 내용만 사유별로 갈린다.
 */
function AbstainedNotice({
  t,
  reason,
}: {
  t: Record<MessageKey, string>;
  /** BE가 실어 보낸 사유별 문장. 사유가 기록되기 전에 만들어진 행에는 없다 */
  reason?: string;
}): React.ReactElement {
  return (
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
      {reason ?? t.abstainedNotice}
    </p>
  );
}

function MessageBubble({
  message,
  onCite,
  t,
}: {
  message: MessageDto;
  onCite?: (citations: AnswerCitation[], marker: number) => void;
  t: Record<MessageKey, string>;
}): React.ReactElement {
  // 보류 답변은 본문이 비어 있을 수 있다 — 대화를 다시 열어도 스트림 때와 같은 안내를 그린다
  if (message.status === 'ABSTAINED') {
    return <AbstainedNotice t={t} reason={message.abstainReason} />;
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
