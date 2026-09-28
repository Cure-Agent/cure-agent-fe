// @vitest-environment happy-dom
// docs/specs/56 FE 수용 기준 26 ⑵ 동결 테스트 — 구현 중 수정 금지

import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import type { ConversationSummary } from '../api/conversation.api';
import { ConversationList } from './conversation-list';

useMswServer();

const PAGE = { size: 20, hasNext: false, nextCursor: null };
const GUIDANCE_CONVERSATION_ID = 'conversation-guidance-title';
const KO_TITLE = 'CASE-001 임상 참고 (8/4 14:30)';

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

describe('ConversationList 환자 맞춤 제목은 저장값 그대로', () => {
  it('기준 26 ⑵: 영문 화면의 환자 맞춤 행은 FE 틀 제목을 저장값 그대로 그린다', async () => {
    setLanguageInputs('en-US', 'en');
    mockConversations([conversation(KO_TITLE, 'PATIENT_GUIDANCE')]);
    renderList();

    const list = await screen.findByRole('list');
    const titleButton = await within(list).findByRole('button', {
      name: 'CASE-001 임상 참고 (8/4 14:30)',
    });
    expect(titleButton).toHaveAccessibleName('CASE-001 임상 참고 (8/4 14:30)');
    expect(titleButton.textContent).toBe('CASE-001 임상 참고 (8/4 14:30)');
    expect(list).not.toHaveTextContent('Clinical guidance');
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
