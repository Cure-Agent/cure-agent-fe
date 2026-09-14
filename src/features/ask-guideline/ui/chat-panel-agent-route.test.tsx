// @vitest-environment happy-dom
// spec 52 FE 수용 기준 11·13 동결 테스트. 구현 중 수정 금지.
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatPanel } from './chat-panel';
import { resetAllStreams } from '../model/stream-store';
import { setUnauthorizedHandler } from '@/shared/api/http';
import { envelope, errorEnvelope } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';

const ID = 'conv-agent-route-901';
const AGENT = `/api/v1/agent/conversations/${ID}/messages/stream`;
const LEGACY = `/api/v1/conversations/${ID}/messages/stream`;
const WRONG = '오늘 경로로 새어 나간 요청';
const QUESTION = 'CASE-901 합성 기록의 항목을 요약해 주세요.';
type Call = { url: string; method: string; headers: Headers; body: Record<string, unknown> | null; credentials?: RequestCredentials };
let calls: Call[];
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
function sse(events: unknown[]) {
  return new Response(new ReadableStream<Uint8Array>({ start(controller) {
    for (const event of events) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
    controller.close();
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
}
function installFetch(agentResponse: () => Response) {
  // 실제 send-message/postStream/authFetch가 이 fetch를 공유한다. MSW 서버는 열지 않는다.
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const body = init?.body ?? (request && request.method !== 'GET' ? await request.clone().text() : null);
    const call: Call = { url: request?.url ?? String(input), method: init?.method ?? request?.method ?? 'GET', headers: new Headers(init?.headers ?? request?.headers), body: body ? JSON.parse(String(body)) : null, credentials: init?.credentials ?? request?.credentials };
    calls.push(call);
    const path = new URL(call.url, 'http://localhost').pathname;
    if (call.method === 'GET' && path === `/api/v1/conversations/${ID}`) return json(envelope({ id: ID, type: 'GUIDELINE_QA', title: '합성 대화 901', status: 'ACTIVE', lastMessageAt: '2026-09-15T00:00:00.000Z', createdAt: '2026-09-15T00:00:00.000Z' }));
    if (call.method === 'GET' && path === `/api/v1/conversations/${ID}/messages`) return json(envelope([], { size: 50, hasNext: false, nextCursor: null }));
    if (call.method === 'POST' && path === AGENT) return agentResponse();
    if (call.method === 'POST' && path === LEGACY) return json(errorEnvelope('WRONG_PATH', WRONG), 501);
    return json(errorEnvelope('UNEXPECTED_PATH', '합성 스텁 미등록 요청'), 501);
  }));
}
async function submit() {
  const user = userEvent.setup();
  renderWithProviders(<ChatPanel conversationId={ID} />);
  await screen.findByText('이렇게 질문해 보세요');
  await user.type(screen.getByLabelText('질문 입력'), QUESTION);
  await user.click(screen.getByRole('button', { name: '전송' }));
  return user;
}
beforeEach(() => { calls = []; resetAllStreams(); setUnauthorizedHandler(null); stubNavigatorLanguage('ko-KR'); stubStoredUiLang(UI_LANG_STORAGE_KEY, null); });
afterEach(() => { cleanup(); resetAllStreams(); vi.unstubAllGlobals(); vi.restoreAllMocks(); setUnauthorizedHandler(null); });

it('11-a~c: retryable SSE 오류 뒤 새 UUID와 같은 질문으로 에이전트에 재전송한다', async () => {
  // RED: ChatPanel 스텁은 타입을 넘기지 않아 두 POST가 모두 WRONG_PATH로 간다.
  let attempt = 0;
  installFetch(() => {
    attempt += 1;
    return sse([
      { eventType: 'message.accepted', requestId: `r-${attempt}`, userMessageId: `u-${attempt}`, assistantMessageId: `a-${attempt}` },
      { eventType: 'error', code: 'SYNTHETIC_RETRY', message: '합성 스트림을 다시 요청해 주세요.', retryable: true, traceId: 'trace-901' },
    ]);
  });
  const user = await submit();
  await screen.findByText('합성 스트림을 다시 요청해 주세요.');
  await user.click(await screen.findByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2));
  const posts = calls.filter((c) => c.method === 'POST');
  expect(posts.map((c) => c.url)).toEqual([AGENT, AGENT]); // 11-a
  for (const post of posts) expect(post.body?.clientRequestId).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/)); // 11-b
  expect(posts[1].body?.clientRequestId).not.toBe(posts[0].body?.clientRequestId);
  expect(posts[0].body?.content).toBe(QUESTION); // 11-c
  expect(posts[1].body?.content).toBe(posts[0].body?.content);
});

it('13-a~b: 에이전트 502 봉투의 문장과 재시도 버튼을 오류 상자에 표시한다', async () => {
  // RED: 스텁 화면에는 아래 문장 대신 구별된 WRONG_PATH 문장이 뜬다.
  const message = 'CASE-901 합성 연결을 준비하지 못했습니다.';
  installFetch(() => json(errorEnvelope('AGENT_BACKEND_UNAVAILABLE', message), 502));
  await submit();
  const text = await screen.findByText(message);
  const box = text.closest('.bg-red-50');
  expect(box).not.toBeNull();
  expect(text.textContent).toBe(message); // 13-a
  expect(screen.queryByText(WRONG)).toBeNull();
  expect(within(box as HTMLElement).getByRole('button', { name: '다시 시도' })).toBeInTheDocument(); // 13-b
});
