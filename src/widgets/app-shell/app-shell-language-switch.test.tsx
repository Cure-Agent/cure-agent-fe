// @vitest-environment happy-dom
// 표시 언어 전환 — 자동 판정만으로는 못 바꾸는 사람에게 되돌릴 길을 준다
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';
import { useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { AppShell } from './app-shell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/assistant',
  useRouter: () => ({ replace: vi.fn() }),
}));

useMswServer();

const ME = {
  id: 'clinician-1',
  email: 'doctor@cure.test',
  displayName: '김한의',
  clinic: { id: 'clinic-1', name: '서울한의원' },
  verificationStatus: 'VERIFIED',
} as const;

const SIDEBAR_STORAGE_KEY = 'cure-agent:sidebar-open';

function setLanguageInputs(navigatorLanguage: string, stored: string | null): void {
  stubNavigatorLanguage(navigatorLanguage);
  stubStoredUiLang(UI_LANG_STORAGE_KEY, stored);
}

function renderShell(): void {
  renderWithProviders(
    <AppShell me={ME}>
      <div />
    </AppShell>,
  );
}

beforeEach(() => {
  localStorage.clear();
  setLanguageInputs('ko-KR', null);
});

describe('AppShell 표시 언어 전환', () => {
  /**
   * 데모의 실제 시나리오는 「한국어 로케일 노트북으로 영어권 방문자에게 시연」이다.
   * 그때 화면은 전부 한국어이므로, 라벨을 현재 UI 언어로 번역하면 한국어를 못 읽는 사람이
   * 자기 항목을 찾을 수 없다 — 각 항목은 **그 언어 자체로** 적혀 있어야 한다.
   */
  it('선택지는 언제나 그 언어 자체로 적힌다 — 한국어 화면에서도 English를 찾을 수 있다', async () => {
    setLanguageInputs('ko-KR', null);
    renderShell();

    const group = await screen.findByRole('group', { name: '표시 언어' });
    expect(within(group).getByRole('button', { name: '한국어' })).toBeTruthy();
    expect(within(group).getByRole('button', { name: 'English' })).toBeTruthy();
  });

  it('현재 언어가 눌린 상태로 표시된다', async () => {
    setLanguageInputs('ko-KR', null);
    renderShell();

    const group = await screen.findByRole('group', { name: '표시 언어' });
    expect(within(group).getByRole('button', { name: '한국어' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(group).getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('English를 누르면 화면 문구가 즉시 영어로 바뀐다', async () => {
    setLanguageInputs('ko-KR', null);
    const user = userEvent.setup();
    renderShell();

    expect(await screen.findByRole('link', { name: '어시스턴트' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(screen.getByRole('link', { name: 'Assistant' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: '어시스턴트' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy();
  });

  /** 고른 값이 남지 않으면 새로고침마다 브라우저 언어로 되돌아가 선택이 무의미해진다 */
  it('고른 언어가 저장되어 다음 방문에도 자동 판정을 이긴다', async () => {
    setLanguageInputs('ko-KR', null);
    const user = userEvent.setup();
    renderShell();

    await user.click(await screen.findByRole('button', { name: 'English' }));
    expect(localStorage.getItem(UI_LANG_STORAGE_KEY)).toBe('en');

    // 새로고침 = 다시 마운트. navigator는 여전히 ko-KR이지만 고른 값이 이긴다
    cleanup();
    renderShell();
    expect(await screen.findByRole('link', { name: 'Assistant' })).toBeTruthy();
  });

  it('영문 화면에서 한국어로 되돌릴 수 있다 — 전환은 양방향이다', async () => {
    setLanguageInputs('en-US', null);
    const user = userEvent.setup();
    renderShell();

    expect(await screen.findByRole('link', { name: 'Assistant' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '한국어' }));

    expect(screen.getByRole('link', { name: '어시스턴트' })).toBeTruthy();
    expect(localStorage.getItem(UI_LANG_STORAGE_KEY)).toBe('ko');
  });

  /**
   * 접힘 레일은 폭이 56px뿐이라 두 항목을 나란히 둘 수 없다. 현재 코드를 보여주고
   * 누르면 넘어가되, 접근성 이름은 **넘어갈 대상**을 말해야 「지금 이것」과 갈리지 않는다.
   */
  it('접힘 레일에서도 전환할 수 있고, 접근성 이름이 넘어갈 언어를 말한다', async () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'false');
    setLanguageInputs('ko-KR', null);
    const user = userEvent.setup();
    renderShell();

    const toggle = await screen.findByRole('button', { name: '영어로 전환' });
    expect(toggle.textContent).toBe('KO');

    await user.click(toggle);

    const switched = screen.getByRole('button', { name: 'Switch to Korean' });
    expect(switched.textContent).toBe('EN');
    expect(screen.getByRole('navigation', { name: 'Main menu' })).toBeTruthy();
  });
});
