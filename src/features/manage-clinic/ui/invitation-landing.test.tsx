// @vitest-environment happy-dom
// 초대 링크 수락 진입 (BE spec 35) — 계정이 없는 사람이 여는 비인증 화면이다
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { envelope, errorEnvelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { InvitationLanding } from './invitation-landing';

useMswServer();

const providersHandler = http.get('/api/v1/auth/oauth/providers', () =>
  HttpResponse.json(envelope({ providers: ['GOOGLE'] })),
);

const STORAGE_KEY = 'cure.invitationToken';

describe('초대 수락 진입', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('초대가 유효하면 한의원명과 로그인 수단을 보여준다', async () => {
    server.use(
      providersHandler,
      http.get('/api/v1/invitations/inv-1.secret', () =>
        HttpResponse.json(envelope({ clinicName: '서울한의원' })),
      ),
    );

    renderWithProviders(<InvitationLanding token="inv-1.secret" />);

    expect(await screen.findByText('서울한의원')).toBeVisible();
    expect(await screen.findByRole('link', { name: 'Google로 로그인' })).toBeVisible();
  });

  it('소셜 왕복에 실릴 자리가 없어 토큰을 세션에 맡겨 둔다', async () => {
    server.use(
      providersHandler,
      http.get('/api/v1/invitations/inv-1.secret', () =>
        HttpResponse.json(envelope({ clinicName: '서울한의원' })),
      ),
    );

    renderWithProviders(<InvitationLanding token="inv-1.secret" />);

    await waitFor(() =>
      expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('inv-1.secret'),
    );
  });

  it('만료·사용됨·취소됨을 구분하지 않고 새 링크 요청으로 안내한다', async () => {
    server.use(
      providersHandler,
      http.get('/api/v1/invitations/dead.token', () =>
        HttpResponse.json(errorEnvelope('INVITATION_INVALID', '유효하지 않은 초대입니다.'), {
          status: 404,
        }),
      ),
    );

    renderWithProviders(<InvitationLanding token="dead.token" />);

    expect(
      await screen.findByText(/유효하지 않거나 만료된 초대 링크입니다/),
    ).toBeVisible();
    // 죽은 토큰을 맡겨 두면 다음 가입이 만료 안내부터 보게 된다
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Google로 로그인' })).toBeNull();
  });
});
