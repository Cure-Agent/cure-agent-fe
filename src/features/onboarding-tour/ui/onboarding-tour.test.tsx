// @vitest-environment happy-dom
// 환영 모달에서 경로를 고르면 진행 카드가 그 경로를 안내한다 — 닫으면 다시 뜨지 않는다
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';
import { TOUR_STORAGE_KEY, scheduleWelcomeTour, startTourPath } from '../model/tour-state';
import { OnboardingTour } from './onboarding-tour';

// 진행 카드는 「지금 이 화면에서 되는 단계인가」를 pathname으로 가른다
const pathnameMock = vi.hoisted(() => vi.fn<() => string>(() => '/assistant'));
vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}));

beforeEach(() => {
  localStorage.clear();
  pathnameMock.mockReturnValue('/assistant');
});

describe('OnboardingTour', () => {
  it('예약이 없으면 아무것도 그리지 않는다 — 기존 사용자의 화면은 오늘 그대로다', () => {
    const { container } = renderWithProviders(<OnboardingTour />);
    expect(container).toBeEmptyDOMElement();
  });

  it('가입 직후에는 두 경로를 고르는 모달이 뜬다', () => {
    scheduleWelcomeTour();
    renderWithProviders(<OnboardingTour />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: /지침에 바로 질문하기/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /가상 환자로 맞춤 답변 받기/ })).toBeTruthy();
  });

  it('경로를 고르면 모달이 닫히고 첫 단계를 안내한다', async () => {
    const user = userEvent.setup();
    scheduleWelcomeTour();
    renderWithProviders(<OnboardingTour />);

    await user.click(screen.getByRole('button', { name: /지침에 바로 질문하기/ }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('새 대화 만들기')).toBeTruthy();
    expect(screen.getByText(/일반 질의 · 1\/4/)).toBeTruthy();
  });

  it('건너뛰면 저장된 값까지 지운다 — 새로고침해도 되살아나지 않는다', async () => {
    const user = userEvent.setup();
    startTourPath('general');
    renderWithProviders(<OnboardingTour />);

    await user.click(screen.getByRole('button', { name: '건너뛰기' }));

    await waitFor(() => expect(screen.queryByText('새 대화 만들기')).toBeNull());
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBeNull();
  });

  it('나중에 하기로 모달을 닫아도 마찬가지다', async () => {
    const user = userEvent.setup();
    scheduleWelcomeTour();
    renderWithProviders(<OnboardingTour />);

    await user.click(screen.getByRole('button', { name: '나중에 하기' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBeNull();
  });

  /**
   * 환자 맞춤 경로는 세 화면을 건너다닌다 — 짚을 요소가 없는 화면에서는 링만 사라져
   * 「무엇을 하라는 건지 모르겠는 카드」가 남는다. 그 자리를 이동 링크가 메운다.
   */
  it('그 단계를 할 수 없는 화면에서는 이동 링크를 대신 띄운다', () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'patient:1'); // 환자 고르기 — /patients에서만 된다
    pathnameMock.mockReturnValue('/assistant');
    renderWithProviders(<OnboardingTour />);

    expect(screen.getByRole('link', { name: '환자 화면으로 이동' })).toBeTruthy();
  });

  it('그 화면에 와 있으면 이동 링크를 띄우지 않는다', () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'patient:1');
    pathnameMock.mockReturnValue('/patients/patient-1'); // 접두사라 상세까지 같은 화면으로 본다
    renderWithProviders(<OnboardingTour />);

    expect(screen.queryByRole('link', { name: '환자 화면으로 이동' })).toBeNull();
  });

  it('한 경로를 마치면 다른 경로를 권한다', async () => {
    const user = userEvent.setup();
    localStorage.setItem(TOUR_STORAGE_KEY, 'general:done');
    renderWithProviders(<OnboardingTour />);

    expect(screen.getByText('둘러보기를 마쳤습니다')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '이어서 해보기' }));

    expect(await screen.findByText('환자 화면 열기')).toBeTruthy();
  });

  it('표시 언어를 따른다', () => {
    stubNavigatorLanguage('en-US');
    stubStoredUiLang(UI_LANG_STORAGE_KEY, null);
    scheduleWelcomeTour();
    renderWithProviders(<OnboardingTour />);

    expect(screen.getByText('Get started with Cure Agent')).toBeTruthy();
    expect(screen.queryByText('Cure Agent 시작하기')).toBeNull();
  });
});
