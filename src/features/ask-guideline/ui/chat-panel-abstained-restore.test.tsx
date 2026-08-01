// @vitest-environment happy-dom
// 새로고침 후 보류 안내 복원 — 저장된 ABSTAINED 메시지를 스트림 때와 같은 안내 문구로 그린다
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

const NOTICE = '검색 조건에 해당하는 지침 근거를 찾지 못해 답변을 보류했습니다.';

const abstainedMessage: MessageDto = {
  id: 'assistant-message-1',
  role: 'ASSISTANT',
  content: '',
  status: 'ABSTAINED',
  citations: [],
  createdAt: '2026-07-24T10:00:00.000Z',
};

describe('ChatPanel 보류 안내 복원', () => {
  it('저장된 ABSTAINED 메시지를 보류 안내로 렌더한다', async () => {
    server.use(
      http.get('/api/v1/conversations/conversation-1/messages', () =>
        HttpResponse.json(envelope([abstainedMessage], PAGE)),
      ),
    );

    renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    expect(await screen.findByText(NOTICE)).toBeTruthy();
  });

  it('스트림 직후 refetch가 반영돼도 안내는 하나만 남는다', async () => {
    let persisted: MessageDto[] = [];
    server.use(
      http.get('/api/v1/conversations/conversation-2/messages', () =>
        HttpResponse.json(envelope(persisted, PAGE)),
      ),
    );

    sendMessageStreamMock.mockImplementation(async (args) => {
      args.onEvent({
        eventType: 'message.accepted',
        requestId: 'request-1',
        userMessageId: 'user-message-1',
        assistantMessageId: 'assistant-message-1',
      });
      // 서버 저장 완료 시점 — 이후 refetch는 ABSTAINED 메시지를 돌려준다
      persisted = [abstainedMessage];
      args.onEvent({
        eventType: 'answer.abstained',
        message: abstainedMessage,
        reason: 'NO_RELEVANT_EVIDENCE',
      });
    });

    const user = userEvent.setup();
    renderWithProviders(<ChatPanel conversationId="conversation-2" />);

    await user.type(screen.getByLabelText('질문 입력'), '이 질문에 답해 주세요.');
    await user.click(screen.getByRole('button', { name: '전송' }));

    await screen.findByText(NOTICE);
    await waitFor(() => {
      expect(screen.getAllByText(NOTICE)).toHaveLength(1);
    });
  });
});
