// @vitest-environment happy-dom
// 회원탈퇴와 개설자 이양 (BE spec 36) — 되돌릴 수 없으므로 확인이 먼저고,
// 개설자는 남은 동료가 있으면 409로 막힌 뒤 그 자리에서 권한을 넘긴다
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

describe('개설자 이양', () => {
  beforeEach(() => replaceMock.mockClear());

  it('409를 만나면 서버 안내와 함께 넘길 상대를 고르게 한다', async () => {
    server.use(
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
    );

    const user = userEvent.setup();
    renderWithProviders(<WithdrawSection meId="me" />);

    await user.click(screen.getByRole('button', { name: '회원탈퇴' }));
    await user.click(await screen.findByRole('button', { name: '탈퇴하기' }));

    // 서버 문구가 다음 행동을 담고 있어 그대로 쓴다 (§10.1)
    expect(
      await screen.findByText('개설자는 먼저 다른 구성원에게 권한을 넘겨야 탈퇴할 수 있습니다.'),
    ).toBeVisible();
    expect(await screen.findByRole('radio', { name: /이한의/ })).toBeVisible();
    // 자기 자신은 넘길 상대가 아니다
    expect(screen.queryByRole('radio', { name: /김한의/ })).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('상대를 고르기 전에는 이양 버튼을 누를 수 없다', async () => {
    server.use(
      membersHandler([ME, COLLEAGUE]),
      http.delete('/api/v1/auth/me', () =>
        HttpResponse.json(errorEnvelope('CLINIC_OWNER_MUST_TRANSFER', '권한을 넘겨주세요.'), {
          status: 409,
        }),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<WithdrawSection meId="me" />);

    await user.click(screen.getByRole('button', { name: '회원탈퇴' }));
    await user.click(await screen.findByRole('button', { name: '탈퇴하기' }));

    expect(await screen.findByRole('button', { name: '권한 넘기고 탈퇴하기' })).toBeDisabled();
  });

  it('이양한 뒤 같은 흐름에서 탈퇴까지 끝낸다', async () => {
    let transferredTo: string | null = null;
    let deleteAttempts = 0;
    server.use(
      membersHandler([ME, COLLEAGUE]),
      http.post('/api/v1/clinic/owner/transfer', async ({ request }) => {
        const body = (await request.json()) as { toClinicianId: string };
        transferredTo = body.toClinicianId;
        return HttpResponse.json(envelope(null));
      }),
      http.delete('/api/v1/auth/me', () => {
        deleteAttempts += 1;
        // 첫 시도는 개설자라 막히고, 이양 뒤의 재시도는 통과한다
        if (transferredTo === null) {
          return HttpResponse.json(
            errorEnvelope('CLINIC_OWNER_MUST_TRANSFER', '권한을 넘겨주세요.'),
            { status: 409 },
          );
        }
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<WithdrawSection meId="me" />);

    await user.click(screen.getByRole('button', { name: '회원탈퇴' }));
    await user.click(await screen.findByRole('button', { name: '탈퇴하기' }));
    await user.click(await screen.findByRole('radio', { name: /이한의/ }));
    await user.click(screen.getByRole('button', { name: '권한 넘기고 탈퇴하기' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
    expect(transferredTo).toBe('colleague');
    expect(deleteAttempts).toBe(2);
  });

  it('이양이 실패하면 탈퇴를 보내지 않는다 — 권한이 남은 채로 계정만 지워지면 안 된다', async () => {
    let deleteAttempts = 0;
    server.use(
      membersHandler([ME, COLLEAGUE]),
      http.post('/api/v1/clinic/owner/transfer', () =>
        HttpResponse.json(errorEnvelope('NOT_FOUND', '대상을 찾을 수 없습니다.'), { status: 404 }),
      ),
      http.delete('/api/v1/auth/me', () => {
        deleteAttempts += 1;
        return HttpResponse.json(errorEnvelope('CLINIC_OWNER_MUST_TRANSFER', '권한을 넘겨주세요.'), {
          status: 409,
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<WithdrawSection meId="me" />);

    await user.click(screen.getByRole('button', { name: '회원탈퇴' }));
    await user.click(await screen.findByRole('button', { name: '탈퇴하기' }));
    await user.click(await screen.findByRole('radio', { name: /이한의/ }));
    await user.click(screen.getByRole('button', { name: '권한 넘기고 탈퇴하기' }));

    expect(await screen.findByText('대상을 찾을 수 없습니다.')).toBeVisible();
    // 409를 부른 첫 시도 하나뿐이다
    expect(deleteAttempts).toBe(1);
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
