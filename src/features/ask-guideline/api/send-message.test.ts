// spec 52 FE 수용 기준 6~10·12 동결 테스트. 구현 중 수정 금지.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessageStream, type SendMessageArgs } from './send-message';
import { setUnauthorizedHandler } from '@/shared/api/http';

const AGENT = '/api/v1/agent/conversations/conv-agent-1/messages/stream';
const LEGACY = '/api/v1/conversations/conv-agent-1/messages/stream';
const REFRESH = '/api/v1/auth/refresh';
const ACCEPTED = { eventType: 'message.accepted', requestId: 'r-901', userMessageId: 'u-901', assistantMessageId: 'a-901' };
type Call = { url: string; method: string; headers: Headers; body: Record<string, unknown>; credentials?: RequestCredentials };
let calls: Call[];

function sseResponse(): Response {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(ACCEPTED)}\n\n`));
      controller.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
}
function json(status: number, code: string): Response {
  return new Response(JSON.stringify({ success: status === 200, code, message: 'CASE-901 합성 응답', data: null, page: null, timestamp: '2026-09-15T00:00:00.000Z', traceId: 'trace-901' }), { status, headers: { 'Content-Type': 'application/json' } });
}
function fakeFetch(respond: (call: Call) => Response): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = { url: String(input), method: init?.method ?? 'GET', headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : {}, credentials: init?.credentials };
    calls.push(call);
    return respond(call);
  }));
}
function send(extra: Partial<SendMessageArgs> = {}): Promise<void> {
  return sendMessageStream({ conversationId: 'conv-agent-1', conversationType: 'GUIDELINE_QA', content: 'CASE-901 합성 질문입니다.', clientRequestId: '90100000-0000-4000-8000-000000000001', onEvent: vi.fn(), ...extra });
}
beforeEach(() => { calls = []; setUnauthorizedHandler(null); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); setUnauthorizedHandler(null); });

describe('spec 52 실제 sendMessageStream → postStream', () => {
  it('6-a·6-b·7-a~c·8-a~b·9-a~b·10-a~b: 타입별 경로와 본문·자격 증명', async () => {
    // RED: 스텁은 첫 요청을 LEGACY로 보내며 filters도 제거하지 않는다.
    // 7·9·10의 회귀 단언은 이 테스트의 6-a 양성 배선 가드를 공유한다.
    fakeFetch(() => sseResponse());
    const filters = { guidelineIds: ['gl-901'] };
    await send({ filters, responseLang: 'en' });
    expect(calls[0].url).toBe(AGENT); // 6-a
    expect(calls[0].method).toBe('POST');
    expect(calls.filter((call) => !call.url.includes('/api/v1/agent/'))).toHaveLength(0); // 6-b
    expect(calls[0].body.content).toBe('CASE-901 합성 질문입니다.'); // 8-a
    expect(calls[0].body.clientRequestId).toBe('90100000-0000-4000-8000-000000000001');
    expect('filters' in calls[0].body).toBe(false); // 8-b
    expect(calls[0].body.responseLang).toBe('en'); // 9-a
    expect(calls[0].headers.get('X-CSRF-Protection')).toBe('1'); // 10-a
    expect(calls[0].credentials).toBe('include'); // 10-b
    await send();
    expect('responseLang' in calls[1].body).toBe(false); // 9-b
    await send({ conversationType: 'PATIENT_GUIDANCE', filters });
    expect(calls[2].url).toBe(LEGACY); // 7-a
    expect(calls[2].url).not.toContain('/api/v1/agent/');
    expect(calls[2].body.filters).toEqual(filters); // 7-b
    await send({ conversationType: undefined });
    expect(calls[3].url).toBe(LEGACY); // 7-c
  });

  it('12-a~c: 에이전트 선검사 401은 refresh 한 번 뒤 같은 경로와 이벤트로 복구한다', async () => {
    // RED: 스텁의 오늘 경로는 별도 501이며 에이전트 재시도까지 도달하지 못한다.
    let attempts = 0;
    fakeFetch((call) => {
      if (call.url === REFRESH) return json(200, 'SUCCESS');
      if (call.url === AGENT) return ++attempts === 1 ? json(401, 'AUTH_TOKEN_EXPIRED') : sseResponse();
      return json(501, 'WRONG_PATH');
    });
    const onEvent = vi.fn();
    await send({ onEvent });
    expect(calls.filter((c) => c.url === REFRESH)).toHaveLength(1); // 12-a
    expect(calls.find((c) => c.url === REFRESH)?.method).toBe('POST');
    expect(calls.map((c) => c.url)).toEqual([AGENT, REFRESH, AGENT]); // 12-b
    expect(calls.filter((c) => c.url === AGENT && c.method === 'POST')).toHaveLength(2);
    expect(calls.filter((c) => c.url === LEGACY)).toHaveLength(0);
    expect(onEvent).toHaveBeenCalledTimes(1); // 12-c
    expect(onEvent).toHaveBeenCalledWith(ACCEPTED);
  });
});
