// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/shared/test/render';
import { AppShell } from './app-shell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/assistant',
  useRouter: () => ({ replace: vi.fn() }),
}));

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
      ['히스토리', '/history'],
    ] as const) {
      expect(rail.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
    // usePathname mock이 /assistant 이므로 어시스턴트가 현재 페이지로 표시된다
    expect(rail.getByRole('link', { name: '어시스턴트' })).toHaveAttribute('aria-current', 'page');
    expect(rail.getByRole('link', { name: '지침' })).not.toHaveAttribute('aria-current');
  });
});
