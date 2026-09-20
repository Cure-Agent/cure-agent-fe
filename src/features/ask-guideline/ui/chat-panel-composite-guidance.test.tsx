// @vitest-environment happy-dom
// spec 54 FE 수용 기준 48·49·50 동결 테스트(가드). 구현 중 수정 금지.
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '../api/send-message';
import type { GuidanceDto, MessageDto } from '../model/stream-state.model';
import { resetAllStreams } from '../model/stream-store';
import { setUnauthorizedHandler } from '@/shared/api/http';
import { envelope, errorEnvelope } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';

const sendMessageStreamMock = vi.hoisted(() =>
  vi.fn<(args: SendMessageArgs) => Promise<void>>(),
);

vi.mock('../api/send-message', () => ({
  sendMessageStream: sendMessageStreamMock,
}));

import { ChatPanel } from './chat-panel';

const ID = 'conv-composite-synthetic-54';
const AGENT = `/api/v1/agent/conversations/${ID}/messages/stream`;
const LEGACY = `/api/v1/conversations/${ID}/messages/stream`;
const QUESTION = '합성진단-54a 기록의 검토 항목을 정리해 주세요.';
const PAGE = { size: 50, hasNext: false, nextCursor: null };
const DATE = '2026-09-15T00:00:00.000Z';

const guidance: GuidanceDto = {
  id: 'guidance-composite-synthetic-54',
  patientId: 'patient-synthetic-54',
  patientProfileSnapshotId: 'snapshot-synthetic-54',
  summary: '합성진단-54a 기록에 대한 합성 참고안입니다.',
  considerations: [{
    title: '합성진단-54a 검토 항목',
    rationale: '합성 기록의 추가 확인 항목입니다.',
    citations: [],
  }],
  safetyAlerts: [{
    severity: 'WARNING',
    description: '합성알레르기-54b 기록을 확인해 주세요.',
    citations: [],
  }],
  missingInformation: ['합성 관찰 항목'],
  reviewStatus: 'DRAFT',
  generatedAt: DATE,
};

// 완료 이벤트의 메시지에는 guidanceId가 없다. 복원 fixture에서만 추가한다.
const completedMessage: MessageDto = {
  id: 'assistant-composite-synthetic-54',
  role: 'ASSISTANT',
  content: '합성 기록의 검토 항목을 정리한 답변입니다.',
  status: 'COMPLETED',
  citations: [],
  createdAt: DATE,
};

function completionEvents() {
  return [
    {
      eventType: 'message.accepted',
      requestId: 'request-synthetic-54',
      userMessageId: 'user-synthetic-54',
      assistantMessageId: completedMessage.id,
    },
    { eventType: 'answer.completed', message: completedMessage, guidance },
  ];
}

type Call = {
  url: string;
  method: string;
  headers: Headers;
  body: Record<string, unknown> | null;
  credentials?: RequestCredentials;
};
let calls: Call[];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sse(events: unknown[]) {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
}

function pathOf(call: Call) {
  return new URL(call.url, 'http://localhost').pathname;
}

function installFetch(agentResponse: () => Response, messages: MessageDto[] = []) {
  // 기준 49의 실제 send-message/postStream/authFetch도 이 fetch를 공유한다.
  // 이 파일에서는 MSW 서버를 열지 않는다.
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const raw = init?.body ?? (request && request.method !== 'GET' ? await request.clone().text() : null);
    /*
      openapi-fetch 경로(api.POST)는 authFetch가 Request 본문을 ArrayBuffer로 버퍼링해 넘긴다
      (shared/api/http.ts). 문자열로만 다루면 `String(ArrayBuffer)`가 "[object ArrayBuffer]"가 되어
      JSON.parse가 던지고, 호출 기록이 남기도 전에 죽는다 — 검토 POST가 이 경로다.
    */
    const text =
      raw == null ? null
      : typeof raw === 'string' ? raw
      : new TextDecoder().decode(raw as ArrayBuffer);
    const call: Call = {
      url: request?.url ?? String(input),
      method: init?.method ?? request?.method ?? 'GET',
      headers: new Headers(init?.headers ?? request?.headers),
      body: text ? JSON.parse(text) : null,
      credentials: init?.credentials ?? request?.credentials,
    };
    calls.push(call);
    const path = pathOf(call);
    if (call.method === 'GET' && path === `/api/v1/conversations/${ID}`) {
      return json(envelope({
        id: ID,
        type: 'GUIDELINE_QA',
        title: '합성 복합 참고안 대화',
        status: 'ACTIVE',
        lastMessageAt: DATE,
        createdAt: DATE,
      }));
    }
    if (call.method === 'GET' && path === `/api/v1/conversations/${ID}/messages`) {
      return json(envelope(messages, PAGE));
    }
    if (call.method === 'POST' && path === AGENT) return agentResponse();
    if (call.method === 'POST' && path === LEGACY) {
      return json(errorEnvelope('WRONG_PATH', '합성 요청이 채팅 경로로 전송되었습니다.'), 501);
    }
    if (call.method === 'GET' && path === `/api/v1/clinical-guidance/${guidance.id}`) {
      return json(envelope(guidance));
    }
    if (call.method === 'POST' && path === `/api/v1/clinical-guidance/${guidance.id}/reviews`) {
      return json(envelope({ ...guidance, reviewStatus: 'MODIFIED' }));
    }
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

beforeEach(() => {
  calls = [];
  sendMessageStreamMock.mockReset();
  resetAllStreams();
  setUnauthorizedHandler(null);
  stubNavigatorLanguage('ko-KR');
  stubStoredUiLang(UI_LANG_STORAGE_KEY, null);
});

afterEach(() => {
  cleanup();
  resetAllStreams();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setUnauthorizedHandler(null);
});

it('48: GUIDELINE_QA 완료 이벤트의 참고안 카드와 내용을 표시한다', async () => {
  installFetch(() => sse(completionEvents()));
  sendMessageStreamMock.mockImplementation(async (args) => {
    for (const event of completionEvents()) args.onEvent(event);
  });

  await submit();

  expect(await screen.findByText('임상 참고안')).toBeInTheDocument();
  expect(screen.getByText(guidance.summary)).toBeInTheDocument();
  expect(screen.getByText(guidance.considerations[0].title)).toBeInTheDocument();
  expect(screen.getByText(guidance.safetyAlerts[0].description)).toBeInTheDocument();
  expect(sendMessageStreamMock).toHaveBeenCalledWith(expect.objectContaining({
    conversationId: ID,
    conversationType: 'GUIDELINE_QA',
  }));
});

it('49: GUIDELINE_QA 스트림 카드의 검토를 해당 guidance.id 경로와 선택한 본문으로 POST한다', async () => {
  // 이 기준만 실제 스트림 함수를 사용하여 SSE와 검토 POST를 같은 fetch로 처리한다.
  const actual = await vi.importActual<typeof import('../api/send-message')>('../api/send-message');
  sendMessageStreamMock.mockImplementation(actual.sendMessageStream);
  installFetch(() => sse(completionEvents()));

  const user = await submit();
  expect(await screen.findByText('임상 참고안')).toBeInTheDocument();
  expect(screen.getByText(guidance.summary)).toBeInTheDocument();
  const note = '합성 관찰 항목을 추가하여 검토했습니다.';
  await user.click(screen.getByRole('radio', { name: 'MODIFIED' }));
  await user.type(screen.getByLabelText('검토 의견'), note);
  await user.click(screen.getByRole('button', { name: '검토 확정' }));

  await waitFor(() => {
    const reviews = calls.filter((call) => pathOf(call).endsWith('/reviews'));
    expect(reviews).toHaveLength(1);
    expect(reviews[0].method).toBe('POST');
    expect(pathOf(reviews[0])).toBe(`/api/v1/clinical-guidance/${guidance.id}/reviews`);
    expect(reviews[0].body).toEqual({ decision: 'MODIFIED', note });
  });
  expect(calls.filter((call) => call.method === 'POST' && pathOf(call) === AGENT)).toHaveLength(1);
  expect(calls.filter((call) => pathOf(call) === LEGACY)).toHaveLength(0);
  expect(await screen.findByText('수정 반영')).toBeInTheDocument();
});

it('50: GUIDELINE_QA를 새로 열면 guidanceId로 조회한 카드를 해당 메시지 아래에 복원한다', async () => {
  const restoredMessage: MessageDto = { ...completedMessage, guidanceId: guidance.id };
  installFetch(() => sse([]), [restoredMessage]);

  renderWithProviders(<ChatPanel conversationId={ID} />);

  const messageNode = await screen.findByText(restoredMessage.content);
  const cardNode = await screen.findByText('임상 참고안');
  const summaryNode = screen.getByText(guidance.summary);
  expect(cardNode).toBeInTheDocument();
  expect(summaryNode).toBeInTheDocument();
  expect(messageNode.compareDocumentPosition(cardNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(messageNode.compareDocumentPosition(summaryNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(calls.some((call) =>
    call.method === 'GET' && pathOf(call) === `/api/v1/clinical-guidance/${restoredMessage.guidanceId}`,
  )).toBe(true);
  expect(sendMessageStreamMock).not.toHaveBeenCalled();
  expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
});
