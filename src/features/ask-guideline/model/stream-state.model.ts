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
  abstainReason: string | null;
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
  abstainReason: null,
  error: null,
};

export type StreamAction =
  | { type: 'event'; event: StreamEvent }
  | { type: 'send'; message: MessageDto }
  | { type: 'streamFailed'; message: string }
  | { type: 'reset' };

export function streamReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case 'reset':
      return initialStreamState;
    case 'send':
      // 이전 스트림의 잔여(본문·오류)를 지우고 내 질문부터 띄운다.
      // 서버 accept 전이지만 phase를 올려 전송 버튼도 이때부터 잠근다(연타 방지).
      return { ...initialStreamState, phase: 'accepted', pendingUser: action.message };
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
        message: (event.message as MessageDto) ?? null,
        abstainReason: (event.reason as string) ?? null,
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
