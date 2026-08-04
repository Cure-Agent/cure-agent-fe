// @vitest-environment happy-dom
// 초대로 합류하는 온보딩 (BE spec 35) — clinicName과 invitationToken은 상호배타다
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, errorEnvelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { OnboardingForm } from './onboarding-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

useMswServer();

const STORAGE_KEY = 'cure.invitationToken';

const SESSION = {
  clinician: {
    id: 'clinician-1',
    email: 'doctor@cure.test',
    displayName: '김한의',
    clinic: { id: 'clinic-1', name: '서울한의원' },
    verificationStatus: 'PENDING',
  },
  expiresAt: '2026-08-05T00:00:00Z',
};

const fillCommonFields = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.type(screen.getByLabelText('이름'), '이한의');
  await user.type(screen.getByLabelText('면허번호'), '12345');
  await user.click(screen.getByRole('checkbox'));
};

describe('초대 합류 온보딩', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('초대가 있으면 한의원명을 묻지 않고 합류할 곳을 보여준다', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'inv-1.secret');
    server.use(
      http.get('/api/v1/invitations/inv-1.secret', () =>
        HttpResponse.json(envelope({ clinicName: '서울한의원' })),
      ),
    );

    renderWithProviders(<OnboardingForm ticket="ticket-1" />);

    expect(await screen.findByText('서울한의원')).toBeVisible();
    // 서버가 초대의 클리닉을 쓰므로 입력 자체가 없다 — 함께 보내면 422다
    expect(screen.queryByLabelText('한의원명')).toBeNull();
    expect(await screen.findByRole('button', { name: '합류하기' })).toBeVisible();
  });

  it('합류 요청에 clinicName을 싣지 않는다', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'inv-1.secret');
    let sentBody: Record<string, unknown> | null = null;
    server.use(
      http.get('/api/v1/invitations/inv-1.secret', () =>
        HttpResponse.json(envelope({ clinicName: '서울한의원' })),
      ),
      http.post('/api/v1/auth/signup', async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(envelope(SESSION), { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<OnboardingForm ticket="ticket-1" />);
    await screen.findByRole('button', { name: '합류하기' });

    await fillCommonFields(user);
    await user.click(screen.getByRole('button', { name: '합류하기' }));

    await waitFor(() => expect(sentBody).not.toBeNull());
    expect(sentBody!.invitationToken).toBe('inv-1.secret');
    expect(sentBody).not.toHaveProperty('clinicName');
  });

  it('합류에 성공하면 1회용 토큰을 세션에서 지운다', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'inv-1.secret');
    server.use(
      http.get('/api/v1/invitations/inv-1.secret', () =>
        HttpResponse.json(envelope({ clinicName: '서울한의원' })),
      ),
      http.post('/api/v1/auth/signup', () => HttpResponse.json(envelope(SESSION), { status: 201 })),
    );

    const user = userEvent.setup();
    renderWithProviders(<OnboardingForm ticket="ticket-1" />);
    await screen.findByRole('button', { name: '합류하기' });

    await fillCommonFields(user);
    await user.click(screen.getByRole('button', { name: '합류하기' }));

    await waitFor(() => expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull());
  });

  it('초대가 만료됐으면 개설 흐름으로 되돌린다 — 인증까지 끝낸 사람을 막지 않는다', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'dead.token');
    server.use(
      http.get('/api/v1/invitations/dead.token', () =>
        HttpResponse.json(errorEnvelope('INVITATION_INVALID', '유효하지 않은 초대입니다.'), {
          status: 404,
        }),
      ),
    );

    renderWithProviders(<OnboardingForm ticket="ticket-1" />);

    expect(await screen.findByText(/초대 링크가 만료되었거나 이미 사용되었습니다/)).toBeVisible();
    expect(await screen.findByLabelText('한의원명')).toBeVisible();
    expect(screen.getByRole('button', { name: '가입 완료' })).toBeVisible();
  });

  it('초대 없이 들어오면 프리뷰를 조회하지 않고 기존 개설 폼을 그대로 쓴다', async () => {
    let previewCalled = false;
    server.use(
      http.get('/api/v1/invitations/*', () => {
        previewCalled = true;
        return HttpResponse.json(envelope({ clinicName: '있으면 안 된다' }));
      }),
    );

    renderWithProviders(<OnboardingForm ticket="ticket-1" />);

    expect(await screen.findByLabelText('한의원명')).toBeVisible();
    expect(previewCalled).toBe(false);
  });
});
