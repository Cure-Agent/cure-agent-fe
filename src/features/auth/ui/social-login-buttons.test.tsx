// @vitest-environment happy-dom
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { SocialLoginButtons } from './social-login-buttons';

useMswServer();

function mockProviders(providers: string[]): void {
  server.use(
    http.get('/api/v1/auth/oauth/providers', () => HttpResponse.json(envelope({ providers }))),
  );
}

describe('SocialLoginButtons (docs/specs/17)', () => {
  it('활성 제공자만 노출한다', async () => {
    mockProviders(['GOOGLE', 'KAKAO']);
    renderWithProviders(<SocialLoginButtons />);

    expect(await screen.findByRole('link', { name: 'Google로 계속하기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '카카오로 계속하기' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '네이버로 계속하기' })).not.toBeInTheDocument();
  });

  it('버튼은 BE OAuth 시작 경로로 가는 링크다 (전체 페이지 이동)', async () => {
    mockProviders(['NAVER']);
    renderWithProviders(<SocialLoginButtons />);

    const link = await screen.findByRole('link', { name: '네이버로 계속하기' });
    expect(link).toHaveAttribute('href', '/api/v1/auth/oauth/naver');
  });

  it('콜백이 되돌려준 error 코드를 사용자 문구로 보여준다', async () => {
    mockProviders(['GOOGLE']);
    renderWithProviders(<SocialLoginButtons error="AUTH_OAUTH_EMAIL_MISSING" />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        '가입에는 이메일이 필요합니다. 이메일 제공에 동의해주세요.',
      ),
    );
  });

  it('활성 제공자가 없으면 로그인 불가를 알린다', async () => {
    mockProviders([]);
    renderWithProviders(<SocialLoginButtons />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '사용 가능한 소셜 로그인이 없습니다. 관리자에게 문의해주세요.',
    );
  });
});
