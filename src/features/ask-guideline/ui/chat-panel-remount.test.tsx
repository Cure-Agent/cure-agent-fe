// @vitest-environment happy-dom
// 질문을 보낸 뒤 다른 화면에 갔다 와도 내 질문은 화면에 남아야 한다.
//
// 낙관적으로 그린 질문(`pendingUser`)은 ChatPanel의 로컬 state라 언마운트되면 증발한다.
// 서버는 SSE를 열기 **전에** USER 메시지를 커밋하므로(§8 message.accepted), 그 신호가 오는
// 즉시 메시지 목록 캐시가 서버를 따라잡아야 화면을 떠난 뒤에도 질문이 남는다.
import { type InfiniteData, QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '../api/send-message';
import type { StreamEvent } from '@/shared/api/stream-client';
import type { MessageDto } from '../model/stream-state.model';
import { resetAllStreams } from '../model/stream-store';
import { type MessagePage, messagesKey } from '@/features/manage-conversation/api/conversation.api';
import { createQueryClient } from '@/shared/api/query-client';
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

beforeEach(() => {
  sendMessageStreamMock.mockReset();
  // 스트림 상태는 모듈 전역이라 테스트끼리 새지 않게 비운다
  resetAllStreams();
});

const PAGE = { size: 50, hasNext: false, nextCursor: null };
const QUESTION = '만성 요통에 침 치료가 효과적인가요?';

const userMessage: MessageDto = {
  id: 'user-message-1',
  role: 'USER',
  content: QUESTION,
  status: 'COMPLETED',
  citations: [],
  createdAt: '2026-08-31T10:00:00.000Z',
};

/**
 * 질문 수락과 함께 만들어지는 답변 행 — 종결 전까지 `STREAMING`이다.
 * 실제 행은 본문이 비어 있어 화면에 **빈 말풍선**으로만 나타나므로, 그려졌는지를 눈으로
 * 확인할 수 있도록 여기서는 본문을 채워 둔다. 이 문구가 보이면 그리지 말아야 할 행을 그린 것이다.
 */
const streamingAnswer: MessageDto = {
  id: 'assistant-message-1',
  role: 'ASSISTANT',
  content: '아직 저장되지 않은 답변 자리',
  status: 'STREAMING',
  citations: [],
  createdAt: '2026-08-31T10:00:01.000Z',
};

/**
 * 실제 앱과 같은 캐시 정책(`shared/api/query-client`)으로 만든 클라이언트.
 * 이 회귀는 **돌아왔을 때 캐시가 살아 있고 fresh하다**는 것이 조건이라(staleTime 30초 ·
 * 포커스 재조회 없음), 테스트 기본값(staleTime 0)으로는 재현되지 않는다.
 */
function appQueryClient(): QueryClient {
  const client = createQueryClient();
  client.setDefaultOptions({
    queries: { ...client.getDefaultOptions().queries, retry: false },
  });
  return client;
}

/** 수락만 알리고 스트림은 열어 둔다 — 답변이 끝나기 전에 화면을 떠나는 상황 */
function acceptThenHold(onAccepted: () => void): void {
  sendMessageStreamMock.mockImplementation((args) => {
    args.onEvent({
      eventType: 'message.accepted',
      requestId: 'request-1',
      userMessageId: userMessage.id,
      assistantMessageId: streamingAnswer.id,
    });
    onAccepted();
    return new Promise<void>(() => {});
  });
}

async function sendQuestion(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText('질문 입력'), QUESTION);
  await user.click(screen.getByRole('button', { name: '전송' }));
  await screen.findByText(QUESTION);
}

describe('ChatPanel 화면 이탈 후 복귀', () => {
  it('스트리밍 도중 언마운트했다 다시 마운트해도 내 질문이 남아 있다', async () => {
    // 서버가 USER 메시지를 커밋하기 전/후를 그대로 흉내 낸다
    let persisted: MessageDto[] = [];
    server.use(
      http.get('/api/v1/conversations/conversation-1/messages', () =>
        HttpResponse.json(envelope(persisted, PAGE)),
      ),
    );
    acceptThenHold(() => {
      persisted = [streamingAnswer, userMessage];
    });

    const queryClient = appQueryClient();
    const user = userEvent.setup();
    const first = renderWithProviders(<ChatPanel conversationId="conversation-1" />, {
      queryClient,
    });

    await sendQuestion(user);

    // 다른 화면으로 이동 = ChatPanel 언마운트. 스트림은 백그라운드에서 계속 돈다
    first.unmount();
    renderWithProviders(<ChatPanel conversationId="conversation-1" />, { queryClient });

    expect(await screen.findByText(QUESTION)).toBeTruthy();
  });

  it('돌아온 직후 서버 응답이 아직 도착하지 않아도 내 질문이 보인다', async () => {
    let persisted: MessageDto[] = [];
    // 재마운트 이후의 조회는 테스트가 붙잡아 둔다 — 네트워크가 늦어도 화면이 비면 안 된다.
    // 수락 시점에 캐시를 채워 두지 않으면 이 순간 그릴 것이 아무것도 없다.
    let holdFetch = false;
    server.use(
      http.get('/api/v1/conversations/conversation-2/messages', async () => {
        if (holdFetch) await new Promise<never>(() => {});
        return HttpResponse.json(envelope(persisted, PAGE));
      }),
    );
    acceptThenHold(() => {
      persisted = [streamingAnswer, userMessage];
    });

    const queryClient = appQueryClient();
    const user = userEvent.setup();
    const first = renderWithProviders(<ChatPanel conversationId="conversation-2" />, {
      queryClient,
    });

    await sendQuestion(user);
    // 수락 뒤 재조회가 캐시에 들어올 때까지 기다린다 — 이탈 시점의 전제다
    await waitFor(() => {
      expect(cachedMessages(queryClient, 'conversation-2')).toContainEqual(
        expect.objectContaining({ id: userMessage.id }),
      );
    });

    holdFetch = true;
    first.unmount();
    renderWithProviders(<ChatPanel conversationId="conversation-2" />, { queryClient });

    expect(await screen.findByText(QUESTION)).toBeTruthy();
  });

  it('스트리밍 중 목록에 실려 오는 STREAMING 답변 행은 그리지 않는다', async () => {
    let persisted: MessageDto[] = [];
    server.use(
      http.get('/api/v1/conversations/conversation-3/messages', () =>
        HttpResponse.json(envelope(persisted, PAGE)),
      ),
    );
    acceptThenHold(() => {
      persisted = [streamingAnswer, userMessage];
    });

    const queryClient = appQueryClient();
    const user = userEvent.setup();
    renderWithProviders(<ChatPanel conversationId="conversation-3" />, { queryClient });

    await sendQuestion(user);

    // 목록이 실제로 도착한 뒤에 단언해야 한다 — 도착 전이라면 무엇도 그리지 않아 통과가 무의미하다
    await waitFor(() => {
      expect(cachedMessages(queryClient, 'conversation-3')).toContainEqual(
        expect.objectContaining({ id: streamingAnswer.id }),
      );
    });

    expect(screen.queryByText(streamingAnswer.content)).toBeNull();
    // 내 질문은 그대로 하나만 — 로컬 낙관 렌더와 서버 목록이 겹쳐 보이지 않는다
    expect(screen.getAllByText(QUESTION)).toHaveLength(1);
  });

  it('돌아오면 진행 중이던 답변이 그대로 이어진다', async () => {
    let persisted: MessageDto[] = [];
    server.use(
      http.get('/api/v1/conversations/conversation-4/messages', () =>
        HttpResponse.json(envelope(persisted, PAGE)),
      ),
    );
    // 화면을 떠나도 SSE는 끊기지 않는다(abort signal을 넘기지 않는다) — 이벤트는 계속 도착한다
    let emit: ((event: StreamEvent) => void) | null = null;
    sendMessageStreamMock.mockImplementation((args) => {
      emit = args.onEvent;
      args.onEvent({
        eventType: 'message.accepted',
        requestId: 'request-1',
        userMessageId: userMessage.id,
        assistantMessageId: streamingAnswer.id,
      });
      persisted = [streamingAnswer, userMessage];
      args.onEvent({ eventType: 'retrieval.started' });
      return new Promise<void>(() => {});
    });

    const queryClient = appQueryClient();
    const user = userEvent.setup();
    const first = renderWithProviders(<ChatPanel conversationId="conversation-4" />, {
      queryClient,
    });

    await sendQuestion(user);
    await screen.findByText('지침 근거를 검색하는 중…');

    first.unmount();
    renderWithProviders(<ChatPanel conversationId="conversation-4" />, { queryClient });

    // 진행 중이라는 사실이 그대로 돌아온다 — 답변 자리가 비지 않는다
    expect(await screen.findByText('지침 근거를 검색하는 중…')).toBeTruthy();

    // 떠나 있는 동안에도 도착하던 이벤트를 돌아온 화면이 이어받는다
    act(() => {
      emit?.({
        eventType: 'answer.delta',
        messageId: streamingAnswer.id,
        seq: 0,
        delta: '침 치료를 ',
      });
    });
    expect(await screen.findByText('침 치료를')).toBeTruthy();
  });
});

/** 메시지 목록 캐시에 들어온 행들 (desc 페이지 누적 그대로) */
function cachedMessages(queryClient: QueryClient, conversationId: string): MessageDto[] {
  const cached = queryClient.getQueryData<InfiniteData<MessagePage>>(messagesKey(conversationId));
  return cached?.pages.flatMap((page) => page.items) ?? [];
}
