/**
 * POST SSE 클라이언트 (architecture.md §8, FE 분리본 §4).
 * EventSource 미사용 — fetch + ReadableStream. http.ts의 refresh 경로를 공유한다.
 */

export interface StreamEvent {
  eventType: string;
  [key: string]: unknown;
}

export interface PostStreamOptions {
  onEvent: (event: StreamEvent) => void;
  signal?: AbortSignal;
}

export async function postStream(
  _path: string,
  _body: unknown,
  _options: PostStreamOptions,
): Promise<void> {
  throw new Error('NOT_IMPLEMENTED');
}
