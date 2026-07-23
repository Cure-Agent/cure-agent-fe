import { afterEach, describe, expect, it, vi } from 'vitest';
import { postStream, StreamEvent } from './stream-client';

/**
 * docs/specs/07 수용 기준 6~8 동결 테스트. 구현 중 수정 금지.
 */

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('postStream (수용 기준 6~8)', () => {
  it('기준 6: 이벤트 순서 보존 + 청크 경계가 프레임을 갈라도 조립', async () => {
    // 두 번째 이벤트가 청크 경계에 걸쳐 쪼개져 도착한다
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          'data: {"eventType":"message.accepted","requestId":"r1"}\n\n',
          'data: {"eventType":"answer.del',
          'ta","seq":0,"delta":"안녕"}\n\ndata: {"eventType":"answer.completed"}\n\n',
        ]),
      ),
    );

    const events: StreamEvent[] = [];
    await postStream('/api/v1/conversations/c1/messages/stream', { content: 'q' }, {
      onEvent: (event) => events.push(event),
    });

    expect(events.map((e) => e.eventType)).toEqual([
      'message.accepted',
      'answer.delta',
      'answer.completed',
    ]);
    expect(events[1]).toMatchObject({ seq: 0, delta: '안녕' });
  });

  it('기준 7: ": ping" 주석 프레임은 무시한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          ': ping\n\n',
          'data: {"eventType":"message.accepted"}\n\n',
          ': ping\n\n',
          'data: {"eventType":"answer.completed"}\n\n',
        ]),
      ),
    );

    const events: StreamEvent[] = [];
    await postStream('/api/v1/x', {}, { onEvent: (e) => events.push(e) });
    expect(events.map((e) => e.eventType)).toEqual(['message.accepted', 'answer.completed']);
  });

  it('기준 8: 시작 전 401 봉투 → refresh 후 1회 재시도로 스트림 성공', async () => {
    const urls: string[] = [];
    let streamAttempt = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        if (url.includes('/auth/refresh')) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        streamAttempt += 1;
        if (streamAttempt === 1) {
          return new Response(
            JSON.stringify({ success: false, code: 'UNAUTHORIZED', traceId: 't1' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return sseResponse(['data: {"eventType":"message.accepted"}\n\n']);
      }),
    );

    const events: StreamEvent[] = [];
    await postStream('/api/v1/x', {}, { onEvent: (e) => events.push(e) });

    expect(events.map((e) => e.eventType)).toEqual(['message.accepted']);
    expect(urls.filter((u) => u.includes('/auth/refresh'))).toHaveLength(1);
    expect(streamAttempt).toBe(2);
  });
});
