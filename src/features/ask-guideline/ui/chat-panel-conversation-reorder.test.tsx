// @vitest-environment happy-dom
// 질문 수락 시 대화 목록 재조회 — 제목·최신순 정렬이 답변을 기다리지 않고 바로 반영된다
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

describe('ChatPanel 대화 목록 갱신', () => {
  it('질문이 수락되면 답변을 기다리지 않고 대화 목록 쿼리를 무효화한다', async () => {
    server.use(
      http.get('/api/v1/conversations/conversation-1/messages', () =>
        HttpResponse.json(envelope([], PAGE)),
      ),
    );
    // 수락만 보내고 스트림은 열어 둔다 — 종결(completed·error 어느 쪽으로도) 시키지 않아야
    // 재조회가 답변에 묶여 있는 구현이 여기서 실패한다. 즉시 resolve하면 send()가 streamFailed를
    // 디스패치해 error phase로 넘어가므로 종결 시점 재조회와 구분되지 않는다.
    sendMessageStreamMock.mockImplementation((args) => {
      args.onEvent({
        eventType: 'message.accepted',
        requestId: 'request-1',
        userMessageId: 'user-message-1',
        assistantMessageId: 'assistant-message-1',
      });
      return new Promise<void>(() => {});
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

  it('전송 직후(서버 수락 전)에는 목록을 재조회하지 않는다', async () => {
    server.use(
      http.get('/api/v1/conversations/conversation-1/messages', () =>
        HttpResponse.json(envelope([], PAGE)),
      ),
    );
    // 서버 응답을 영원히 붙잡아 둔다 — send 액션이 낙관적으로 올리는 phase='accepted'만 남는다.
    // 이때 재조회하면 아직 커밋 전이라 제목도 순서도 그대로인 목록을 받는다.
    sendMessageStreamMock.mockImplementation(() => new Promise<void>(() => {}));

    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<ChatPanel conversationId="conversation-1" />);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.type(screen.getByLabelText('질문 입력'), '요통 치료 방법을 알려주세요.');
    await user.click(screen.getByRole('button', { name: '전송' }));

    // 내 질문이 화면에 그려질 때까지 = send 액션이 이미 처리된 시점
    await screen.findByText('요통 치료 방법을 알려주세요.');
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: CONVERSATIONS_KEY });
  });
});
