// @vitest-environment happy-dom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { AppShell } from './app-shell';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/assistant',
  useRouter: () => ({ replace: replaceMock }),
}));

useMswServer();

// 사이드바 상태가 저장소에 남으므로, 닫는 테스트가 다음 테스트의 초기 상태를 바꾸지 않게 비운다
beforeEach(() => {
  replaceMock.mockClear();
  localStorage.clear();
});

const ME = {
  id: 'clinician-1',
  email: 'doctor@cure.test',
  displayName: '김한의',
  clinic: { id: 'clinic-1', name: '서울한의원' },
  verificationStatus: 'VERIFIED',
} as const;

describe('AppShell 사이드바 토글', () => {
  it('기본은 열림 — 닫으면 inert로 비활성화되고, 열기 버튼으로 되돌린다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AppShell me={ME}>
        <p>본문</p>
      </AppShell>,
    );

    // 기본 상태: 열려 있고, 여는 버튼은 없다
    const sidebar = screen.getByRole('complementary');
    expect(sidebar).not.toHaveAttribute('inert');
    expect(screen.queryByRole('button', { name: '사이드바 열기' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '사이드바 닫기' }));

    // 닫힘: 화면 밖 내비게이션이 포커스·접근 트리에서 빠져야 한다
    expect(sidebar).toHaveAttribute('inert');
    expect(screen.getByText('본문')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '사이드바 열기' }));

    expect(sidebar).not.toHaveAttribute('inert');
    expect(screen.queryByRole('button', { name: '사이드바 열기' })).toBeNull();
  });

  it('접어 둔 선택을 다음 방문에도 기억한다 — 세션이 아니라 그 사람의 화면에 맞춘 취향이기 때문이다', async () => {
    const user = userEvent.setup();
    const first = renderWithProviders(
      <AppShell me={ME}>
        <p>본문</p>
      </AppShell>,
    );

    await user.click(screen.getByRole('button', { name: '사이드바 닫기' }));
    first.unmount();

    // 새로고침·재로그인에 해당한다. 첫 렌더부터 접혀 있어야 열림→접힘이 번쩍이지 않는다
    renderWithProviders(
      <AppShell me={ME}>
        <p>본문</p>
      </AppShell>,
    );

    expect(screen.getByRole('complementary')).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: '사이드바 열기' })).toBeVisible();
  });

  it('저장소를 쓸 수 없어도 화면은 살아 있다 — 사파리 프라이빗 등에서 접근 자체가 throw한다', async () => {
    const user = userEvent.setup();
    // 읽기·쓰기 모두 막힌 상황: 렌더가 죽으면 앱 전체가 빈 화면이 된다
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    renderWithProviders(
      <AppShell me={ME}>
        <p>본문</p>
      </AppShell>,
    );

    // 읽지 못하면 기본값 열림으로 가고, 저장하지 못해도 이번 방문의 토글은 동작한다
    expect(screen.getByRole('complementary')).not.toHaveAttribute('inert');
    await user.click(screen.getByRole('button', { name: '사이드바 닫기' }));
    expect(screen.getByRole('complementary')).toHaveAttribute('inert');

    vi.restoreAllMocks();
  });

  it('닫힘 상태에는 아이콘 레일이 나타나 열지 않고도 각 화면으로 이동할 수 있다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AppShell me={ME}>
        <p>본문</p>
      </AppShell>,
    );

    // 열림 상태에는 레일이 없다
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '사이드바 닫기' }));

    // 본 사이드바 링크는 inert 상태로 DOM에 남으므로 레일 범위로 한정해 조회한다
    const rail = within(screen.getByRole('navigation', { name: '주요 메뉴' }));
    for (const [label, href] of [
      ['어시스턴트', '/assistant'],
      ['지침', '/guidelines'],
      ['환자', '/patients'],
    ] as const) {
      expect(rail.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
    // usePathname mock이 /assistant 이므로 어시스턴트가 현재 페이지로 표시된다
    expect(rail.getByRole('link', { name: '어시스턴트' })).toHaveAttribute('aria-current', 'page');
    expect(rail.getByRole('link', { name: '지침' })).not.toHaveAttribute('aria-current');
  });

  it('닫힘 상태에서도 프로필·로그아웃이 남는다 — 계정 블록이 사이드바와 함께 사라지기 때문이다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AppShell me={ME}>
        <p>본문</p>
      </AppShell>,
    );

    await user.click(screen.getByRole('button', { name: '사이드바 닫기' }));

    // 계정 동작은 '주요 메뉴' 밖에 있다 — 레일 쪽만 남기고 inert 사이드바 쪽은 제외한다
    const railProfile = screen
      .getAllByRole('link', { name: '내 프로필' })
      .find((link) => !link.closest('aside'));
    expect(railProfile).toHaveAttribute('href', '/profile');
    expect(
      screen.getAllByRole('button', { name: '로그아웃' }).some((btn) => !btn.closest('aside')),
    ).toBe(true);

    const rail = within(screen.getByRole('navigation', { name: '주요 메뉴' }));
    expect(rail.queryByRole('link', { name: '내 프로필' })).toBeNull();
    expect(rail.queryByRole('button', { name: '로그아웃' })).toBeNull();
  });

  it('레일 로그아웃도 열림 상태와 같은 로그아웃 경로를 탄다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AppShell me={ME}>
        <p>본문</p>
      </AppShell>,
    );

    let logoutCalled = false;
    server.use(
      http.post('/api/v1/auth/logout', () => {
        logoutCalled = true;
        return Response.json(envelope(null));
      }),
    );

    await user.click(screen.getByRole('button', { name: '사이드바 닫기' }));

    const railLogout = screen
      .getAllByRole('button', { name: '로그아웃' })
      .find((btn) => !btn.closest('aside'));
    await user.click(railLogout as HTMLElement);

    await waitFor(() => expect(logoutCalled).toBe(true));

    // 로그아웃 성공 후 /login 으로 보낸다 (열림 상태 버튼과 같은 handleLogout)
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
  });
});

describe('AppShell 계정 영역', () => {
  it('계정 정보 블록이 프로필 진입점이고, 로그아웃은 사이드바에 그대로 남는다', () => {
    renderWithProviders(
      <AppShell me={ME}>
        <p>본문</p>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: '내 프로필' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeVisible();
  });

  it('되돌릴 수 없는 계정 동작을 사이드바에 두지 않는다 — 로그아웃 오클릭을 막는 배치다', () => {
    renderWithProviders(
      <AppShell me={ME}>
        <p>본문</p>
      </AppShell>,
    );

    expect(screen.queryByRole('button', { name: /회원탈퇴|탈퇴|계정 삭제/ })).toBeNull();
  });
});
