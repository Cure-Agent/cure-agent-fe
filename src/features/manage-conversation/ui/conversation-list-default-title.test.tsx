// @vitest-environment happy-dom

import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setUiLang, UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import type { ConversationSummary } from '../api/conversation.api';
import { ConversationList } from './conversation-list';

useMswServer();

const PAGE = { size: 20, hasNext: false, nextCursor: null };
const DEFAULT_CONVERSATION_ID = 'conversation-default-title';

function conversation(title: string): ConversationSummary {
  return {
    id: DEFAULT_CONVERSATION_ID,
    type: 'GUIDELINE_QA',
    title,
    status: 'ACTIVE',
    lastMessageAt: '2026-09-02T00:00:00.000Z',
  };
}

function setLanguageInputs(navigatorLanguage: string, stored: string | null): void {
  stubNavigatorLanguage(navigatorLanguage);
  stubStoredUiLang(UI_LANG_STORAGE_KEY, stored);
}

function mockConversations(items: ConversationSummary[]): void {
  server.use(
    http.get('/api/v1/conversations', () =>
      HttpResponse.json(envelope(items, { ...PAGE, size: items.length })),
    ),
  );
}

function renderList(selectedId: string | null = null): void {
  renderWithProviders(
    <ConversationList selectedId={selectedId} onSelect={vi.fn()} onDeleted={vi.fn()} />,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('ConversationList 기본 제목의 표시 언어', () => {
  it('한국어 화면의 기본 제목 대화 행에 새 대화가 구체적으로 보인다', async () => {
    setLanguageInputs('ko-KR', 'ko');
    mockConversations([conversation('새 대화')]);
    renderList();

    const list = await screen.findByRole('list');
    expect(await within(list).findByRole('button', { name: '새 대화' })).toHaveTextContent(
      '새 대화',
    );
    expect(screen.getAllByRole('button', { name: '새 대화' })).toHaveLength(2);
  });

  it('영문 화면의 기본 제목 대화 행은 New conversation이고 새 대화는 어디에도 없다', async () => {
    setLanguageInputs('en-US', 'en');
    mockConversations([conversation('새 대화')]);
    renderList();

    const list = await screen.findByRole('list');
    expect(
      await within(list).findByRole('button', { name: 'New conversation' }),
    ).toHaveTextContent('New conversation');
    expect(screen.getAllByRole('button', { name: 'New conversation' })).toHaveLength(2);
    expect(screen.queryByText('새 대화')).not.toBeInTheDocument();
  });

  it('영문 화면에서도 한국어 질문에서 만들어진 진짜 제목은 번역하지 않는다', async () => {
    setLanguageInputs('en-US', 'en');
    const queryTitle = '만성 요통에 침 치료가 효과적인가요?';
    mockConversations([conversation(queryTitle)]);
    renderList();

    const list = await screen.findByRole('list');
    expect(await within(list).findByRole('button', { name: queryTitle })).toHaveTextContent(
      '만성 요통에 침 치료가 효과적인가요?',
    );
  });

  it('영문 화면의 삭제 확인 블록도 기본 제목을 New conversation으로 표시한다', async () => {
    setLanguageInputs('en-US', 'en');
    mockConversations([conversation('새 대화')]);
    const user = userEvent.setup();
    renderList(DEFAULT_CONVERSATION_ID);

    const list = await screen.findByRole('list');
    await within(list).findByRole('button', { name: 'New conversation' });
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    const warning = await screen.findByText(
      'This will be deleted permanently. It cannot be undone.',
    );
    const confirmation = warning.parentElement;
    expect(confirmation).not.toBeNull();
    expect(within(confirmation as HTMLElement).getByText('New conversation')).toHaveTextContent(
      'New conversation',
    );
  });

  it('영문 화면에서 기본 제목 대화를 보관하면 되돌리기 배너도 New conversation을 표시한다', async () => {
    setLanguageInputs('en-US', 'en');
    let archived = false;
    server.use(
      http.get('/api/v1/conversations', () => {
        const items = archived ? [] : [conversation('새 대화')];
        return HttpResponse.json(envelope(items, { ...PAGE, size: items.length }));
      }),
      http.post(`/api/v1/conversations/${DEFAULT_CONVERSATION_ID}/archive`, () => {
        archived = true;
        return HttpResponse.json(envelope(null));
      }),
    );
    const user = userEvent.setup();
    renderList(DEFAULT_CONVERSATION_ID);

    const list = await screen.findByRole('list');
    await within(list).findByRole('button', { name: 'New conversation' });
    await user.click(screen.getByRole('button', { name: 'Archive' }));

    const undo = await screen.findByRole('button', { name: 'Undo' });
    const banner = undo.parentElement;
    expect(banner).not.toBeNull();
    expect(within(banner as HTMLElement).getByText('New conversation')).toHaveTextContent(
      'New conversation',
    );
  });

  it('영문 화면에서 기본 제목 이름 변경을 열면 입력 초기값은 New conversation이다', async () => {
    setLanguageInputs('en-US', 'en');
    mockConversations([conversation('새 대화')]);
    const user = userEvent.setup();
    renderList(DEFAULT_CONVERSATION_ID);

    const list = await screen.findByRole('list');
    await within(list).findByRole('button', { name: 'New conversation' });
    await user.click(screen.getByRole('button', { name: 'Rename' }));

    expect(await screen.findByRole('textbox', { name: 'Conversation title' })).toHaveValue(
      'New conversation',
    );
  });

  it('한국어로 그린 기본 제목 행은 표시 언어를 영어로 바꾸면 New conversation으로 다시 그려진다', async () => {
    setLanguageInputs('ko-KR', 'ko');
    mockConversations([conversation('새 대화')]);
    renderList();

    const list = await screen.findByRole('list');
    expect(await within(list).findByRole('button', { name: '새 대화' })).toHaveTextContent(
      '새 대화',
    );

    act(() => {
      setUiLang('en');
    });

    await waitFor(() => {
      expect(within(list).getByRole('button', { name: 'New conversation' })).toHaveTextContent(
        'New conversation',
      );
      expect(within(list).queryByRole('button', { name: '새 대화' })).not.toBeInTheDocument();
    });
  });
});
