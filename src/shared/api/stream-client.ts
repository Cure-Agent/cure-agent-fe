/**
 * POST SSE 클라이언트 (architecture.md §8, FE 분리본 §4).
 * EventSource 미사용 — fetch + ReadableStream. http.ts의 refresh 경로를 공유한다.
 * 프레임(\n\n) 경계가 청크 중간에 걸려도 버퍼로 조립하며, `: ping` 주석은 무시한다.
 */
import { ApiEnvelope, ApiError } from './api-error';
import { buildUrl, ensureRefreshed, notifyUnauthorized } from './http';

export interface StreamEvent {
  eventType: string;
  [key: string]: unknown;
}

export interface PostStreamOptions {
  onEvent: (event: StreamEvent) => void;
  signal?: AbortSignal;
}

export async function postStream(
  path: string,
  body: unknown,
  options: PostStreamOptions,
): Promise<void> {
  const doFetch = (): Promise<Response> =>
    fetch(buildUrl(path), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Protection': '1',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

  let response = await doFetch();

  // 스트림 시작 전 401은 일반 봉투 — refresh 후 1회 재시도 (§8 복구 계약)
  if (response.status === 401) {
    const refreshed = await ensureRefreshed();
    if (refreshed) {
      response = await doFetch();
    } else {
      notifyUnauthorized();
    }
  }

  if (!response.ok) {
    let envelope: ApiEnvelope | null = null;
    try {
      envelope = (await response.json()) as ApiEnvelope;
    } catch {
      envelope = null;
    }
    throw new ApiError(
      envelope?.code ?? 'INTERNAL_ERROR',
      envelope?.message ?? '스트림 연결에 실패했습니다.',
      response.status,
      envelope?.traceId ?? '',
      envelope?.data ?? undefined,
    );
  }

  if (!response.body) {
    throw new ApiError('INTERNAL_ERROR', '스트림 본문이 없습니다.', response.status, '');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data: '))
          .map((line) => line.slice('data: '.length))
          .join('');
        if (data) options.onEvent(JSON.parse(data) as StreamEvent);

        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}
