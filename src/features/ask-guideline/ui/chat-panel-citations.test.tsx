// @vitest-environment happy-dom
// 저장된 메시지의 인용 마커 클릭 — 근거 패널 복원 콜백에 그 메시지의 인용 목록과 마커를 전달한다
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '../api/send-message';
import type { AnswerCitation, MessageDto } from '../model/stream-state.model';
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

const citations: AnswerCitation[] = [
  {
    marker: 1,
    evidenceId: 'ev-1',
    guidelineTitle: '요통 한의표준임상진료지침',
    guidelineVersion: '2.0',
    sectionPath: ['치료', '침치료'],
    quote: '침 치료를 고려할 수 있다.',
    sourceUrl: 'https://example.test/guidelines/g-1',
  },
  {
    marker: 2,
    evidenceId: 'ev-2',
    guidelineTitle: '불면장애 한의표준임상진료지침',
    guidelineVersion: '1.0',
    sectionPath: ['권고'],
    quote: '환자 상태에 따라 치료를 선택한다.',
    sourceUrl: 'https://example.test/guidelines/g-2',
  },
];

const answeredMessage: MessageDto = {
  id: 'assistant-message-1',
  role: 'ASSISTANT',
  content: '침 치료를 고려합니다 [1][2].',
  status: 'COMPLETED',
  citations,
  createdAt: '2026-07-24T10:00:00.000Z',
};

describe('ChatPanel 저장 메시지 인용', () => {
  it('저장된 메시지의 [n] 클릭 시 인용 목록과 마커를 전달한다', async () => {
    server.use(
      http.get('/api/v1/conversations/conversation-1/messages', () =>
        HttpResponse.json(envelope([answeredMessage], PAGE)),
      ),
    );

    const onShowCitations = vi.fn();
    const onSelectMarker = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ChatPanel
        conversationId="conversation-1"
        onShowCitations={onShowCitations}
        onSelectMarker={onSelectMarker}
      />,
    );

    await user.click(await screen.findByRole('button', { name: '[2]' }));

    expect(onShowCitations).toHaveBeenCalledTimes(1);
    expect(onShowCitations).toHaveBeenCalledWith(citations, 2);
    expect(onSelectMarker).toHaveBeenCalledWith(2);
  });
});
