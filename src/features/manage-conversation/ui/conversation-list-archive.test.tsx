// @vitest-environment happy-dom
// 대화 보관 완성 — 기본 활성만 조회 / 상태 필터 / 보관 해제 / 보관 직후 되돌리기
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

const page = { size: 20, hasNext: false, nextCursor: null };

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
    lastMessageAt: '2026-08-03T00:00:00.000Z',
  };
}

// 보관된 행은 제목 옆에 (보관됨)이 붙어 접근성 이름이 제목과 정확히 일치하지 않는다
const ARCHIVED_ROW = /불면 진료 상담/;

function Harness(): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <ConversationList
      selectedId={selectedId}
      onSelect={(selected) => setSelectedId(selected.id)}
      onDeleted={() => setSelectedId(null)}
    />
  );
}

describe('대화 목록 보관', () => {
  it('기본은 활성만 조회하고, 필터를 바꾸면 해당 status로 재조회한다', async () => {
    const requestedStatuses: Array<string | null> = [];
    server.use(
      http.get('/api/v1/conversations', ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        requestedStatuses.push(status);
        const items =
          status === 'ARCHIVED'
            ? [conversation('conversation-2', '불면 진료 상담', 'ARCHIVED')]
            : status === 'ACTIVE'
              ? [conversation('conversation-1', '요통 진료 상담')]
              : [
                  conversation('conversation-1', '요통 진료 상담'),
                  conversation('conversation-2', '불면 진료 상담', 'ARCHIVED'),
                ];
        return HttpResponse.json(envelope(items, { ...page, size: items.length }));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await screen.findByRole('button', { name: '요통 진료 상담' });
    expect(requestedStatuses).toContain('ACTIVE');
    expect(requestedStatuses).not.toContain(null);
    expect(screen.queryByRole('button', { name: ARCHIVED_ROW })).toBeNull();

    await user.click(screen.getByRole('button', { name: '보관됨' }));

    await waitFor(() => expect(requestedStatuses).toContain('ARCHIVED'));
    expect(await screen.findByRole('button', { name: ARCHIVED_ROW })).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '요통 진료 상담' })).toBeNull(),
    );
  });

  it('보관된 대화를 선택하면 보관 해제 버튼으로 unarchive를 호출한다', async () => {
    let unarchiveCalled = false;
    server.use(
      http.get('/api/v1/conversations', () =>
        HttpResponse.json(
          envelope([conversation('conversation-2', '불면 진료 상담', 'ARCHIVED')], page),
        ),
      ),
      http.post('/api/v1/conversations/conversation-2/unarchive', () => {
        unarchiveCalled = true;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(await screen.findByRole('button', { name: ARCHIVED_ROW }));
    await user.click(await screen.findByRole('button', { name: '보관 해제' }));

    await waitFor(() => expect(unarchiveCalled).toBe(true));
  });

  it('보관 직후 목록에서 사라져도 되돌리기로 복구한다', async () => {
    let status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE';
    let unarchiveCalled = false;
    server.use(
      http.get('/api/v1/conversations', ({ request }) => {
        const requested = new URL(request.url).searchParams.get('status');
        // 기본 필터가 활성이므로 보관되는 순간 목록에서 빠진다
        const items =
          requested === 'ACTIVE' && status === 'ARCHIVED'
            ? []
            : [conversation('conversation-1', '요통 진료 상담', status)];
        return HttpResponse.json(envelope(items, { ...page, size: items.length }));
      }),
      http.post('/api/v1/conversations/conversation-1/archive', () => {
        status = 'ARCHIVED';
        return HttpResponse.json(envelope(null));
      }),
      http.post('/api/v1/conversations/conversation-1/unarchive', () => {
        unarchiveCalled = true;
        status = 'ACTIVE';
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(await screen.findByRole('button', { name: '요통 진료 상담' }));
    await user.click(await screen.findByRole('button', { name: '보관' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '요통 진료 상담' })).toBeNull(),
    );

    await user.click(await screen.findByRole('button', { name: '되돌리기' }));

    await waitFor(() => expect(unarchiveCalled).toBe(true));
    expect(await screen.findByRole('button', { name: '요통 진료 상담' })).toBeTruthy();
  });

  it('활성 목록이 비면 보관된 대화까지 넓혀 재조회한다', async () => {
    const requestedStatuses: Array<string | null> = [];
    server.use(
      http.get('/api/v1/conversations', ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        requestedStatuses.push(status);
        const items =
          status === 'ACTIVE'
            ? []
            : [conversation('conversation-2', '불면 진료 상담', 'ARCHIVED')];
        return HttpResponse.json(envelope(items, { ...page, size: items.length }));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await screen.findByText('대화가 없습니다');
    await user.click(screen.getByRole('button', { name: '보관된 대화까지 보기' }));

    await waitFor(() => expect(requestedStatuses).toContain(null));
    expect(await screen.findByRole('button', { name: ARCHIVED_ROW })).toBeTruthy();
  });
});
