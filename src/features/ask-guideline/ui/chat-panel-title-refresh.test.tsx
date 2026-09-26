// @vitest-environment happy-dom
// title-refresh-on-answer-end 수용 기준 1~6 동결 테스트. 구현 중 수정 금지.

import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '../api/send-message';
import type { EvidenceDetail, MessageDto } from '../model/stream-state.model';
import { resetAllStreams } from '../model/stream-store';
import {
  CONVERSATIONS_KEY,
  type ConversationSummary,
} from '@/features/manage-conversation/api/conversation.api';
import { ConversationList } from '@/features/manage-conversation/ui/conversation-list';
import type { StreamEvent } from '@/shared/api/stream-client';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';

const sendMessageStreamMock = vi.hoisted(() =>
  vi.fn<(args: SendMessageArgs) => Promise<void>>(),
);

vi.mock('../api/send-message', () => ({
  sendMessageStream: sendMessageStreamMock,
}));

import { ChatPanel } from './chat-panel';

useMswServer();

const PAGE = { size: 50, hasNext: false, nextCursor: null };
const QUESTION = 'CASE-901 합성 질문 제목';
const ANSWER = 'CASE-901 합성 답변입니다.';
const CREATED_AT = '2026-09-15T00:00:00.000Z';

beforeEach(() => {
  sendMessageStreamMock.mockReset();
  resetAllStreams();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  resetAllStreams();
  vi.restoreAllMocks();
});

function conversation(id: string, title: string): ConversationSummary {
  return {
    id,
    type: 'GUIDELINE_QA',
    title,
    status: 'ACTIVE',
    lastMessageAt: CREATED_AT,
  };
}

function finalMessage(id: string, status: 'COMPLETED' | 'ABSTAINED' = 'COMPLETED'): MessageDto {
  return {
    id: `${id}-assistant`,
    role: 'ASSISTANT',
    content: status === 'COMPLETED' ? ANSWER : '',
    status,
    citations: [],
    createdAt: CREATED_AT,
    ...(status === 'ABSTAINED' ? { abstainReason: 'CASE-901 합성 근거가 부족합니다.' } : {}),
  };
}

function completed(id: string): StreamEvent {
  return { eventType: 'answer.completed', message: finalMessage(id) };
}

function mockConversation(id: string, title: () => string = () => '새 대화') {
  server.use(
    http.get(`/api/v1/conversations/${id}`, () =>
      HttpResponse.json(envelope({ ...conversation(id, title()), createdAt: CREATED_AT })),
    ),
    http.get(`/api/v1/conversations/${id}/messages`, () =>
      HttpResponse.json(envelope([], PAGE)),
    ),
  );
}

// 수락만 먼저 전달한다. 전송 promise의 resolve와 종결 이벤트는 테스트가 따로 통제한다.
function controlledStream(id: string) {
  let onEvent: SendMessageArgs['onEvent'] | undefined;
  let resolveTransport!: () => void;
  const transport = new Promise<void>((resolve) => {
    resolveTransport = resolve;
  });
  sendMessageStreamMock.mockImplementation((args) => {
    onEvent = args.onEvent;
    args.onEvent({
      eventType: 'message.accepted',
      requestId: `${id}-request`,
      userMessageId: `${id}-user`,
      assistantMessageId: `${id}-assistant`,
    });
    return transport;
  });
  return {
    async emit(event: StreamEvent) {
      await act(async () => {
        if (!onEvent) throw new Error('질문 전송 전에 이벤트를 주입할 수 없습니다.');
        onEvent(event);
      });
    },
    async close() {
      await act(async () => {
        resolveTransport();
        await transport;
      });
    },
  };
}

async function submitQuestion() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('질문 입력'), QUESTION);
  await user.click(screen.getByRole('button', { name: '전송' }));
}

async function setupAccepted(id: string) {
  mockConversation(id);
  const stream = controlledStream(id);
  const { queryClient } = renderWithProviders(<ChatPanel conversationId={id} />);
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const conversationInvalidations = () => invalidateSpy.mock.calls.filter(([filters]) => {
    const key = filters?.queryKey;
    return key?.length === CONVERSATIONS_KEY.length && key[0] === CONVERSATIONS_KEY[0];
  }).length;

  // 초기 요청과 수락 재조회를 구분하고, 수락 effect의 비동기 재조회까지 모두 기다린다.
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  await submitQuestion();
  await waitFor(() => expect(conversationInvalidations()).toBe(1));
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  const acceptedCount = conversationInvalidations();

  return {
    ...stream,
    expectNoAdditionalInvalidation() {
      expect(conversationInvalidations()).toBe(acceptedCount);
    },
    async expectTerminalInvalidation() {
      await waitFor(() => expect(conversationInvalidations()).toBe(acceptedCount + 1));
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(conversationInvalidations()).toBe(acceptedCount + 1);
    },
  };
}

describe('ChatPanel 답변 종결 시 대화 제목 갱신', () => {
  // RED: 지금 코드는 완료 시 메시지 목록만 무효화하므로 수락 이후 목록 무효화가 늘지 않는다.
  it('기준 1: answer.completed 도착 뒤 대화 목록을 한 번 더 무효화한다', async () => {
    const id = 'title-completed-901';
    const stream = await setupAccepted(id);
    await stream.emit(completed(id));
    await stream.expectTerminalInvalidation();
  });

  // RED: 지금 코드는 기권 시 메시지 목록만 무효화하므로 수락 이후 목록 무효화가 늘지 않는다.
  it('기준 2: answer.abstained 도착 뒤 대화 목록을 한 번 더 무효화한다', async () => {
    const id = 'title-abstained-901';
    const stream = await setupAccepted(id);
    await stream.emit({
      eventType: 'answer.abstained',
      message: finalMessage(id, 'ABSTAINED'),
      reason: 'insufficient_evidence',
    });
    await stream.expectTerminalInvalidation();
  });

  // RED: 지금 코드는 오류 이벤트로 종결돼도 대화 목록을 추가 무효화하지 않는다.
  it('기준 3: error 이벤트 도착 뒤 대화 목록을 한 번 더 무효화한다', async () => {
    const stream = await setupAccepted('title-error-901');
    await stream.emit({
      eventType: 'error',
      code: 'CASE_901_SYNTHETIC_ERROR',
      message: 'CASE-901 합성 스트림 오류입니다.',
      retryable: true,
      traceId: 'case-901-trace',
    });
    await stream.expectTerminalInvalidation();
  });

  // RED: 지금 코드는 종결 없는 resolve를 오류로 확정해도 메시지 목록만 무효화한다.
  it('기준 4: 종결 이벤트 없이 전송이 resolve된 뒤 대화 목록을 한 번 더 무효화한다', async () => {
    const stream = await setupAccepted('title-disconnected-901');
    await stream.close();
    await stream.expectTerminalInvalidation();
  });

  // RED: 진행 가드는 통과하지만 이어지는 완료의 추가 목록 무효화 단언에서 실패한다.
  it('기준 5-a·5-b: 복합 진행 이벤트마다 목록 갱신을 막고 완료에서만 추가 무효화한다', async () => {
    const id = 'title-composite-901';
    const stream = await setupAccepted(id);
    const evidence: EvidenceDetail[] = [901, 902].map((label) => ({
      id: `ev-${label}`,
      guidelineId: `gl-${label}`,
      guidelineVersionId: `gv-${label}`,
      guidelineTitle: `CASE-${label} 합성 지침`,
      version: '1.0',
      sectionPath: ['합성 권고'],
      excerpt: `CASE-${label} 합성 근거`,
      sourceUrl: `https://example.test/case-${label}`,
    }));
    const progressEvents: StreamEvent[] = [
      { eventType: 'agent.progress', stage: 'routed', route: 'COMPOSITE' },
      { eventType: 'agent.progress', stage: 'patient_loaded' },
      { eventType: 'retrieval.started' },
      { eventType: 'retrieval.progress', stage: 'searched', candidates: 2 },
      { eventType: 'answer.started', evidenceCount: 2 },
      { eventType: 'retrieval.evidence', index: 0, total: 2, evidence: evidence[0] },
      { eventType: 'retrieval.evidence', index: 1, total: 2, evidence: evidence[1] },
      { eventType: 'retrieval.completed' },
      { eventType: 'answer.delta', seq: 0, delta: 'CASE-901 ' },
      { eventType: 'answer.delta', seq: 1, delta: '합성 ' },
      { eventType: 'answer.delta', seq: 2, delta: '답변입니다.' },
    ];
    for (const event of progressEvents) {
      // 개별 act로 렌더와 effect를 흘려보내 배칭이 중간 갱신을 숨기지 않게 한다.
      await stream.emit(event);
      stream.expectNoAdditionalInvalidation();
    }
    await stream.emit(completed(id));
    await stream.expectTerminalInvalidation();
  });

  // RED: 수락 재조회가 끝난 뒤 서버 제목을 바꾸므로 지금 코드는 목록 행을 새 대화로 남긴다.
  it('기준 6-a·6-b: 수락 뒤 기본 제목을 유지하다 완료 뒤 사이드바에 서버 제목을 표시한다', async () => {
    const id = 'title-sidebar-901';
    let titleCommitted = false;
    let listRequests = 0;
    const serverTitle = () => titleCommitted ? QUESTION : '새 대화';
    mockConversation(id, serverTitle);
    server.use(
      http.get('/api/v1/conversations', () => {
        listRequests += 1;
        return HttpResponse.json(envelope([conversation(id, serverTitle())], PAGE));
      }),
    );
    const stream = controlledStream(id);
    const { queryClient } = renderWithProviders(
      <>
        <aside aria-label="합성 대화 사이드바">
          <ConversationList selectedId={id} onSelect={vi.fn()} onDeleted={vi.fn()} />
        </aside>
        <ChatPanel conversationId={id} />
      </>,
    );
    const sidebar = within(screen.getByRole('complementary', { name: '합성 대화 사이드바' }));
    const list = within(await sidebar.findByRole('list'));
    await list.findByRole('button', { name: '새 대화' });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    const initialRequests = listRequests;

    await submitQuestion();
    await waitFor(() => expect(listRequests).toBeGreaterThan(initialRequests));
    // 요청 시작 횟수만으로 완료를 판단하지 않는다. 캐시 반영이 끝날 때까지 플래그는 false다.
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(list.getByRole('button', { name: '새 대화' })).toHaveTextContent('새 대화');
    expect(list.queryByRole('button', { name: QUESTION })).not.toBeInTheDocument();
    const acceptedRequests = listRequests;

    titleCommitted = true;
    await stream.emit(completed(id));

    expect(await list.findByRole('button', { name: QUESTION })).toHaveTextContent(QUESTION);
    expect(listRequests).toBeGreaterThan(acceptedRequests);
    expect(list.queryByRole('button', { name: '새 대화' })).not.toBeInTheDocument();
  });
});
