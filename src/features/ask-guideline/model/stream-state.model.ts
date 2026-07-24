/**
 * SSE 스트리밍 중간 상태 reducer (FE 분리본 §4 — TanStack Query 밖에서 관리).
 * 입력은 §8 ConversationStreamEvent. 중복·역행 seq delta는 무시한다.
 */
import type { components } from '@/shared/api/generated/schema';
import type { StreamEvent } from '@/shared/api/stream-client';

export type EvidenceDetail = components['schemas']['EvidenceDetailResponseDto'];
export type MessageDto = components['schemas']['MessageResponseDto'];

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
  abstainReason: null,
  error: null,
};

export type StreamAction =
  | { type: 'event'; event: StreamEvent }
  | { type: 'streamFailed'; message: string }
  | { type: 'reset' };

export function streamReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case 'reset':
      return initialStreamState;
    case 'streamFailed':
      // 이미 종결된 스트림의 사후 실패(네트워크 정리 등)는 무시
      if (state.phase === 'completed' || state.phase === 'abstained' || state.phase === 'error') {
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
    case 'message.accepted':
      return {
        ...initialStreamState,
        phase: 'accepted',
        requestId: (event.requestId as string) ?? null,
        userMessageId: (event.userMessageId as string) ?? null,
        assistantMessageId: (event.assistantMessageId as string) ?? null,
      };
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
      return { ...state, phase: 'completed', message: (event.message as MessageDto) ?? null };
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
          message: (event.message as string) ?? '오류가 발생했습니다.',
          retryable: Boolean(event.retryable),
          traceId: (event.traceId as string) ?? '',
        },
      };
    default:
      // enum 전방 호환 (architecture.md §1): 모르는 이벤트는 무시
      return state;
  }
}
