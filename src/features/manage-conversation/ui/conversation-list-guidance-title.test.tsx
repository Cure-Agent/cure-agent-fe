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
const GUIDANCE_CONVERSATION_ID = 'conversation-guidance-title';
const KO_TITLE = 'CASE-001 임상 참고 (8/4 14:30)';
const EN_TITLE = 'CASE-001 Clinical guidance (8/4 14:30)';

function conversation(
  title: string,
  type: ConversationSummary['type'] = 'PATIENT_GUIDANCE',
): ConversationSummary {
  return {
    id: GUIDANCE_CONVERSATION_ID,
    type,
    patientId: type === 'PATIENT_GUIDANCE' ? 'patient-1' : undefined,
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

describe('ConversationList 환자 맞춤 제목의 표시 언어', () => {
  it('한국어로 만든 환자 맞춤 제목을 영문 화면에서 영문 라벨로 그린다', async () => {
    setLanguageInputs('en-US', 'en');
    mockConversations([conversation(KO_TITLE)]);
    renderList();

    const list = await screen.findByRole('list');
    expect(await within(list).findByRole('button', { name: EN_TITLE })).toHaveTextContent(
      EN_TITLE,
    );
    expect(within(list).queryByText('임상 참고')).not.toBeInTheDocument();
  });

  it('영문으로 만든 환자 맞춤 제목을 한국어 화면에서 한국어 라벨로 그린다', async () => {
    setLanguageInputs('ko-KR', 'ko');
    mockConversations([conversation(EN_TITLE)]);
    renderList();

    const list = await screen.findByRole('list');
    expect(await within(list).findByRole('button', { name: KO_TITLE })).toHaveTextContent(
      KO_TITLE,
    );
  });

  it('표시 언어를 바꾸면 라벨만 따라 바뀌고 케이스 라벨과 시각은 그대로다', async () => {
    setLanguageInputs('ko-KR', 'ko');
    mockConversations([conversation(KO_TITLE)]);
    renderList();

    const list = await screen.findByRole('list');
    await within(list).findByRole('button', { name: KO_TITLE });

    act(() => {
      setUiLang('en');
    });

    await waitFor(() => {
      expect(within(list).getByRole('button', { name: EN_TITLE })).toHaveTextContent(
        'CASE-001 Clinical guidance (8/4 14:30)',
      );
      expect(within(list).queryByRole('button', { name: KO_TITLE })).not.toBeInTheDocument();
    });
  });

  it('환자 맞춤 대화의 이름 변경을 열면 입력 초기값이 화면 언어의 제목이다', async () => {
    setLanguageInputs('en-US', 'en');
    mockConversations([conversation(KO_TITLE)]);
    const user = userEvent.setup();
    renderList(GUIDANCE_CONVERSATION_ID);

    const list = await screen.findByRole('list');
    await within(list).findByRole('button', { name: EN_TITLE });
    await user.click(screen.getByRole('button', { name: 'Rename' }));

    expect(await screen.findByRole('textbox', { name: 'Conversation title' })).toHaveValue(
      EN_TITLE,
    );
  });

  it('같은 모양이어도 일반 질의 대화의 제목은 저장된 그대로 그린다', async () => {
    setLanguageInputs('en-US', 'en');
    mockConversations([conversation(KO_TITLE, 'GUIDELINE_QA')]);
    renderList();

    const list = await screen.findByRole('list');
    expect(await within(list).findByRole('button', { name: KO_TITLE })).toHaveTextContent(
      KO_TITLE,
    );
  });

  it('환자 맞춤 대화라도 사람이 손수 붙인 이름은 번역하지 않는다', async () => {
    setLanguageInputs('en-US', 'en');
    const renamed = 'CASE-001 임상 참고 (재검토)';
    mockConversations([conversation(renamed)]);
    renderList();

    const list = await screen.findByRole('list');
    expect(await within(list).findByRole('button', { name: renamed })).toHaveTextContent(
      renamed,
    );
  });
});
