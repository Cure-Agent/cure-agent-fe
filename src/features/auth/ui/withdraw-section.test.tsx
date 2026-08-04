// @vitest-environment happy-dom
// 회원탈퇴 (BE spec 36) — 되돌릴 수 없으므로 확인이 먼저다.
// 이양은 이 화면의 동작이 아니다: 개설자는 409로 막히고 구성원 섹션으로 안내받는다.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, errorEnvelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { WithdrawSection } from './withdraw-section';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

useMswServer();

const ME = { id: 'me', displayName: '김한의', isOwner: true, joinedAt: '2026-07-01T00:00:00Z' };
const COLLEAGUE = {
  id: 'colleague',
  displayName: '이한의',
  isOwner: false,
  joinedAt: '2026-07-20T00:00:00Z',
};

const membersHandler = (members: unknown[]) =>
  http.get('/api/v1/clinic/members', () => HttpResponse.json(envelope(members)));

const LAST_MEMBER_WARNING = /환자·대화 기록이 모두 함께 삭제/;
const SHARED_ASSET_NOTE = /남은 구성원에게 그대로 남습니다/;

describe('회원탈퇴', () => {
  beforeEach(() => replaceMock.mockClear());

  it('확인을 거치기 전에는 탈퇴를 보내지 않는다', async () => {
    let deleteCalled = false;
    server.use(
      membersHandler([ME]),
      http.delete('/api/v1/auth/me', () => {
        deleteCalled = true;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<WithdrawSection meId="me" />);

    await user.click(screen.getByRole('button', { name: '회원탈퇴' }));

    expect(await screen.findByText('정말 탈퇴하시겠습니까?')).toBeVisible();
    expect(deleteCalled).toBe(false);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('마지막 구성원에게는 한의원 기록까지 사라진다고 알린다', async () => {
    server.use(membersHandler([ME]));

    const user = userEvent.setup();
    renderWithProviders(<WithdrawSection meId="me" />);

    await user.click(screen.getByRole('button', { name: '회원탈퇴' }));

    expect(await screen.findByText(LAST_MEMBER_WARNING)).toBeVisible();
    expect(screen.queryByText(SHARED_ASSET_NOTE)).toBeNull();
  });

  it('동료가 남아 있으면 진료 기록이 한의원에 남는다고 알린다', async () => {
    server.use(membersHandler([ME, COLLEAGUE]));

    const user = userEvent.setup();
    renderWithProviders(<WithdrawSection meId="me" />);
    await user.click(screen.getByRole('button', { name: '회원탈퇴' }));

    expect(await screen.findByText(SHARED_ASSET_NOTE)).toBeVisible();
    expect(screen.queryByText(LAST_MEMBER_WARNING)).toBeNull();
  });

  it('탈퇴에 성공하면 로그인 화면으로 대체한다 — 돌아올 세션이 없다', async () => {
    server.use(
      membersHandler([ME]),
      http.delete('/api/v1/auth/me', () => HttpResponse.json(envelope(null))),
    );

    const user = userEvent.setup();
    renderWithProviders(<WithdrawSection meId="me" />);

    await user.click(screen.getByRole('button', { name: '회원탈퇴' }));
    await user.click(await screen.findByRole('button', { name: '탈퇴하기' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
  });
});

describe('동료가 남은 개설자의 탈퇴', () => {
  beforeEach(() => replaceMock.mockClear());

  const blockedHandlers = [
    membersHandler([ME, COLLEAGUE]),
    http.delete('/api/v1/auth/me', () =>
      HttpResponse.json(
        errorEnvelope(
          'CLINIC_OWNER_MUST_TRANSFER',
          '개설자는 먼저 다른 구성원에게 권한을 넘겨야 탈퇴할 수 있습니다.',
        ),
        { status: 409 },
      ),
    ),
  ];

  const reachBlock = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.click(screen.getByRole('button', { name: '회원탈퇴' }));
    await user.click(await screen.findByRole('button', { name: '탈퇴하기' }));
  };

  it('409의 서버 문구를 그대로 보여준다', async () => {
    server.use(...blockedHandlers);

    const user = userEvent.setup();
    renderWithProviders(<WithdrawSection meId="me" />);
    await reachBlock(user);

    expect(
      await screen.findByText('개설자는 먼저 다른 구성원에게 권한을 넘겨야 탈퇴할 수 있습니다.'),
    ).toBeVisible();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('여기서 이양시키지 않고 구성원 섹션으로 안내한다', async () => {
    server.use(...blockedHandlers);

    const user = userEvent.setup();
    renderWithProviders(<WithdrawSection meId="me" />);
    await reachBlock(user);

    expect(await screen.findByText(/개설자 권한 넘기기/)).toBeVisible();
    // 이양은 「함께 일하는 사람」의 상시 동작이다 — 탈퇴 화면은 대상을 고르게 하지 않는다
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /권한 넘기/ })).toBeNull();
  });

  it('막힌 뒤에도 취소로 되돌아갈 수 있다', async () => {
    server.use(...blockedHandlers);

    const user = userEvent.setup();
    renderWithProviders(<WithdrawSection meId="me" />);
    await reachBlock(user);
    await screen.findByText(/개설자 권한 넘기기/);

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.getByRole('button', { name: '회원탈퇴' })).toBeVisible();
    expect(screen.queryByText(/개설자 권한 넘기기/)).toBeNull();
  });
});
