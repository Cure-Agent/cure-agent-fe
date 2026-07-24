// @vitest-environment happy-dom
// docs/specs/08 수용 기준 5 동결 테스트 — 구현 중 수정 금지
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { ConversationSummary } from '../api/conversation.api';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { ConversationList } from './conversation-list';

useMswServer();

describe('ConversationList', () => {
  it('기준 5: 목록을 렌더하고 새 대화를 생성한 뒤 생성 결과를 선택한다', async () => {
    const conversations: ConversationSummary[] = [
      {
        id: 'conversation-1',
        type: 'GUIDELINE_QA',
        title: '요통 진료 상담',
        status: 'ACTIVE',
        updatedAt: '2026-07-24T00:00:00.000Z',
      },
      {
        id: 'conversation-2',
        type: 'GUIDELINE_QA',
        title: '불면 진료 상담',
        status: 'ACTIVE',
        updatedAt: '2026-07-24T01:00:00.000Z',
      },
    ];
    const createdConversation: ConversationSummary = {
      id: 'conversation-created',
      type: 'GUIDELINE_QA',
      title: '새 대화',
      status: 'ACTIVE',
      updatedAt: '2026-07-24T02:00:00.000Z',
    };
    const createRequestBody = vi.fn();

    server.use(
      http.get('/api/v1/conversations', () =>
        HttpResponse.json(
          envelope(conversations, {
            size: conversations.length,
            hasNext: false,
            nextCursor: null,
          }),
        ),
      ),
      http.post('/api/v1/conversations', async ({ request }) => {
        createRequestBody(await request.json());
        return HttpResponse.json(envelope(createdConversation), { status: 201 });
      }),
    );

    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ConversationList selectedId={null} onSelect={onSelect} />);

    expect(
      await screen.findByRole('button', { name: conversations[0].title }),
    ).toBeTruthy();
    expect(
      await screen.findByRole('button', { name: conversations[1].title }),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '새 대화' }));

    await waitFor(() => {
      expect(createRequestBody).toHaveBeenCalledTimes(1);
      expect(createRequestBody).toHaveBeenCalledWith({ type: 'GUIDELINE_QA' });
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(createdConversation);
    });
  });
});
