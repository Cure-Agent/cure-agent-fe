/**
 * 전송 계층 (FE 분리본 §2) — 봉투 규약을 모른다.
 * - credentials: include (HttpOnly 쿠키 인증 — 토큰은 FE 코드에 절대 등장하지 않는다)
 * - 비-GET에 X-CSRF-Protection 자동 부착 (architecture.md §4.1)
 * - 401 → single-flight refresh → 원 요청 1회 재시도
 * - 로그아웃·리다이렉트 정책은 setUnauthorizedHandler 주입으로 분리
 */
import { API_BASE_URL } from '../config/env';

const REFRESH_PATH = '/api/v1/auth/refresh';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

export function notifyUnauthorized(): void {
  onUnauthorized?.();
}

export function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}

// ── single-flight refresh: 앱 전체에서 진행 중 refresh는 단 하나 ──
let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  try {
    const response = await fetch(buildUrl(REFRESH_PATH), {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Protection': '1', Accept: 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function ensureRefreshed(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * fetch 대체재. openapi-fetch의 custom fetch로도 사용된다(Request 입력 지원).
 * 재시도를 위해 Request 본문은 미리 버퍼링한다.
 */
export const authFetch: typeof fetch = async (input, init) => {
  let url: string;
  let baseInit: RequestInit;

  if (input instanceof Request) {
    url = input.url;
    const method = input.method.toUpperCase();
    baseInit = {
      method,
      headers: input.headers,
      body: SAFE_METHODS.has(method) ? undefined : await input.clone().arrayBuffer(),
      credentials: input.credentials,
      ...init,
    };
  } else {
    url = String(input);
    baseInit = { ...init };
  }

  const method = (baseInit.method ?? 'GET').toUpperCase();
  const execute = (): Promise<Response> => {
    const headers = new Headers(baseInit.headers);
    if (!SAFE_METHODS.has(method)) headers.set('X-CSRF-Protection', '1');
    return fetch(url, {
      ...baseInit,
      headers,
      credentials: baseInit.credentials ?? 'include',
    });
  };

  let response = await execute();

  if (response.status === 401 && !url.includes(REFRESH_PATH)) {
    const refreshed = await ensureRefreshed();
    if (!refreshed) {
      notifyUnauthorized();
      return response;
    }
    response = await execute();
    if (response.status === 401) notifyUnauthorized();
  }

  return response;
};
