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

export function streamReducer(_state: StreamState, _action: StreamAction): StreamState {
  throw new Error('NOT_IMPLEMENTED');
}
