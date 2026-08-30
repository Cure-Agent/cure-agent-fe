// @vitest-environment happy-dom
// 대화 목록 문구가 표시 언어를 따르는지 — 사이드바만 영어로 바뀌면 토글이 고장으로 읽힌다
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { ConversationList } from './conversation-list';

useMswServer();

const PAGE = { size: 20, hasNext: false, nextCursor: null };

function mockConversations(items: unknown[]): void {
  server.use(
    http.get('/api/v1/conversations', () => HttpResponse.json(envelope(items, PAGE))),
  );
}

function setLanguageInputs(navigatorLanguage: string, stored: string | null): void {
  stubNavigatorLanguage(navigatorLanguage);
  stubStoredUiLang(UI_LANG_STORAGE_KEY, stored);
}

function renderList(selectedId: string | null = null): void {
  renderWithProviders(
    <ConversationList selectedId={selectedId} onSelect={vi.fn()} onDeleted={vi.fn()} />,
  );
}

beforeEach(() => {
  localStorage.clear();
  setLanguageInputs('ko-KR', null);
});

describe('ConversationList 표시 언어', () => {
  it('한국어 화면은 오늘 그대로다', async () => {
    setLanguageInputs('ko-KR', null);
    mockConversations([]);
    renderList();

    expect(await screen.findByRole('button', { name: '새 대화' })).toBeTruthy();
    expect(screen.getByLabelText('대화 검색')).toBeTruthy();
    expect(await screen.findByText('대화가 없습니다')).toBeTruthy();
  });

  it('영문 화면에서는 목록 문구도 영어로 나온다', async () => {
    setLanguageInputs('en-US', null);
    mockConversations([]);
    renderList();

    expect(await screen.findByRole('button', { name: 'New conversation' })).toBeTruthy();
    expect(screen.getByLabelText('Search conversations')).toBeTruthy();
    expect(await screen.findByText('No conversations yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '새 대화' })).toBeNull();
  });

  /** 필터 라벨은 모듈 상수라, 문자열을 박아 두면 첫 언어에 굳는다 */
  it('보관 상태 필터 라벨도 표시 언어를 따른다', async () => {
    setLanguageInputs('en-US', null);
    mockConversations([]);
    renderList();

    const filter = await screen.findByLabelText('Archive filter');
    expect(filter.textContent).toContain('Active');
    expect(filter.textContent).toContain('Archived');
    expect(filter.textContent).toContain('All');
  });

  /** 항목 액션은 선택된 대화에만 뜬다 — 선택 상태로 렌더해야 그 이름을 볼 수 있다 */
  it('항목 액션의 접근성 이름도 영어로 나온다', async () => {
    setLanguageInputs('en-US', null);
    mockConversations([
      {
        id: 'conversation-1',
        type: 'GUIDELINE_QA',
        title: 'Chronic low back pain',
        status: 'ACTIVE',
        lastMessageAt: '2026-08-28T10:00:00.000Z',
        createdAt: '2026-08-28T10:00:00.000Z',
      },
    ]);
    renderList('conversation-1');

    expect(await screen.findByText('Chronic low back pain')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });
});
