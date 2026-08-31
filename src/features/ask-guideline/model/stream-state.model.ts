/**
 * SSE 스트리밍 중간 상태 reducer (FE 분리본 §4 — TanStack Query 밖에서 관리).
 * 입력은 §8 ConversationStreamEvent. 중복·역행 seq delta는 무시한다.
 */
import type { components } from '@/shared/api/generated/schema';
import type { StreamEvent } from '@/shared/api/stream-client';
import { messagesFor } from '@/shared/i18n/messages';
import { resolveUiLang } from '@/shared/i18n/ui-lang';

export type EvidenceDetail = components['schemas']['EvidenceDetailResponseDto'];
export type MessageDto = components['schemas']['MessageResponseDto'];
export type GuidanceDto = components['schemas']['ClinicalGuidanceResponseDto'];
export type AnswerCitation = components['schemas']['AnswerCitationResponseDto'];
/** 메시지가 자기 언어를 말하는 축 (§44) — 계약의 `MessageResponseDto.responseLang`과 같은 값 */
export type MessageLang = NonNullable<MessageDto['responseLang']>;

export type StreamPhase =
  | 'idle'
  | 'accepted'
  | 'retrieving'
  | 'streaming'
  | 'completed'
  | 'abstained'
  | 'error';

export interface StreamError {
  code: string;
  message: string;
  retryable: boolean;
  traceId: string;
}

export interface StreamState {
  phase: StreamPhase;
  requestId: string | null;
  userMessageId: string | null;
  assistantMessageId: string | null;
  evidence: EvidenceDetail[];
  /** answer.delta 누적 본문 */
  content: string;
  /** 다음에 기대하는 seq — 불일치 delta는 무시 */
  nextSeq: number;
  /** completed/abstained의 최종 메시지 */
  message: MessageDto | null;
  /**
   * 전송 즉시 화면에 그리는 내 질문 — 서버는 본문을 되돌려주지 않는다(§8 message.accepted는 id만).
   * id는 처음엔 clientRequestId, message.accepted에서 서버 userMessageId로 교체된다.
   */
  pendingUser: MessageDto | null;
  /** PATIENT_GUIDANCE completed의 임상 참고안 (spec 10 — additive) */
  guidance: GuidanceDto | null;
  /**
   * 이번 스트림의 **응답 언어** — 방금 보낸 질의에서 유도한 값이다 (BE docs/specs/44).
   * 종결 메시지가 도착하기 전까지 화면이 딛는 값이고, 도착한 뒤에는 `message.responseLang`이
   * 같은 자리를 잇는다. 재조회 경로에는 저장된 메시지가 자기 언어를 말한다.
   */
  responseLang: MessageLang;
  error: StreamError | null;
}

export const initialStreamState: StreamState = {
  phase: 'idle',
  requestId: null,
  userMessageId: null,
  assistantMessageId: null,
  evidence: [],
  content: '',
  nextSeq: 0,
  message: null,
  pendingUser: null,
  guidance: null,
  responseLang: 'ko',
  error: null,
};

export type StreamAction =
  | { type: 'event'; event: StreamEvent }
  | { type: 'send'; message: MessageDto; responseLang: MessageLang }
  | { type: 'streamFailed'; message: string }
  | { type: 'reset' };

export function streamReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case 'reset':
      return initialStreamState;
    case 'send':
      // 이전 스트림의 잔여(본문·오류)를 지우고 내 질문부터 띄운다.
      // 서버 accept 전이지만 phase를 올려 전송 버튼도 이때부터 잠근다(연타 방지).
      // `responseLang`은 초기화에 쓸려 나가면 안 된다 — 종결 메시지가 오기 전까지 스트리밍
      // 근거가 딛고 설 유일한 언어값이다 (§44).
      return {
        ...initialStreamState,
        phase: 'accepted',
        pendingUser: action.message,
        responseLang: action.responseLang,
      };
    case 'streamFailed':
      // 이미 종결된 스트림의 사후 실패(네트워크 정리 등)는 무시.
      // idle은 대화 전환 reset 뒤 도착한 옛 스트림의 실패 — 새 대화에 오류를 남기지 않는다.
      if (
        state.phase === 'idle' ||
        state.phase === 'completed' ||
        state.phase === 'abstained' ||
        state.phase === 'error'
      ) {
        return state;
      }
      return {
        ...state,
        phase: 'error',
        error: {
          code: 'STREAM_DISCONNECTED',
          message: action.message,
          retryable: true,
          traceId: '',
        },
      };
    case 'event':
      return applyEvent(state, action.event);
  }
}

function applyEvent(state: StreamState, event: StreamEvent): StreamState {
  switch (event.eventType) {
    case 'message.accepted': {
      // 재시도 대비 초기화하되, 이미 그려둔 내 질문은 서버 id로 갱신만 한다
      const userMessageId = (event.userMessageId as string) ?? null;
      return {
        ...initialStreamState,
        phase: 'accepted',
        requestId: (event.requestId as string) ?? null,
        userMessageId,
        assistantMessageId: (event.assistantMessageId as string) ?? null,
        pendingUser:
          state.pendingUser && userMessageId
            ? { ...state.pendingUser, id: userMessageId }
            : state.pendingUser,
        // 이 초기화는 재시도 대비다 — 방금 보낸 질의의 언어까지 되돌리면 안 된다
        responseLang: state.responseLang,
      };
    }
    case 'retrieval.started':
      return { ...state, phase: 'retrieving' };
    case 'retrieval.completed':
      return {
        ...state,
        phase: 'retrieving',
        evidence: (event.evidence as EvidenceDetail[]) ?? [],
      };
    case 'answer.delta': {
      if (event.seq !== state.nextSeq) return state; // 중복·역행 seq 무시
      return {
        ...state,
        phase: 'streaming',
        content: state.content + ((event.delta as string) ?? ''),
        nextSeq: state.nextSeq + 1,
      };
    }
    case 'answer.completed':
      return {
        ...state,
        phase: 'completed',
        message: (event.message as MessageDto) ?? null,
        guidance: (event.guidance as GuidanceDto | undefined) ?? null,
      };
    case 'answer.abstained':
      return {
        ...state,
        phase: 'abstained',
        // 이벤트의 `reason`은 읽지 않는다 — 같은 문장이 `message.abstainReason`에도
        // 실려 오는데(BE spec 43 기준 11), 그쪽만이 재조회에서도 살아남는다. 반쪽만 채워지는
        // 사본을 상태에 두면 나중에 그것을 그리는 순간 spec 43이 고친 갈라짐이 되살아난다.
        message: (event.message as MessageDto) ?? null,
      };
    case 'error':
      return {
        ...state,
        phase: 'error',
        error: {
          code: (event.code as string) ?? 'UNKNOWN',
          message: (event.message as string) ?? messagesFor(resolveUiLang()).genericError,
          retryable: Boolean(event.retryable),
          traceId: (event.traceId as string) ?? '',
        },
      };
    default:
      // enum 전방 호환 (architecture.md §1): 모르는 이벤트는 무시
      return state;
  }
}
