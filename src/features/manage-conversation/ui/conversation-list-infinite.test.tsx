// @vitest-environment happy-dom
// 대화 목록 하단 무한 스크롤 — 커서 페이지 누적 (docs/specs/08 목록 계약의 무한 스크롤 전환)
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { ConversationSummary } from '../api/conversation.api';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { ConversationList } from './conversation-list';

useMswServer();

function conversation(id: string, title: string): ConversationSummary {
  return {
    id,
    type: 'GUIDELINE_QA',
    title,
    status: 'ACTIVE',
    lastMessageAt: '2026-07-24T00:00:00.000Z',
  };
}

describe('ConversationList 무한 스크롤', () => {
  it('목록 하단으로 스크롤하면 다음 커서 페이지를 이어 붙인다', async () => {
    const cursors: Array<string | null> = [];
    server.use(
      http.get('/api/v1/conversations', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        if (!cursor) {
          return HttpResponse.json(
            envelope([conversation('conversation-1', '최근 대화')], {
              size: 1,
              hasNext: true,
              nextCursor: 'cursor-1',
            }),
          );
        }
        return HttpResponse.json(
          envelope([conversation('conversation-2', '예전 대화')], {
            size: 1,
            hasNext: false,
            nextCursor: null,
          }),
        );
      }),
    );

    const { container } = renderWithProviders(
      <ConversationList selectedId={null} onSelect={vi.fn()} onDeleted={vi.fn()} />,
    );

    await screen.findByRole('button', { name: '최근 대화' });
    expect(screen.queryByRole('button', { name: '예전 대화' })).toBeNull();

    // happy-dom은 레이아웃 값이 0 → 스크롤 이벤트가 하단 도달로 취급된다
    const scrollArea = container.querySelector('.overflow-y-auto');
    expect(scrollArea).not.toBeNull();
    fireEvent.scroll(scrollArea as Element);

    expect(await screen.findByRole('button', { name: '예전 대화' })).toBeTruthy();
    await waitFor(() => expect(cursors).toEqual([null, 'cursor-1']));
  });
});
