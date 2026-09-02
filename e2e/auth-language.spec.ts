/**
 * 인증 전 표시 언어 전환 — 한국어 로케일에서도 방문자가 영어를 고르고 그 선택을 유지한다.
 *
 * 소셜 로그인 버튼은 아이콘형이므로 번역 결과를 보이는 글자가 아니라 접근 이름으로 확인한다.
 * API는 브라우저 하네스에서 모두 막아, 이 흐름이 미스텁 요청을 남기지 않는 것까지 검증한다.
 */
import { expect, test, type Page } from '@playwright/test';
import { UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';
import { type ApiMock, mockApi, ok } from './fixtures/api';

const SIGNUP_TICKET = 'auth-language-acceptance-ticket';

async function stubAuthApi(page: Page): Promise<ApiMock> {
  return mockApi(page, {
    'GET /api/v1/auth/oauth/providers': ok({ providers: ['GOOGLE', 'KAKAO', 'NAVER'] }),
  });
}

test.describe('비인증 화면 표시 언어 전환', () => {
  test('기준 10: /login에 표시 언어 그룹이 보인다', async ({ page }) => {
    const api = await stubAuthApi(page);

    await page.goto('/login');

    await expect(page.getByRole('group', { name: '표시 언어', exact: true })).toBeVisible();
    expect(api.unhandled).toEqual([]);
  });

  test('기준 11: /login에서 English를 누르면 본문과 소셜 버튼 접근 이름이 영어가 된다', async ({
    page,
  }) => {
    const api = await stubAuthApi(page);
    await page.goto('/login');

    await page.getByRole('button', { name: 'English', exact: true }).click();

    await expect(page.getByText('Korean medicine clinical guideline assistant')).toBeVisible();
    await expect(
      page.getByText(
        'The first time you log in, you go through sign-up to enter your clinic details.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in with Google', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in with Kakao', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in with Naver', exact: true })).toBeVisible();
    expect(api.unhandled).toEqual([]);
  });

  test('기준 12: /login에서 고른 영어는 새로고침 뒤에도 유지된다', async ({ page }) => {
    const api = await stubAuthApi(page);
    await page.goto('/login');

    await page.getByRole('button', { name: 'English', exact: true }).click();
    expect(
      await page.evaluate((storageKey) => localStorage.getItem(storageKey), UI_LANG_STORAGE_KEY),
    ).toBe('en');

    await page.reload();

    const group = page.getByRole('group', { name: 'Display language', exact: true });
    await expect(group).toBeVisible();
    await expect(group.getByRole('button', { name: 'English', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('link', { name: 'Log in with Google', exact: true })).toBeVisible();
    expect(
      await page.evaluate((storageKey) => localStorage.getItem(storageKey), UI_LANG_STORAGE_KEY),
    ).toBe('en');
    expect(api.unhandled).toEqual([]);
  });

  test('기준 13: ticket이 있는 /signup에도 표시 언어 그룹이 보인다', async ({ page }) => {
    const api = await stubAuthApi(page);

    await page.goto(`/signup?ticket=${SIGNUP_TICKET}`);

    await expect(page.getByRole('group', { name: '표시 언어', exact: true })).toBeVisible();
    expect(api.unhandled).toEqual([]);
  });

  test('기준 14: /login에서 고른 영어는 /signup으로 이동해도 유지된다', async ({ page }) => {
    const api = await stubAuthApi(page);
    await page.goto('/login');

    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.goto(`/signup?ticket=${SIGNUP_TICKET}`);

    await expect(
      page.getByRole('group', { name: 'Display language', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Clinician sign-up', exact: true })).toBeVisible();
    await expect(
      page.getByText(
        'Your social account is verified. Enter your clinic details to finish signing up.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to login', exact: true })).toBeVisible();
    expect(
      await page.evaluate((storageKey) => localStorage.getItem(storageKey), UI_LANG_STORAGE_KEY),
    ).toBe('en');
    expect(api.unhandled).toEqual([]);
  });

  test('기준 15: 로그인 전환·새로고침·가입 이동 전 과정에 미스텁 API 요청이 없다', async ({
    page,
  }) => {
    const api = await stubAuthApi(page);
    await page.goto('/login');

    await expect(page.getByRole('group', { name: '표시 언어', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Google로 로그인', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Log in with Google', exact: true })).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole('group', { name: 'Display language', exact: true }),
    ).toBeVisible();

    await page.goto(`/signup?ticket=${SIGNUP_TICKET}`);
    await expect(page.getByRole('heading', { name: 'Clinician sign-up', exact: true })).toBeVisible();

    expect(api.unhandled).toEqual([]);
  });
});
