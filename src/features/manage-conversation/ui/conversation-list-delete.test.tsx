// @vitest-environment happy-dom
// 대화 삭제 (BE spec 34) — 서버에 restore가 없으므로 되돌리기가 아니라 사전 확인으로 막는다
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { envelope, errorEnvelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import type { ConversationSummary } from '../api/conversation.api';
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
    lastMessageAt: '2026-08-04T00:00:00.000Z',
  };
}

function Harness({ onDeleted }: { onDeleted?: () => void }): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <ConversationList
      selectedId={selectedId}
      onSelect={(selected) => setSelectedId(selected.id)}
      onDeleted={() => {
        setSelectedId(null);
        onDeleted?.();
      }}
    />
  );
}

/** 삭제 전에는 목록에 남고, 삭제되면 빠진다 */
function listHandler(deleted: () => boolean, item: ConversationSummary) {
  return http.get('/api/v1/conversations', () => {
    const items = deleted() ? [] : [item];
    return HttpResponse.json(envelope(items, { ...page, size: items.length }));
  });
}

describe('대화 삭제', () => {
  it('휴지통을 눌러도 확인 전에는 DELETE를 호출하지 않는다', async () => {
    let deleteCalled = false;
    server.use(
      listHandler(() => false, conversation('conversation-1', '요통 진료 상담')),
      http.delete('/api/v1/conversations/conversation-1', () => {
        deleteCalled = true;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(await screen.findByRole('button', { name: '요통 진료 상담' }));
    await user.click(await screen.findByRole('button', { name: '삭제' }));

    expect(await screen.findByText('영구 삭제됩니다. 되돌릴 수 없습니다.')).toBeTruthy();
    expect(deleteCalled).toBe(false);
  });

  it('취소하면 삭제하지 않고 목록 행으로 돌아간다', async () => {
    let deleteCalled = false;
    server.use(
      listHandler(() => false, conversation('conversation-1', '요통 진료 상담')),
      http.delete('/api/v1/conversations/conversation-1', () => {
        deleteCalled = true;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(await screen.findByRole('button', { name: '요통 진료 상담' }));
    await user.click(await screen.findByRole('button', { name: '삭제' }));
    await user.click(await screen.findByRole('button', { name: '취소' }));

    expect(screen.queryByText('영구 삭제됩니다. 되돌릴 수 없습니다.')).toBeNull();
    expect(await screen.findByRole('button', { name: '요통 진료 상담' })).toBeTruthy();
    expect(deleteCalled).toBe(false);
  });

  it('확인하면 DELETE를 호출하고, 열려 있던 대화면 선택까지 푼다', async () => {
    let deleted = false;
    const onDeleted = vi.fn();
    server.use(
      listHandler(() => deleted, conversation('conversation-1', '요통 진료 상담')),
      http.delete('/api/v1/conversations/conversation-1', () => {
        deleted = true;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<Harness onDeleted={onDeleted} />);

    await user.click(await screen.findByRole('button', { name: '요통 진료 상담' }));
    await user.click(await screen.findByRole('button', { name: '삭제' }));
    await user.click(await screen.findByRole('button', { name: '삭제' }));

    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '요통 진료 상담' })).toBeNull(),
    );
    expect(onDeleted).toHaveBeenCalled();
    // 되돌리기는 보관 전용이다 — 삭제 뒤에 그 경로가 열려 있으면 안 된다
    expect(screen.queryByRole('button', { name: '되돌리기' })).toBeNull();
  });

  it('보관된 대화도 그대로 삭제된다 — 보관과 삭제는 직교한다', async () => {
    let deleted = false;
    server.use(
      listHandler(() => deleted, conversation('conversation-2', '불면 진료 상담', 'ARCHIVED')),
      http.delete('/api/v1/conversations/conversation-2', () => {
        deleted = true;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    // 기본 필터가 활성이라 보관된 대화는 전체로 넓혀야 보인다
    await user.click(await screen.findByRole('button', { name: '전체' }));
    await user.click(await screen.findByRole('button', { name: /불면 진료 상담/ }));
    await user.click(await screen.findByRole('button', { name: '삭제' }));
    await user.click(await screen.findByRole('button', { name: '삭제' }));

    await waitFor(() => expect(deleted).toBe(true));
  });

  it('삭제에 실패하면 확인을 닫지 않고 실패를 알린다', async () => {
    server.use(
      listHandler(() => false, conversation('conversation-1', '요통 진료 상담')),
      http.delete('/api/v1/conversations/conversation-1', () =>
        HttpResponse.json(errorEnvelope('INTERNAL_ERROR', '서버 오류'), { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(await screen.findByRole('button', { name: '요통 진료 상담' }));
    await user.click(await screen.findByRole('button', { name: '삭제' }));
    await user.click(await screen.findByRole('button', { name: '삭제' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('영구 삭제됩니다. 되돌릴 수 없습니다.')).toBeTruthy();
  });
});
