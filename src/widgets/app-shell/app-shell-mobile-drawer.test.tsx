// mobile-chat-layout 수용 기준 동결 테스트. 구현 중 수정 금지.
// @vitest-environment happy-dom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  startTourPath,
  TOUR_HIGHLIGHT_CLASS,
} from '@/features/onboarding-tour/model/tour-state';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { AppShell } from './app-shell';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/assistant',
  useRouter: () => ({ replace: replaceMock }),
}));

useMswServer();

beforeEach(() => {
  localStorage.clear();
  replaceMock.mockClear();
});

const ME = {
  id: 'clinician-1',
  email: 'doctor@cure.test',
  displayName: '김한의',
  clinic: { id: 'clinic-1', name: '서울한의원' },
  verificationStatus: 'VERIFIED',
} as const;

function renderShell() {
  return renderWithProviders(
    <AppShell me={ME}>
      <p>본문</p>
    </AppShell>,
  );
}

describe('AppShell 모바일 메뉴 드로어', () => {
  it('C-1: 기본 렌더에는 여는 버튼이 있고 드로어는 없다', () => {
    renderShell();

    expect(screen.getByRole('button', { name: '메뉴 열기' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: '메뉴' })).toBeNull();
  });

  it('C-2: 드로어에 탐색 링크·프로필·로그아웃·언어 선택이 있다', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: '메뉴 열기' }));

    const drawer = within(screen.getByRole('dialog', { name: '메뉴' }));
    for (const [name, href] of [
      ['어시스턴트', '/assistant'],
      ['지침', '/guidelines'],
      ['환자', '/patients'],
      ['내 프로필', '/profile'],
    ] as const) {
      expect(drawer.getByRole('link', { name })).toHaveAttribute('href', href);
    }
    expect(drawer.getByRole('button', { name: '로그아웃' })).toBeTruthy();
    const languages = within(drawer.getByRole('group', { name: '표시 언어' }));
    expect(languages.getByRole('button', { name: 'English' })).toBeTruthy();
  });

  it('C-3: 드로어 안의 닫기 버튼으로 닫는다', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: '메뉴 열기' }));
    const drawer = within(screen.getByRole('dialog', { name: '메뉴' }));

    await user.click(drawer.getByRole('button', { name: '메뉴 닫기' }));

    expect(screen.queryByRole('dialog', { name: '메뉴' })).toBeNull();
  });

  it('C-4: Esc로 열린 드로어를 닫는다', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: '메뉴 열기' }));
    expect(screen.getByRole('dialog', { name: '메뉴' })).toBeTruthy();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: '메뉴' })).toBeNull();
  });

  it('C-5: 배경을 누르면 열린 드로어를 닫는다', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: '메뉴 열기' }));
    expect(screen.getByRole('dialog', { name: '메뉴' })).toBeTruthy();

    await user.click(screen.getByTestId('mobile-nav-backdrop'));

    expect(screen.queryByRole('dialog', { name: '메뉴' })).toBeNull();
  });

  it('C-6: 열면 닫기 버튼으로, 닫으면 열기 버튼으로 초점이 이동한다', async () => {
    const user = userEvent.setup();
    renderShell();
    const opener = screen.getByRole('button', { name: '메뉴 열기' });
    await user.click(opener);
    const drawer = within(screen.getByRole('dialog', { name: '메뉴' }));
    const closer = drawer.getByRole('button', { name: '메뉴 닫기' });

    await waitFor(() => expect(document.activeElement).toBe(closer));
    await user.click(closer);

    expect(screen.queryByRole('dialog', { name: '메뉴' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('C-7: 드로어 로그아웃은 API를 호출하고 로그인으로 이동한다', async () => {
    let logoutCalled = false;
    server.use(
      http.post('/api/v1/auth/logout', () => {
        logoutCalled = true;
        return Response.json(envelope(null));
      }),
    );
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: '메뉴 열기' }));
    const drawer = within(screen.getByRole('dialog', { name: '메뉴' }));

    await user.click(drawer.getByRole('button', { name: '로그아웃' }));

    await waitFor(() => expect(logoutCalled).toBe(true));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
  });

  it('C-8: 드로어는 사이드바 취향을 건드리지 않고 열림 상태를 저장하지 않는다', async () => {
    const user = userEvent.setup();
    const first = renderShell();
    await user.click(screen.getByRole('button', { name: '메뉴 열기' }));
    const drawer = within(screen.getByRole('dialog', { name: '메뉴' }));
    expect(localStorage.getItem('cure-agent:sidebar-open')).toBeNull();

    await user.click(drawer.getByRole('button', { name: '메뉴 닫기' }));
    expect(screen.queryByRole('dialog', { name: '메뉴' })).toBeNull();
    expect(localStorage.getItem('cure-agent:sidebar-open')).toBeNull();

    await user.click(screen.getByRole('button', { name: '메뉴 열기' }));
    expect(screen.getByRole('dialog', { name: '메뉴' })).toBeTruthy();
    first.unmount();
    renderShell();

    expect(screen.queryByRole('dialog', { name: '메뉴' })).toBeNull();
  });

  it('C-9: 환자 경로 첫 단계는 메뉴 열기와 드로어의 환자 링크를 강조한다', async () => {
    const user = userEvent.setup();
    startTourPath('patient');
    renderShell();
    const opener = screen.getByRole('button', { name: '메뉴 열기' });
    expect(opener.className).toContain(TOUR_HIGHLIGHT_CLASS);

    await user.click(opener);

    const drawer = within(screen.getByRole('dialog', { name: '메뉴' }));
    expect(drawer.getByRole('link', { name: '환자' }).className).toContain(
      TOUR_HIGHLIGHT_CLASS,
    );
  });

  it('C-10: 일반 경로 첫 단계는 메뉴 열기를 강조하지 않는다', () => {
    startTourPath('general');
    renderShell();

    expect(screen.getByRole('button', { name: '메뉴 열기' }).className).not.toContain(
      TOUR_HIGHLIGHT_CLASS,
    );
  });
});
