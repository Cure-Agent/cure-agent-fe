'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CONVERSATIONS_KEY,
  findUnfinishedAnswer,
  flatMessagesChronological,
  messagesKey,
  useConversation,
  useMessages,
} from '@/features/manage-conversation/api/conversation.api';
import { usePatient } from '@/features/manage-patient/api/patient.api';
import {
  TOUR_HIGHLIGHT_ON_SOLID,
  completeTourStep,
  useTourHighlight,
} from '@/features/onboarding-tour/model/tour-state';
import { useChatAutoScroll } from '@/shared/lib/use-chat-auto-scroll';
import { GuidanceCard } from '@/features/review-clinical-guidance/ui/guidance-card';
import { GuidanceCardLoader } from '@/features/review-clinical-guidance/ui/guidance-card-loader';
import { type MessageKey, formatMessage, messagesFor } from '@/shared/i18n/messages';
import { type UiLang, useUiLang } from '@/shared/i18n/ui-lang';
import { LogoMark } from '@/shared/ui/logo-mark';
import { sendMessageStream } from '../api/send-message';
import { resolveResponseLang } from '../lib/response-lang';
import { resolveSuggestedPrompts } from '../lib/suggested-prompts';
import {
  type AnswerCitation,
  type EvidenceDetail,
  type MessageDto,
  type StreamAction,
} from '../model/stream-state.model';
import {
  dispatchStream,
  isStreamLive,
  releaseStream,
  rememberRequest,
  useConversationStream,
} from '../model/stream-store';

export interface ChatPanelProps {
  conversationId: string;
  /**
   * retrieval.completed 시 근거 패널(evidence-inspector)로 전달.
   * `lang`은 지금 답해지고 있는 언어다 — 스트리밍 근거도 답변과 같은 언어로 서야 한다 (§44).
   */
  onEvidenceChange?: (evidence: EvidenceDetail[], lang: UiLang) => void;
  /** answer.completed의 citation marker 선택 시 */
  onSelectMarker?: (marker: number) => void;
  /**
   * 인용 마커 클릭 시 해당 메시지의 인용 목록 전달 — 과거 저장분도 근거 패널이 복원한다.
   * `lang`은 **그 메시지의 응답 언어**다 — 근거 패널이 어느 언어로 설지를 여기서 정한다 (§44).
   */
  onShowCitations?: (citations: AnswerCitation[], marker: number, lang: UiLang) => void;
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
  /**
   * 스트림 상태는 이 컴포넌트가 아니라 대화별 스토어에 있다 — 화면을 떠나도 SSE는 끊기지
   * 않으므로(abort signal을 넘기지 않는다) 이벤트가 계속 도착하는데, 상태가 여기 있으면
   * 언마운트와 함께 사라져 돌아온 화면에 진행 중이라는 흔적조차 남지 않는다 (stream-store).
   */
  const { state, lastRequest } = useConversationStream(conversationId);
  const dispatch = useCallback(
    (action: StreamAction) => dispatchStream(conversationId, action),
    [conversationId],
  );
  const [question, setQuestion] = useState('');
  const questionRef = useRef<HTMLTextAreaElement | null>(null);

  const inFlight = isStreamLive(state);
  /**
   * 기다린 시간. 기준 시각이 `pendingUser.createdAt`인 이유는 **그 값만이 스트림과 함께
   * 살기 때문이다** — 컴포넌트 로컬 state에 두면 대화를 떠났다 돌아온 화면이 0초부터 다시
   * 세서, 이어지는 것처럼 보이던 대기가 화면 전환 한 번에 거짓이 된다. `send`가 전송 시각으로
   * 채우고 `message.accepted`도 id만 갱신하므로(stream-state.model), 이 값은 대기 내내 고정이다.
   */
  const elapsedSeconds = useElapsedSeconds(state.pendingUser?.createdAt, inFlight);
  const messages = useMessages(conversationId, {
    // 이 화면이 스트림을 들고 있으면 SSE가 끝을 알려준다 — 폴링은 그때만 필요 없다
    pollUnfinishedAnswer: !inFlight,
  });

  /**
   * 예시 질의문에 필요한 두 가지 — 대화의 성격과, 환자 맞춤이라면 그 환자의 진단.
   * 목록을 거치지 않고 `?conversation={id}`로 바로 들어와도 성립해야 하므로 상위에서
   * 내려받지 않고 여기서 대화 단건을 직접 읽는다.
   */
  const conversation = useConversation(conversationId);
  const patient = usePatient(conversation.data?.patientId ?? null);

  const suggestedPromptsHighlight = useTourHighlight('suggested-prompt');
  const sendHighlight = useTourHighlight('send-question');

  /**
   * 아직 쓰이는 중인 답변 행은 목록에서 걷어낸다. 질문이 수락되면(아래 재조회 effect) 서버
   * 목록에는 그때 함께 만들어진 `status: 'STREAMING'` 답변 행이 **본문 없이** 실려 오는데,
   * `MessageBubble`은 상태를 보지 않으므로 그대로 두면 빈 말풍선이 생긴다. 그 자리는 종결까지
   * 아래 스트리밍 영역(재진입 뒤라면 아무것도)이 맡고, 본문은 종결 재조회가 채워 온다.
   */
  const chronological = useMemo(
    () => flatMessagesChronological(messages.data),
    [messages.data],
  );
  const persisted = useMemo(
    () => chronological.filter((m) => m.status !== 'STREAMING'),
    [chronological],
  );

  /**
   * 걷어낸 그 행을, 이어받을 스트림이 없을 때만 안내로 되살린다 — 새로고침·다른 탭에서 연
   * 화면은 답변이 오는 중이라는 사실을 서버 목록으로만 알 수 있다. `idle`이 아니면 이 화면이
   * 이미 그 답변을 말하고 있다(스트리밍 영역·최종 메시지·보류 안내·오류 상자).
   */
  const unfinishedAnswer = state.phase === 'idle' ? findUnfinishedAnswer(chronological) : null;
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

  /**
   * 화면을 떠날 때(대화 전환 포함) **진행 중이 아닌** 상태는 버린다 — 예전의 대화 전환 리셋과
   * 같은 자리다. 진행 중이면 그대로 두는 것이 이 스토어의 존재 이유고, 그래야 돌아왔을 때
   * 답변이 이어진다.
   */
  useEffect(() => () => releaseStream(conversationId), [conversationId]);

  /**
   * 이 화면의 **콘텐츠 언어 축** (BE docs/specs/44).
   *
   * 스트림 중에는 방금 보낸 질의에서 유도한 `state.responseLang`이, 종결·재조회에서는 저장된
   * `message.responseLang`이 그 자리를 잇는다. `responseLang`이 없는 과거 메시지는 `ko`로
   * 읽는다 — BE가 기본값으로 백필하는 축과 같다(§42 기준 3 계승).
   */
  const messageLang = (message: MessageDto): UiLang => message.responseLang ?? 'ko';
  const streamLang: UiLang = state.message?.responseLang ?? state.responseLang;

  useEffect(() => {
    onEvidenceChange?.(state.evidence, streamLang);
  }, [state.evidence, streamLang, onEvidenceChange]);

  // 종결 시 서버 상태로 동기화 (§8 복구 폴백: GET messages가 최종 진실).
  // error도 포함한다 — 비정상 종료 뒤 서버가 이미 COMPLETED로 확정했을 수 있다.
  useEffect(() => {
    if (state.phase === 'completed' || state.phase === 'abstained' || state.phase === 'error') {
      void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
    }
    /**
     * 둘러보기의 마지막 단계는 **답변을 기다리는 것**이라 사용자가 끝낼 수 없다 — 종결이
     * 곧 완료다. 기권(`abstained`)도 완료로 친다: 보류 안내까지가 이 앱이 답하는 방식이고,
     * 그 화면을 보고도 「아직 1단계 남음」이 떠 있으면 안내가 사실과 어긋난다.
     * 오류는 제외한다 — 그때 사용자가 할 일은 다음 단계가 아니라 「다시 시도」다.
     */
    if (state.phase === 'completed' || state.phase === 'abstained') {
      completeTourStep('answer');
    }
  }, [state.phase, conversationId, queryClient]);

  /**
   * 대화 목록도, 메시지 목록도 답변 종결이 아니라 **질문 수락 시점**에 갱신한다 — 둘이
   * 보여주는 것이 서버에서 이미 그때 확정되기 때문이다. 수락 tx가 lastMessageAt을 올려 정렬을
   * 정하고, 기본 제목인 대화라면 첫 질문으로 제목까지 같은 tx에서 확정한다.
   * (목록은 lastMessagePreview를 그리지 않는다 — 그리게 되면 종결 시점 재조회가 다시 필요하다.)
   *
   * 메시지 목록이 여기 함께 있는 이유가 이 버그의 핵심이다. **내 질문은 전송 직후 로컬
   * state(`pendingUser`)에만 산다** — 서버는 본문을 되돌려주지 않으므로 화면이 그것을 들고 있는
   * 것인데, 다른 화면으로 가 이 컴포넌트가 언마운트되면 그대로 증발한다. 종결까지 기다렸다
   * 재조회하면 스트리밍 도중 떠난 사람에게는 그 시점이 영영 오지 않아, 돌아왔을 때 질문만
   * 사라진 대화가 남는다. USER 메시지는 SSE를 열기 전에 이미 커밋되므로(§8) 이 신호가 오면
   * 목록 조회는 반드시 그 질문을 돌려준다 — 답변을 기다릴 이유가 없다.
   *
   * phase로 판정하지 않는 이유: 'send' 액션이 전송 버튼을 잠그려고 서버 응답 전에 이미
   * phase를 'accepted'로 올린다(stream-state.model). 그 시점에 재조회하면 커밋 전 목록을
   * 받아 제목도 순서도 그대로고 질문도 없다. userMessageId는 서버 message.accepted만 채우므로
   * 「서버가 실제로 수락했다」의 유일한 신호다.
   */
  useEffect(() => {
    if (state.userMessageId) {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
    }
  }, [state.userMessageId, conversationId, queryClient]);

  const send = async (content: string, clientRequestId: string): Promise<void> => {
    rememberRequest(conversationId, { content, clientRequestId });
    // 답변 언어는 **화면 언어가 아니라 방금 쓴 문장**이 정한다 — 예시를 누르면 보이던
    // 문장이 그대로 전송되므로(spec 41 기준 27), 이 유도가 질의 언어와 답변 언어를
    // 저절로 일치시킨다. 한국어 화면에 영문을 붙여넣어 던져도 답은 영어로 온다.
    const responseLang = resolveResponseLang(content);
    // 내 질문은 서버 왕복을 기다리지 않고 즉시 그린다 — 본문은 이미 여기 있고, 서버는 id만 돌려준다
    dispatch({
      type: 'send',
      responseLang,
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
        responseLang,
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
    completeTourStep('send-question');
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
    completeTourStep('suggested-prompt');
    const textarea = questionRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange?.(prompt.length, prompt.length);
  };

  const handleRetry = (): void => {
    if (!lastRequest || inFlight) return;
    void send(lastRequest.content, crypto.randomUUID()); // 새 clientRequestId (§8)
  };

  /**
   * 기다림을 접은 답변을 사람이 한 번 더 확인하는 길. **재전송이 아니라 재조회다** —
   * 서버가 그 사이 답변을 마쳤을 수 있고, 다시 물으면 같은 질문이 두 번 답해진다.
   */
  const handleCheckAgain = (): void => {
    void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
  };

  // 인용 클릭 = 그 메시지의 인용 목록으로 근거 패널 복원 + 마커 선택
  const handleCite = (citations: AnswerCitation[], marker: number, citeLang: UiLang): void => {
    onShowCitations?.(citations, marker, citeLang);
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
            <MessageBubble
              message={message}
              onCite={handleCite}
              t={messagesFor(messageLang(message))}
              lang={messageLang(message)}
            />
            {/* 새로고침 복원 경로 — 방금 스트림으로 받은 카드(아래)가 있으면 중복 표시하지 않는다 */}
            {message.guidanceId && message.id !== state.message?.id && (
              <GuidanceCardLoader guidanceId={message.guidanceId} lang={messageLang(message)} />
            )}
          </div>
        ))}

        {/* 내 질문은 내가 쓴 그대로다 — 유도한 응답 언어가 이 블록의 축이다 */}
        {localUser && (
          <MessageBubble
            message={localUser}
            onCite={handleCite}
            t={messagesFor(streamLang)}
            lang={streamLang}
          />
        )}

        {localFinal && (
          <MessageBubble
            message={localFinal}
            onCite={handleCite}
            t={messagesFor(messageLang(localFinal))}
            lang={messageLang(localFinal)}
          />
        )}

        {state.phase === 'completed' && state.guidance && (
          <GuidanceCard key={state.guidance.id} guidance={state.guidance} lang={streamLang} />
        )}

        {inFlight && (
          <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-800">
            {/*
              대기를 두 단계로 가른다. **축은 `phase`가 아니라 `evidence`다** — `retrieval.completed`가
              와도 phase는 `retrieving`에 머무르므로(stream-state.model), phase만 보면 근거를 이미
              받아 든 뒤에도 「검색하는 중」이라고 말하게 된다. 기다리는 사람에게는 화면이 실제로 한 번
              바뀌는 것이 어떤 움직임보다 큰 신호다.
            */}
            {state.phase !== 'streaming' && (
              <WaitingIndicator
                label={
                  state.evidence.length > 0
                    ? formatMessage(t.draftingAnswer, { count: state.evidence.length })
                    : t.retrievingEvidence
                }
                /*
                  경과는 **단계와 무관하게 이어진다** — 축이 다르기 때문이다. 단계는 서버가
                  알려주는 것이고 경과는 사람이 기다린 시간이라, 단계가 넘어갔다고 기다림이
                  리셋되지는 않는다. 1초 미만은 싣지 않는다 — 「(0초)」는 진행이 아니라 잡음이다.
                */
                elapsed={
                  elapsedSeconds >= 1
                    ? formatMessage(t.waitElapsed, { seconds: elapsedSeconds })
                    : undefined
                }
              />
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

        {/* 이어받을 스트림 없이 연 화면이 만난 진행 중 답변 — 같은 자리, 같은 생김새로.
            단계를 알 수 없는 경로라 문구는 갈리지 않지만, 기다린다는 사실은 똑같이 움직여 보인다 */}
        {unfinishedAnswer && !unfinishedAnswer.abandoned && (
          <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-800">
            <WaitingIndicator label={t.answerInProgress} />
          </div>
        )}

        {/* 상한을 넘긴 답변 — 실패라고 단정하지 않고 사실만 말한 뒤 사람에게 재조회를 넘긴다 */}
        {unfinishedAnswer?.abandoned && (
          <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-800">
            <p className="text-xs text-gray-500">{t.answerNotArrived}</p>
            <button
              type="button"
              onClick={handleCheckAgain}
              className="mt-2 rounded-lg border border-gray-300 px-3 py-1 text-xs hover:bg-gray-100"
            >
              {t.checkAgain}
            </button>
          </div>
        )}

        {/* message가 실려 있으면 위 localFinal(MessageBubble)이 같은 안내를 그린다 — 없을 때만 폴백.
            보류 안내는 답변이 서야 할 자리를 대신하므로 내용물 축을 따른다 (§44) */}
        {state.phase === 'abstained' && !state.message && (
          <AbstainedNotice t={messagesFor(streamLang)} />
        )}

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
        <SuggestedPrompts
          prompts={suggestedPrompts}
          onSelect={handleSelectPrompt}
          highlight={suggestedPromptsHighlight}
          t={t}
        />
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
          className={`self-end rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 ${TOUR_HIGHLIGHT_ON_SOLID} ${sendHighlight}`}
        >
          {t.send}
        </button>
      </form>
    </div>
  );
}

/**
 * 답을 기다리는 동안의 진행 표시 — 대기 상자 둘이 공유한다.
 *
 * 마크의 파형이 왼쪽에서 들어와 인용 점을 지나 오른쪽으로 빠져나가고, 점은 파형이 닿는 순간에만
 * 밝아진다. 이것은 임의의 장식이 아니라 **마크의 개념 그대로다** — 열린 원을 파형이 가로질러 원 밖의
 * 점(= 인용/근거)에서 멈춘다(`logo-mark.tsx`). 그 그림이 곧 「근거를 훑어 인용에 도달한다」라서,
 * 이 화면이 지금 하고 있는 일과 같다.
 *
 * 문구를 `aria-live`로 감싸는 이유는 **움직임이 정보가 아니기 때문**이다. 눈으로 보는 사람에게는
 * 파형이 「멈추지 않았다」를 말하지만, 화면을 읽어 주는 경로에서는 단계가 바뀌었다는 사실만이
 * 전달할 값어치가 있다. 흐르는 본문 쪽에는 걸지 않는다 — delta마다 읽어 대면 방해가 된다.
 *
 * **경과 시간은 그 `aria-live` 밖에 둔다.** 같은 이유의 연장이다 — 매초 바뀌는 숫자를 안에 넣으면
 * 낭독기가 매초 읽어, 「단계가 바뀐 것만 알린다」는 규칙이 그 자리에서 무너진다. 눈으로 보는
 * 사람에게만 값어치가 있는 정보라 `aria-hidden`이 맞다.
 */
function WaitingIndicator({
  label,
  elapsed,
}: {
  label: string;
  /** 이미 문구로 조립된 경과 표시. 1초 미만이면 없다 */
  elapsed?: string;
}): React.ReactElement {
  return (
    <p className="flex items-center gap-2 text-xs text-gray-400">
      <LogoMark
        className="h-4 w-auto shrink-0 text-emerald-600"
        waveClassName="mark-wave-sweep"
        dotClassName="mark-dot-arrive"
      />
      <span aria-live="polite">{label}</span>
      {elapsed && <span aria-hidden="true">{elapsed}</span>}
    </p>
  );
}

/**
 * 기다린 초. `startedAt`부터 흐르며 1초마다 갱신된다.
 *
 * **`startedAt`을 인자로 받는 이유**는 기준 시각의 소유권이 이 훅에 없기 때문이다 — 스트림은
 * 화면보다 오래 살고(stream-store), 기다림도 그래야 한다. 여기서 시작 시각을 만들면 재마운트마다
 * 0으로 돌아간다.
 *
 * 렌더 중 `Date.now()`를 읽지 않고 `now`를 상태로 두는 이유는, 그러면 같은 렌더에서 두 번 읽은
 * 값이 갈라져 화면과 단언이 어긋날 수 있어서다. 시각이 바뀌는 지점을 타이머 하나로 좁힌다.
 */
function useElapsedSeconds(startedAt: string | undefined, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || !startedAt) return;
    // 새 질문·재시도로 기준이 바뀌면 이전 대기의 잔여값을 한 프레임도 보여주지 않는다
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [active, startedAt]);

  if (!active || !startedAt) return 0;
  const started = new Date(startedAt).getTime();
  // 시각을 읽을 수 없으면 경과를 말하지 않는다 — 틀린 숫자보다 없는 편이 낫다
  if (!Number.isFinite(started)) return 0;
  return Math.max(0, Math.floor((now - started) / 1_000));
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
  highlight,
  t,
}: {
  prompts: readonly string[];
  onSelect: (prompt: string) => void;
  /** 둘러보기가 이 자리를 짚고 있을 때의 강조 클래스 — 아니면 빈 문자열 */
  highlight: string;
  t: Record<MessageKey, string>;
}): React.ReactElement {
  return (
    <div className="shrink-0 border-t border-gray-200 px-3 pt-3">
      <p className="mb-1.5 text-xs font-medium text-gray-500">{t.suggestedPromptsHeading}</p>
      {/* 강조는 항목 하나가 아니라 목록 전체에 준다 — 어느 것을 골라도 되는 자리라
          한 항목만 두르면 그것만 정답인 것처럼 읽힌다 */}
      <ul
        aria-label={t.suggestedPromptsListLabel}
        className={`max-h-[45vh] space-y-1 overflow-y-auto rounded-lg ${highlight}`}
      >
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
  lang,
}: {
  message: MessageDto;
  onCite?: (citations: AnswerCitation[], marker: number, lang: UiLang) => void;
  t: Record<MessageKey, string>;
  /** 이 메시지 블록의 콘텐츠 언어 — 인용을 넘길 때 함께 실린다 (§44) */
  lang: UiLang;
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
                onClick={() => onCite?.(message.citations, citation.marker, lang)}
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
