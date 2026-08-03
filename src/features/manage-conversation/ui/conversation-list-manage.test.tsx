// @vitest-environment happy-dom
// docs/specs/11 개정(2026-08-02) 수용 기준 6~9 동결 테스트 — 구현 중 수정 금지
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { ConversationSummary } from '../api/conversation.api';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { ConversationList } from './conversation-list';

useMswServer();

const conversationsPage = {
  size: 20,
  hasNext: false,
  nextCursor: null,
};

function conversation(
  id: string,
  title: string,
  status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE',
): ConversationSummary {
  return {
    id,
    type: 'GUIDELINE_QA',
    title,
    status,
    lastMessageAt: '2026-07-24T00:00:00.000Z',
  };
}

// 어시스턴트 화면처럼 선택 상태를 부모가 들고 있는 사용 형태를 재현한다
function Harness(): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <ConversationList
      selectedId={selectedId}
      onSelect={(selected) => setSelectedId(selected.id)}
    />
  );
}

describe('ConversationList docs/specs/11 개정 수용 기준 6~9', () => {
  it('기준 6: 검색어를 query 파라미터로 보내 대화 목록을 재조회한다', async () => {
    const requestedQueries: Array<string | null> = [];
    server.use(
      http.get('/api/v1/conversations', ({ request }) => {
        requestedQueries.push(new URL(request.url).searchParams.get('query'));
        return HttpResponse.json(
          envelope(
            [conversation('conversation-1', '요통 진료 상담')],
            conversationsPage,
          ),
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await screen.findByRole('button', { name: '요통 진료 상담' });

    await user.type(screen.getByLabelText('대화 검색'), '요통');
    await user.click(screen.getByRole('button', { name: '검색' }));

    await waitFor(() => {
      expect(requestedQueries).toContain('요통');
    });
  });

  it('기준 7: 선택한 대화의 이름을 변경한다', async () => {
    let patchBody: unknown;
    let title = '요통 진료 상담';
    server.use(
      http.get('/api/v1/conversations', () =>
        HttpResponse.json(
          envelope([conversation('conversation-1', title)], conversationsPage),
        ),
      ),
      http.patch('/api/v1/conversations/conversation-1', async ({ request }) => {
        patchBody = await request.json();
        title = '수정된 상담 제목';
        return HttpResponse.json(envelope(conversation('conversation-1', title)));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(await screen.findByRole('button', { name: '요통 진료 상담' }));
    await user.click(await screen.findByRole('button', { name: '이름 변경' }));

    const titleInput = screen.getByRole('textbox', { name: '대화 제목' });
    await user.clear(titleInput);
    await user.type(titleInput, '수정된 상담 제목');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(patchBody).toEqual({ title: '수정된 상담 제목' });
    });
    expect(
      await screen.findByRole('button', { name: '수정된 상담 제목' }),
    ).toBeInTheDocument();
  });

  it('기준 8: 선택한 대화를 보관한다', async () => {
    let archiveCalled = false;
    server.use(
      http.get('/api/v1/conversations', () =>
        HttpResponse.json(
          envelope([conversation('conversation-1', '요통 진료 상담')], conversationsPage),
        ),
      ),
      http.post('/api/v1/conversations/conversation-1/archive', () => {
        archiveCalled = true;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(await screen.findByRole('button', { name: '요통 진료 상담' }));
    await user.click(await screen.findByRole('button', { name: '보관' }));

    await waitFor(() => {
      expect(archiveCalled).toBe(true);
    });
  });

  it('기준 9: 보관된 대화는 목록에 (보관됨)으로 표시한다', async () => {
    server.use(
      http.get('/api/v1/conversations', () =>
        HttpResponse.json(
          envelope(
            [
              conversation('conversation-1', '요통 진료 상담'),
              conversation('conversation-2', '불면 진료 상담', 'ARCHIVED'),
            ],
            conversationsPage,
          ),
        ),
      ),
    );

    renderWithProviders(<Harness />);

    await screen.findByRole('button', { name: '요통 진료 상담' });
    expect(await screen.findByText('(보관됨)')).toBeInTheDocument();
  });
});
