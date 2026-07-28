/**
 * 크리티컬 플로우 1 — 세션이 앱 진입을 통제한다.
 *
 * 이 앱의 인증은 HttpOnly 쿠키라 FE 코드에 토큰이 없다. 그래서 "로그인되었는가"는
 * 오직 `GET /auth/me`의 성패로만 판정되고, 그 판정이 화면 전환으로 이어지는 경로
 * (protected 레이아웃의 리다이렉트, refresh 실패 시 전역 핸들러)가 이 플로우의 전부다.
 * 여기가 깨지면 로그인한 사람이 튕기거나, 반대로 세션 없이 화면이 열린다.
 */
import { expect, test } from '@playwright/test';
import { fail, mockApi, ok, okList } from './fixtures/api';
import { CLINICIAN, CONVERSATION } from './fixtures/data';

const UNAUTHENTICATED = fail(401, 'AUTH_UNAUTHENTICATED', '인증이 필요합니다.');

test.describe('인증 게이트', () => {
  test('세션이 없으면 보호 화면 대신 로그인으로 보낸다', async ({ page }) => {
    const api = await mockApi(page, {
      'GET /api/v1/auth/me': UNAUTHENTICATED,
      // refresh까지 실패해야 최종 미인증이다 (http.ts: 401 → refresh → 재시도)
      'POST /api/v1/auth/refresh': fail(401, 'AUTH_REFRESH_INVALID', '세션이 만료되었습니다.'),
      'GET /api/v1/auth/oauth/providers': ok({ providers: ['GOOGLE', 'KAKAO', 'NAVER'] }),
    });

    await page.goto('/assistant');

    await expect(page).toHaveURL('/login');
    // 보호 화면의 흔적이 남으면 안 된다 — 리다이렉트가 아니라 겹쳐 그린 것이므로
    await expect(page.getByRole('link', { name: '어시스턴트' })).toHaveCount(0);

    // BE가 활성이라고 알려준 제공자만, 각 사 규정 문구를 접근 이름으로 갖는다 (docs/specs/17)
    await expect(page.getByRole('link', { name: 'Google로 로그인' })).toHaveAttribute(
      'href',
      '/api/v1/auth/oauth/google',
    );
    await expect(page.getByRole('link', { name: '카카오 로그인' })).toHaveAttribute(
      'href',
      '/api/v1/auth/oauth/kakao',
    );
    await expect(page.getByRole('link', { name: '네이버 로그인' })).toHaveAttribute(
      'href',
      '/api/v1/auth/oauth/naver',
    );

    expect(api.unhandled).toEqual([]);
  });

  test('세션이 있으면 어시스턴트로 들어가고 계정 정보가 보인다', async ({ page }) => {
    const api = await mockApi(page, {
      'GET /api/v1/auth/me': ok(CLINICIAN),
      'GET /api/v1/conversations': okList([CONVERSATION]),
    });

    await page.goto('/assistant');

    await expect(page).toHaveURL('/assistant');
    // 어느 계정으로 들어와 있는지 확인할 곳은 사이드바뿐이다 (app-shell.tsx)
    await expect(page.getByText(CLINICIAN.displayName)).toBeVisible();
    await expect(page.getByText(CLINICIAN.email)).toBeVisible();
    await expect(page.getByText(CLINICIAN.clinic.name)).toBeVisible();
    await expect(page.getByRole('button', { name: CONVERSATION.title })).toBeVisible();

    expect(api.unhandled).toEqual([]);
  });

  test('로그아웃하면 세션이 끊기고 다시 들어갈 수 없다', async ({ page }) => {
    // 서버 상태를 테스트 안의 변수로 표현한다 — 로그아웃 이후의 me는 401이어야 한다
    let signedIn = true;
    const api = await mockApi(page, {
      'GET /api/v1/auth/me': () => (signedIn ? ok(CLINICIAN) : UNAUTHENTICATED),
      'POST /api/v1/auth/refresh': fail(401, 'AUTH_REFRESH_INVALID', '세션이 만료되었습니다.'),
      'POST /api/v1/auth/logout': () => {
        signedIn = false;
        return ok(null);
      },
      'GET /api/v1/conversations': okList([CONVERSATION]),
      'GET /api/v1/auth/oauth/providers': ok({ providers: ['GOOGLE'] }),
    });

    await page.goto('/assistant');
    await expect(page.getByText(CLINICIAN.email)).toBeVisible();

    await page.getByRole('button', { name: '로그아웃' }).click();

    await expect(page).toHaveURL('/login');
    expect(api.callsTo('POST', '/api/v1/auth/logout')).toHaveLength(1);

    // 끊긴 세션으로 보호 화면에 재진입할 수 없다 — 캐시에 남은 me로 통과하면 안 된다
    await page.goto('/assistant');
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('link', { name: 'Google로 로그인' })).toBeVisible();

    expect(api.unhandled).toEqual([]);
  });
});
