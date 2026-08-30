// @vitest-environment happy-dom
// 화면 문구가 표시 언어를 따르는지 — 카탈로그 자체와 대표 화면 넷을 함께 본다
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientCreateForm } from '@/features/manage-patient/ui/patient-create-form';
import { ProfilePanel } from '@/features/auth/ui/profile-panel';
import { GuidelineListPanel } from '@/features/filter-guidelines/ui/guideline-list-panel';
import { UI_MESSAGES, formatMessage, formatMessageNodes, messagesFor } from './messages';
import { UI_LANG_STORAGE_KEY } from './ui-lang';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';

useMswServer();

function setLanguageInputs(navigatorLanguage: string, stored: string | null): void {
  stubNavigatorLanguage(navigatorLanguage);
  stubStoredUiLang(UI_LANG_STORAGE_KEY, stored);
}

beforeEach(() => {
  localStorage.clear();
  setLanguageInputs('ko-KR', null);
});

describe('문구 카탈로그', () => {
  /**
   * 키가 한쪽에만 있으면 그 자리가 `undefined`로 렌더돼 화면이 조용히 빈다.
   * 타입이 `Record<MessageKey, string>`이라 컴파일이 막지만, 런타임 값까지 확인해 둔다.
   */
  it('ko와 en의 키 집합이 정확히 같다', () => {
    expect(Object.keys(UI_MESSAGES.en).sort()).toEqual(Object.keys(UI_MESSAGES.ko).sort());
  });

  it('빈 문구가 없다 — 자리표시자가 남아 있으면 화면이 빈 채로 나간다', () => {
    for (const lang of ['ko', 'en'] as const) {
      const empty = Object.entries(UI_MESSAGES[lang])
        .filter(([, value]) => value.trim() === '')
        .map(([key]) => key);
      expect({ lang, empty }).toEqual({ lang, empty: [] });
    }
  });

  /** 어순이 다른 언어에서 자리가 빠지면 이름이 통째로 사라진다 */
  it('보간 자리를 가진 문구는 두 언어가 같은 자리를 갖는다', () => {
    const placeholders = (s: string): string[] =>
      [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(UI_MESSAGES.ko) as (keyof typeof UI_MESSAGES.ko)[]) {
      expect({ key, slots: placeholders(UI_MESSAGES.en[key]) }).toEqual({
        key,
        slots: placeholders(UI_MESSAGES.ko[key]),
      });
    }
  });

  it('formatMessage는 자리를 채우고, 모르는 자리는 그대로 남긴다', () => {
    expect(formatMessage('{a} 보관', { a: 'CASE-001' })).toBe('CASE-001 보관');
    expect(formatMessage('{a}/{b}', { a: '1' })).toBe('1/{b}');
  });

  it('formatMessageNodes는 자리에 엘리먼트를 끼운다 — 강조가 살아남는다', () => {
    renderWithProviders(
      <p>
        {formatMessageNodes(messagesFor('ko').removeConfirm, {
          name: <strong>김한의</strong>,
        })}
      </p>,
    );
    expect(screen.getByText('김한의').tagName).toBe('STRONG');
  });
});

describe('화면 문구가 표시 언어를 따른다', () => {
  it('환자 등록 폼', () => {
    setLanguageInputs('en-US', null);
    renderWithProviders(<PatientCreateForm onCreated={vi.fn()} />);

    expect(screen.getByText('Case label')).toBeTruthy();
    expect(screen.getByText('Clinical note')).toBeTruthy();
    expect(screen.queryByText('케이스 라벨')).toBeNull();
  });

  it('프로필 패널', () => {
    setLanguageInputs('en-US', null);
    renderWithProviders(
      <ProfilePanel
        me={{
          id: 'clinician-1',
          email: 'doctor@cure.test',
          displayName: 'Han',
          clinic: { id: 'clinic-1', name: 'Seoul Clinic' },
          verificationStatus: 'VERIFIED',
        }}
      />,
    );

    expect(screen.getByText('License verification')).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.queryByText('인증 완료')).toBeNull();
  });

  it('지침 목록 패널', async () => {
    setLanguageInputs('en-US', null);
    server.use(
      http.get('/api/v1/guidelines', () =>
        HttpResponse.json(envelope([], { size: 20, hasNext: false, nextCursor: null })),
      ),
    );
    renderWithProviders(<GuidelineListPanel onSelect={vi.fn()} />);

    expect(screen.getByLabelText('Search guidelines')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
    expect(screen.queryByLabelText('지침 검색')).toBeNull();
  });

  it('한국어 화면은 오늘 그대로다', () => {
    setLanguageInputs('ko-KR', null);
    renderWithProviders(<PatientCreateForm onCreated={vi.fn()} />);

    expect(screen.getByText('케이스 라벨')).toBeTruthy();
    expect(screen.queryByText('Case label')).toBeNull();
  });
});
