// @vitest-environment happy-dom
// 답변 종결 시 대화 목록 재조회 — 방금 대화한 방이 최신순 맨 위로 올라온다
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '../api/send-message';
import type { MessageDto } from '../model/stream-state.model';
import { CONVERSATIONS_KEY } from '@/features/manage-conversation/api/conversation.api';
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

const completedMessage: MessageDto = {
  id: 'assistant-message-1',
  role: 'ASSISTANT',
  content: '침 치료를 고려합니다.',
  status: 'COMPLETED',
  citations: [],
  createdAt: '2026-08-02T10:00:00.000Z',
};

describe('ChatPanel 대화 목록 최신순 갱신', () => {
  it('답변이 종결되면 대화 목록 쿼리를 무효화해 최신순 재정렬을 반영한다', async () => {
    server.use(
      http.get('/api/v1/conversations/conversation-1/messages', () =>
        HttpResponse.json(envelope([completedMessage], PAGE)),
      ),
    );
    sendMessageStreamMock.mockImplementation(async (args) => {
      args.onEvent({
        eventType: 'message.accepted',
        requestId: 'request-1',
        userMessageId: 'user-message-1',
        assistantMessageId: 'assistant-message-1',
      });
      args.onEvent({
        eventType: 'answer.completed',
        message: completedMessage,
      });
    });

    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<ChatPanel conversationId="conversation-1" />);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.type(screen.getByLabelText('질문 입력'), '요통 치료 방법을 알려주세요.');
    await user.click(screen.getByRole('button', { name: '전송' }));

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CONVERSATIONS_KEY }),
    );
  });
});
