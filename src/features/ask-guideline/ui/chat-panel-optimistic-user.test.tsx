// @vitest-environment happy-dom
// 내 질문은 서버 왕복(GET messages)을 기다리지 않고 전송 즉시 화면에 뜬다.
// 서버는 §8 message.accepted에서 id만 돌려주므로 본문 렌더는 클라이언트 몫이다.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '../api/send-message';
import type { MessageDto } from '../model/stream-state.model';
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
});

const PAGE = { size: 50, hasNext: false, nextCursor: null };
const QUESTION = '만성 요통에 침 치료가 효과적인가요?';

const userMessage: MessageDto = {
  id: 'user-message-1',
  role: 'USER',
  content: QUESTION,
  status: 'COMPLETED',
  citations: [],
  createdAt: '2026-07-24T10:00:00.000Z',
};

const assistantMessage: MessageDto = {
  id: 'assistant-message-1',
  role: 'ASSISTANT',
  content: '침 치료를 고려합니다.',
  status: 'COMPLETED',
  citations: [],
  createdAt: '2026-07-24T10:00:01.000Z',
};

describe('ChatPanel 내 질문 즉시 렌더', () => {
  it('스트림 이벤트가 오기 전에도 전송한 질문을 화면에 그린다', async () => {
    // 서버가 첫 이벤트조차 보내지 않은 상태 — 그래도 내 말풍선은 떠 있어야 한다
    sendMessageStreamMock.mockImplementation(() => new Promise<void>(() => {}));

    const user = userEvent.setup();
    renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    await user.type(screen.getByLabelText('질문 입력'), QUESTION);
    await user.click(screen.getByRole('button', { name: '전송' }));

    expect(await screen.findByText(QUESTION)).toBeTruthy();
  });

  it('첫 이벤트 도착 전에 다음 질문을 입력해도 재전송을 막는다', async () => {
    sendMessageStreamMock.mockImplementation(() => new Promise<void>(() => {}));

    const user = userEvent.setup();
    renderWithProviders(<ChatPanel conversationId="conversation-2" />);

    await user.type(screen.getByLabelText('질문 입력'), QUESTION);
    await user.click(screen.getByRole('button', { name: '전송' }));

    // 입력창이 비워진 것만으로는 잠금이 아니다 — 다음 질문을 쳐도 전송은 막혀야 한다
    await user.type(screen.getByLabelText('질문 입력'), '두 번째 질문입니다.');

    expect(screen.getByRole('button', { name: '전송' }).hasAttribute('disabled')).toBe(true);
    expect(sendMessageStreamMock).toHaveBeenCalledTimes(1);
  });

  it('종결 후 서버 목록이 반영돼도 내 질문은 하나만 남는다', async () => {
    let persisted: MessageDto[] = [];
    server.use(
      http.get('/api/v1/conversations/conversation-3/messages', () =>
        // GET은 최신→과거(order=desc)로 내려온다
        HttpResponse.json(envelope(persisted, PAGE)),
      ),
    );

    sendMessageStreamMock.mockImplementation(async (args) => {
      args.onEvent({
        eventType: 'message.accepted',
        requestId: 'request-1',
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      });
      // 서버 저장 완료 시점 — 이후 refetch는 두 메시지를 모두 돌려준다
      persisted = [assistantMessage, userMessage];
      args.onEvent({ eventType: 'answer.completed', message: assistantMessage });
    });

    const user = userEvent.setup();
    renderWithProviders(<ChatPanel conversationId="conversation-3" />);

    await user.type(screen.getByLabelText('질문 입력'), QUESTION);
    await user.click(screen.getByRole('button', { name: '전송' }));

    await screen.findByText(assistantMessage.content);
    await waitFor(() => {
      expect(screen.getAllByText(QUESTION)).toHaveLength(1);
    });
  });

  it('오류로 끝나도 내가 물어본 질문은 화면에 남는다', async () => {
    sendMessageStreamMock.mockImplementation(async (args) => {
      args.onEvent({
        eventType: 'error',
        code: 'STREAM_TEMPORARILY_UNAVAILABLE',
        message: '잠시 후 다시 시도해 주세요.',
        retryable: true,
        traceId: 'trace-1',
      });
    });

    const user = userEvent.setup();
    renderWithProviders(<ChatPanel conversationId="conversation-4" />);

    await user.type(screen.getByLabelText('질문 입력'), QUESTION);
    await user.click(screen.getByRole('button', { name: '전송' }));

    await screen.findByRole('button', { name: '다시 시도' });
    expect(screen.getByText(QUESTION)).toBeTruthy();
  });
});
