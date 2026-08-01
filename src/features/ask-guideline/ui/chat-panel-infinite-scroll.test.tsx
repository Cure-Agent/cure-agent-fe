// @vitest-environment happy-dom
// 채팅 위로 무한 스크롤 — order=desc 역방향 페이징 + 시간순 렌더 (BE listMessages desc 계약)
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
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

function message(id: string, role: MessageDto['role'], content: string): MessageDto {
  return {
    id,
    role,
    content,
    status: 'COMPLETED',
    citations: [],
    createdAt: '2026-07-24T00:00:00.000Z',
  };
}

// 페이지 안 정렬도 최신→과거 (BE order=desc 계약)
const NEWEST_PAGE = [
  message('message-4', 'ASSISTANT', '최신 답변입니다.'),
  message('message-3', 'USER', '최신 질문입니다.'),
];
const OLDER_PAGE = [
  message('message-2', 'ASSISTANT', '과거 답변입니다.'),
  message('message-1', 'USER', '과거 질문입니다.'),
];

describe('ChatPanel 위로 무한 스크롤', () => {
  it('order=desc로 최신 페이지를 먼저 받고, 위로 스크롤하면 과거 페이지를 시간순 위쪽에 붙인다', async () => {
    const requestedOrders: Array<string | null> = [];

    server.use(
      http.get('/api/v1/conversations/conversation-1/messages', ({ request }) => {
        const url = new URL(request.url);
        requestedOrders.push(url.searchParams.get('order'));
        const cursor = url.searchParams.get('cursor');
        if (!cursor) {
          return HttpResponse.json(
            envelope(NEWEST_PAGE, { size: 2, hasNext: true, nextCursor: 'cursor-message-3' }),
          );
        }
        expect(cursor).toBe('cursor-message-3');
        return HttpResponse.json(envelope(OLDER_PAGE, { size: 2, hasNext: false, nextCursor: null }));
      }),
    );

    const { container } = renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    // 첫 페이지 = 최신 메시지 (시간순으로 뒤집혀 질문→답변)
    await screen.findByText('최신 답변입니다.');
    expect(screen.queryByText('과거 질문입니다.')).toBeNull();
    expect(requestedOrders).toEqual(['desc']);

    // 위로 스크롤 (happy-dom은 scrollTop=0 → 상단 도달로 취급) → 과거 페이지 로드
    const scrollArea = container.querySelector('.overflow-y-auto');
    expect(scrollArea).not.toBeNull();
    fireEvent.scroll(scrollArea as Element);

    await screen.findByText('과거 질문입니다.');
    expect(requestedOrders).toEqual(['desc', 'desc']);

    // 시간순 렌더: 과거 질문 → 과거 답변 → 최신 질문 → 최신 답변
    const bubbles = Array.from(
      (scrollArea as Element).querySelectorAll('p.whitespace-pre-wrap'),
    ).map((el) => el.textContent);
    expect(bubbles).toEqual([
      '과거 질문입니다.',
      '과거 답변입니다.',
      '최신 질문입니다.',
      '최신 답변입니다.',
    ]);
  });

  it('마지막 페이지(hasNext=false)에 도달하면 더 요청하지 않는다', async () => {
    let calls = 0;
    server.use(
      http.get('/api/v1/conversations/conversation-2/messages', () => {
        calls += 1;
        return HttpResponse.json(
          envelope([message('message-1', 'USER', '유일한 질문입니다.')], {
            size: 50,
            hasNext: false,
            nextCursor: null,
          }),
        );
      }),
    );

    const { container } = renderWithProviders(<ChatPanel conversationId="conversation-2" />);
    await screen.findByText('유일한 질문입니다.');

    const scrollArea = container.querySelector('.overflow-y-auto');
    fireEvent.scroll(scrollArea as Element);
    fireEvent.scroll(scrollArea as Element);

    // 추가 페이지 요청이 없어야 한다
    await waitFor(() => expect(calls).toBe(1));
  });
});
