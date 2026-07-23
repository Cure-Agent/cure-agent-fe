// 이 파일은 scripts/generate-api.mjs가 생성한다 — 직접 수정 금지 (architecture.md §1)
// 전송 정책(401 refresh, CSRF 헤더)은 shared/api/http.ts의 authFetch를 options.fetch로 주입해 적용한다.
import createClient, { type ClientOptions } from 'openapi-fetch';
import type { paths } from './schema';

export const createApiClient = (baseUrl: string, options: ClientOptions = {}) =>
  createClient<paths>({ baseUrl, credentials: 'include', ...options });

export type ApiClient = ReturnType<typeof createApiClient>;
