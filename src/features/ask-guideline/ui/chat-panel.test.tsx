// @vitest-environment happy-dom
// docs/specs/08 수용 기준 6·7·8 동결 테스트 — 구현 중 수정 금지
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '../api/send-message';
import type { MessageDto } from '../model/stream-state.model';
import { renderWithProviders } from '@/shared/test/render';

const sendMessageStreamMock = vi.hoisted(() =>
  vi.fn<(args: SendMessageArgs) => Promise<void>>(),
);

vi.mock('../api/send-message', () => ({
  sendMessageStream: sendMessageStreamMock,
}));

import { ChatPanel } from './chat-panel';

beforeEach(() => {
  sendMessageStreamMock.mockReset();
});

describe('ChatPanel', () => {
  it('기준 6: 질문을 전송하고 수신한 delta를 스트리밍 텍스트로 갱신한다', async () => {
    sendMessageStreamMock.mockImplementation(async (args) => {
      args.onEvent({
        eventType: 'message.accepted',
        requestId: 'request-1',
        userMessageId: 'user-message-1',
        assistantMessageId: 'assistant-message-1',
      });
      args.onEvent({
        eventType: 'answer.delta',
        messageId: 'assistant-message-1',
        seq: 0,
        delta: '침 치료를 ',
      });
      args.onEvent({
        eventType: 'answer.delta',
        messageId: 'assistant-message-1',
        seq: 1,
        delta: '고려합니다.',
      });
    });

    const user = userEvent.setup();
    renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    await user.type(screen.getByLabelText('질문 입력'), '요통 치료 방법을 알려주세요.');
    await user.click(screen.getByRole('button', { name: '전송' }));

    await waitFor(() => expect(sendMessageStreamMock).toHaveBeenCalledTimes(1));

    const request = sendMessageStreamMock.mock.calls[0][0];
    expect(request).toMatchObject({
      conversationId: 'conversation-1',
      content: '요통 치료 방법을 알려주세요.',
      clientRequestId: expect.any(String),
    });
    expect(await screen.findByText('침 치료를 고려합니다.')).toBeTruthy();
  });

  it('기준 7: abstained 이벤트를 받으면 근거 없음 안내를 렌더한다', async () => {
    const abstainedMessage: MessageDto = {
      id: 'assistant-message-2',
      role: 'ASSISTANT',
      content: '답변에 필요한 근거를 찾지 못했습니다.',
      status: 'ABSTAINED',
      citations: [],
      createdAt: '2026-07-24T00:01:00.000Z',
    };

    sendMessageStreamMock.mockImplementation(async (args) => {
      args.onEvent({
        eventType: 'message.accepted',
        requestId: 'request-2',
        userMessageId: 'user-message-2',
        assistantMessageId: 'assistant-message-2',
      });
      args.onEvent({
        eventType: 'answer.abstained',
        message: abstainedMessage,
        reason: 'NO_RELEVANT_EVIDENCE',
        missingInformation: ['관련 임상 지침'],
      });
    });

    const user = userEvent.setup();
    renderWithProviders(<ChatPanel conversationId="conversation-2" />);

    await user.type(screen.getByLabelText('질문 입력'), '이 질문에 답해 주세요.');
    await user.click(screen.getByRole('button', { name: '전송' }));

    const notices = await screen.findAllByText(/근거/);
    expect(notices.length).toBeGreaterThan(0);
  });

  it('기준 8: retryable error 뒤 다시 시도하면 새 clientRequestId로 재전송한다', async () => {
    sendMessageStreamMock
      .mockImplementationOnce(async (args) => {
        args.onEvent({
          eventType: 'message.accepted',
          requestId: 'request-3',
          userMessageId: 'user-message-3',
          assistantMessageId: 'assistant-message-3',
        });
        args.onEvent({
          eventType: 'error',
          code: 'STREAM_TEMPORARILY_UNAVAILABLE',
          message: '잠시 후 다시 시도해 주세요.',
          retryable: true,
          traceId: 'trace-error-1',
        });
      })
      .mockImplementationOnce(async () => undefined);

    const user = userEvent.setup();
    renderWithProviders(<ChatPanel conversationId="conversation-3" />);

    await user.type(screen.getByLabelText('질문 입력'), '재시도할 질문입니다.');
    await user.click(screen.getByRole('button', { name: '전송' }));

    const retryButton = await screen.findByRole('button', { name: '다시 시도' });
    expect(sendMessageStreamMock).toHaveBeenCalledTimes(1);
    const firstRequest = sendMessageStreamMock.mock.calls[0][0];

    await user.click(retryButton);

    await waitFor(() => expect(sendMessageStreamMock).toHaveBeenCalledTimes(2));
    const secondRequest = sendMessageStreamMock.mock.calls[1][0];

    expect(secondRequest).toMatchObject({
      conversationId: 'conversation-3',
      content: '재시도할 질문입니다.',
      clientRequestId: expect.any(String),
    });
    expect(secondRequest.clientRequestId).not.toBe(firstRequest.clientRequestId);
  });
});
