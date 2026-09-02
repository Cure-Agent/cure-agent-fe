// @vitest-environment happy-dom
// 공용 표시 언어 전환 — 사람이 고른 언어와 접근 가능한 상태를 컴포넌트 경계에서 동결한다
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';
import { useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { LanguageRailToggle, LanguageSwitch } from './language-switch';

useMswServer();

function setLanguageInputs(navigatorLanguage: string, stored: string | null): void {
  stubNavigatorLanguage(navigatorLanguage);
  stubStoredUiLang(UI_LANG_STORAGE_KEY, stored);
}

function renderLanguageSwitch(className?: string): void {
  renderWithProviders(<LanguageSwitch className={className} />);
}

function renderLanguageRailToggle(): void {
  renderWithProviders(<LanguageRailToggle />);
}

beforeEach(() => {
  localStorage.clear();
  setLanguageInputs('ko-KR', null);
});

describe('공용 표시 언어 전환 (수용 기준 1~9)', () => {
  it('기준 1: 그룹의 접근 이름은 현재 표시 언어의 displayLanguage 문구다', async () => {
    setLanguageInputs('ko-KR', null);
    renderLanguageSwitch();

    expect(await screen.findByRole('group', { name: '표시 언어' })).toBeTruthy();

    cleanup();
    setLanguageInputs('en-US', null);
    renderLanguageSwitch();

    expect(await screen.findByRole('group', { name: 'Display language' })).toBeTruthy();
  });

  it('기준 2: 한국어 화면과 영문 화면 모두 선택지 라벨은 한국어·English 그대로다', async () => {
    setLanguageInputs('ko-KR', null);
    renderLanguageSwitch();

    const koreanGroup = await screen.findByRole('group');
    expect(within(koreanGroup).getAllByRole('button').map((button) => button.textContent)).toEqual([
      '한국어',
      'English',
    ]);

    cleanup();
    setLanguageInputs('en-US', null);
    renderLanguageSwitch();

    const englishGroup = await screen.findByRole('group');
    expect(within(englishGroup).getAllByRole('button').map((button) => button.textContent)).toEqual([
      '한국어',
      'English',
    ]);
  });

  it('기준 3: 현재 언어만 aria-pressed=true이고 다른 언어는 false다', async () => {
    setLanguageInputs('ko-KR', null);
    renderLanguageSwitch();

    const koreanGroup = await screen.findByRole('group');
    expect(
      within(koreanGroup).getByRole('button', { name: '한국어' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      within(koreanGroup).getByRole('button', { name: 'English' }).getAttribute('aria-pressed'),
    ).toBe('false');

    cleanup();
    setLanguageInputs('en-US', null);
    renderLanguageSwitch();

    const englishGroup = await screen.findByRole('group');
    expect(
      within(englishGroup).getByRole('button', { name: '한국어' }).getAttribute('aria-pressed'),
    ).toBe('false');
    expect(
      within(englishGroup).getByRole('button', { name: 'English' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('기준 4: 다른 언어를 누르면 선택값을 표시 언어 저장 키에 기록한다', async () => {
    setLanguageInputs('ko-KR', null);
    const user = userEvent.setup();
    renderLanguageSwitch();

    await user.click(await screen.findByRole('button', { name: 'English' }));

    expect(localStorage.getItem(UI_LANG_STORAGE_KEY)).toBe('en');
  });

  it('기준 5: English를 누른 즉시 그룹의 접근 이름도 영어로 바뀐다', async () => {
    setLanguageInputs('ko-KR', null);
    const user = userEvent.setup();
    renderLanguageSwitch();

    expect(await screen.findByRole('group', { name: '표시 언어' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(await screen.findByRole('group', { name: 'Display language' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: '표시 언어' })).toBeNull();
  });

  it('기준 6: 영문 화면에서 한국어로 되돌아오며 ko를 저장한다', async () => {
    setLanguageInputs('en-US', null);
    const user = userEvent.setup();
    renderLanguageSwitch();

    expect(await screen.findByRole('group', { name: 'Display language' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '한국어' }));

    expect(await screen.findByRole('group', { name: '표시 언어' })).toBeTruthy();
    expect(localStorage.getItem(UI_LANG_STORAGE_KEY)).toBe('ko');
  });

  it('기준 7: 호출부의 className은 role=group 요소에 실린다', async () => {
    setLanguageInputs('ko-KR', null);
    renderLanguageSwitch('acceptance-layout-class');

    const group = await screen.findByRole('group', { name: '표시 언어' });
    expect(group.classList.contains('acceptance-layout-class')).toBe(true);
  });

  it('기준 8: 레일은 현재 코드와 넘어갈 언어의 접근 이름을 각각 보여준다', async () => {
    setLanguageInputs('ko-KR', null);
    renderLanguageRailToggle();

    const koreanToggle = await screen.findByRole('button');
    expect(koreanToggle.textContent).toBe('KO');
    expect(koreanToggle).toHaveAccessibleName('영어로 전환');

    cleanup();
    setLanguageInputs('en-US', null);
    renderLanguageRailToggle();

    const englishToggle = await screen.findByRole('button');
    expect(englishToggle.textContent).toBe('EN');
    expect(englishToggle).toHaveAccessibleName('Switch to Korean');
  });

  it('기준 9: 레일을 누르면 EN과 Switch to Korean 상태로 전환된다', async () => {
    setLanguageInputs('ko-KR', null);
    const user = userEvent.setup();
    renderLanguageRailToggle();

    await user.click(await screen.findByRole('button', { name: '영어로 전환' }));

    const switched = await screen.findByRole('button', { name: 'Switch to Korean' });
    expect(switched.textContent).toBe('EN');
    expect(switched).toHaveAccessibleName('Switch to Korean');
  });
});
