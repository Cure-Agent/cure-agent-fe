import { defineConfig, devices } from '@playwright/test';

/**
 * E2E 설정 — 크리티컬 플로우만 다룬다 (e2e/README.md).
 *
 * BE는 띄우지 않는다. 브라우저에서 `/api/v1/**`를 전부 가로채 스텁하므로
 * (e2e/fixtures/api.ts) 검증 대상은 "FE가 계약대로 된 응답을 받았을 때
 * 화면·라우팅·스트림 조립이 끝까지 맞는가"다.
 */

// dev(3001)와 겹치지 않게 — 개발 서버를 띄운 채로 E2E를 돌릴 수 있다
const PORT = 3101;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // CI에서 .only가 섞여 들어오면 나머지 플로우가 조용히 안 돌게 된다
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    /**
     * 로케일 고정 (BE docs/specs/42) — 표시 언어가 `navigator.language`에서 유도되므로,
     * 고정하지 않으면 **화면 문구가 러너 머신의 로케일을 따라간다.** 아래 플로우들은 한국어
     * 경로를 단언하며, 그 경로는 스펙이 「한 바이트도 바뀌지 않는다」로 못박은 축이다.
     */
    locale: 'ko-KR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // dev가 아니라 프로덕션 빌드로 검증한다 — assistant의 useSearchParams/Suspense 경계처럼
    // dev에서는 드러나지 않고 build·prerender에서만 터지는 문제가 실재한다
    command: `pnpm build && pnpm exec next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // 스텁이 빠진 요청의 안전장치: rewrites 대상을 항상 연결이 거부되는 주소로 고정한다.
      // .env의 실제 BE(운영 API)로 새지 않고 그 자리에서 실패해 누락이 드러난다.
      BE_ORIGIN: 'http://127.0.0.1:9',
      // same-origin 고정 (docs/specs/07) — 로컬 .env가 값을 갖고 있어도 여기서 덮는다
      NEXT_PUBLIC_API_BASE_URL: '',
      NEXT_PUBLIC_SITE_URL: BASE_URL,
    },
  },
});
