'use client';

/**
 * 대화별 스트림 상태 보관소 (FE 분리본 §4 — 스트리밍 중간 상태는 TanStack Query 밖에서 관리).
 *
 * **상태가 컴포넌트 밖에 사는 이유는 스트림이 화면보다 오래 살기 때문이다.**
 * `sendMessageStream`에 abort signal을 넘기지 않으므로, 다른 화면으로 가도 SSE 연결은 그대로
 * 열려 있고 이벤트도 계속 도착한다. 그런데 상태가 `useReducer`에 있으면 언마운트와 함께
 * 사라져서, 도착한 이벤트들이 갈 곳을 잃는다 — 돌아온 화면에는 진행 중이라는 흔적조차 없다.
 * 대화 id로 나눠 모듈에 두면 그 이벤트들이 계속 쌓이고, 돌아왔을 때 답변이 그대로 이어진다.
 *
 * 끝난 대화의 상태는 마지막 화면이 내려갈 때 버린다(`releaseStream`) — 진행 중이 아니라면
 * 컴포넌트보다 오래 살아 있을 이유가 없고, 그대로 두면 방문한 대화 수만큼 쌓인다.
 */
import { useCallback, useSyncExternalStore } from 'react';
import {
  type StreamAction,
  type StreamState,
  initialStreamState,
  streamReducer,
} from './stream-state.model';

/** 오류 뒤 「다시 시도」가 딛는 마지막 요청 */
export interface LastRequest {
  content: string;
  clientRequestId: string;
}

export interface ConversationStream {
  state: StreamState;
  /** 화면을 떠났다 돌아와도 「다시 시도」 버튼이 남아야 하므로 상태와 같은 자리에 둔다 */
  lastRequest: LastRequest | null;
}

/** 아직 아무것도 오가지 않은 대화의 스냅샷 — 참조가 고정이라 재렌더를 유발하지 않는다 */
const EMPTY: ConversationStream = { state: initialStreamState, lastRequest: null };

const streams = new Map<string, ConversationStream>();
const listeners = new Map<string, Set<() => void>>();

export function getConversationStream(conversationId: string): ConversationStream {
  return streams.get(conversationId) ?? EMPTY;
}

/** 답변이 아직 오는 중 — 이 판정이 폴링·자리 표시의 기준이 된다 */
export function isStreamLive(state: StreamState): boolean {
  return state.phase === 'accepted' || state.phase === 'retrieving' || state.phase === 'streaming';
}

function update(conversationId: string, next: ConversationStream): void {
  streams.set(conversationId, next);
  listeners.get(conversationId)?.forEach((listener) => listener());
}

export function dispatchStream(conversationId: string, action: StreamAction): void {
  const current = getConversationStream(conversationId);
  const state = streamReducer(current.state, action);
  // reducer가 같은 참조를 돌려주면(무시한 이벤트) 구독자를 깨우지 않는다
  if (state === current.state) return;
  update(conversationId, { ...current, state });
}

export function rememberRequest(conversationId: string, lastRequest: LastRequest): void {
  update(conversationId, { ...getConversationStream(conversationId), lastRequest });
}

/**
 * 진행 중이 아닌 대화의 상태를 버린다. 화면이 내려갈 때 호출한다 —
 * 진행 중이면 그대로 두어야 돌아왔을 때 이어받을 수 있다.
 */
export function releaseStream(conversationId: string): void {
  const current = streams.get(conversationId);
  if (!current || isStreamLive(current.state)) return;
  streams.delete(conversationId);
}

/** 테스트용 — 모듈 전역 상태를 비운다 (파일 안 테스트끼리 상태가 새지 않도록) */
export function resetAllStreams(): void {
  streams.clear();
  listeners.clear();
}

function subscribeStream(conversationId: string, listener: () => void): () => void {
  const set = listeners.get(conversationId) ?? new Set<() => void>();
  listeners.set(conversationId, set);
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(conversationId);
  };
}

/** 대화 하나의 스트림 상태 구독 — 서버 렌더에서는 빈 스냅샷이다 */
export function useConversationStream(conversationId: string): ConversationStream {
  return useSyncExternalStore(
    useCallback((listener: () => void) => subscribeStream(conversationId, listener), [conversationId]),
    useCallback(() => getConversationStream(conversationId), [conversationId]),
    () => EMPTY,
  );
}
