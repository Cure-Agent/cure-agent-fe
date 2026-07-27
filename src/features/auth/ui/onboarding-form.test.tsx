// @vitest-environment happy-dom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, errorEnvelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { OnboardingForm } from './onboarding-form';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

useMswServer();

describe('OnboardingForm (docs/specs/17)', () => {
  beforeEach(() => pushMock.mockClear());

  it('티켓 + 한의원 정보를 보내 가입을 마치고 /assistant로 이동한다', async () => {
    let receivedBody: unknown;
    server.use(
      http.post('/api/v1/auth/signup', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(
          envelope({
            clinician: {
              id: 'clinician-1',
              email: 'doctor@clinic.kr',
              displayName: '김의사',
              clinic: { id: 'clinic-1', name: '서울한의원' },
              verificationStatus: 'PENDING',
            },
            expiresAt: '2026-07-27T00:15:00.000Z',
          }),
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<OnboardingForm ticket="ticket-abc" defaultDisplayName="구글이름" />);

    // 소셜 프로필 이름이 기본값으로 채워진다
    expect(screen.getByLabelText('이름')).toHaveValue('구글이름');

    await user.clear(screen.getByLabelText('이름'));
    await user.type(screen.getByLabelText('이름'), '김의사');
    await user.type(screen.getByLabelText('한의원명'), '서울한의원');
    await user.type(screen.getByLabelText('면허번호'), 'LIC-0042');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '가입 완료' }));

    await waitFor(() =>
      expect(receivedBody).toEqual({
        ticket: 'ticket-abc',
        displayName: '김의사',
        clinicName: '서울한의원',
        licenseNumber: 'LIC-0042',
        termsAccepted: true,
      }),
    );
    // 이메일·소셜 신원은 서버가 티켓에서 꺼내므로 바디에 없다
    expect(receivedBody).not.toHaveProperty('email');
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/assistant'));
  });

  it('만료된 티켓 → 에러 문구 + 다시 로그인 링크', async () => {
    server.use(
      http.post('/api/v1/auth/signup', () =>
        HttpResponse.json(
          errorEnvelope(
            'AUTH_OAUTH_TICKET_INVALID',
            '가입 정보가 만료되었습니다. 처음부터 다시 로그인해주세요.',
          ),
          { status: 401 },
        ),
      ),
      // 401 → http.ts가 single-flight refresh를 1회 시도한다
      http.post('/api/v1/auth/refresh', () =>
        HttpResponse.json(errorEnvelope('UNAUTHORIZED', '인증이 필요합니다.'), { status: 401 }),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<OnboardingForm ticket="expired-ticket" />);

    await user.type(screen.getByLabelText('이름'), '김의사');
    await user.type(screen.getByLabelText('한의원명'), '서울한의원');
    await user.type(screen.getByLabelText('면허번호'), 'LIC-0042');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '가입 완료' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        '가입 정보가 만료되었습니다. 처음부터 다시 로그인해주세요.',
      ),
    );
    expect(screen.getByRole('link', { name: '다시 로그인' })).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
