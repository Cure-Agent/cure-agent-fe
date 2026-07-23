/**
 * 전송 계층 (FE 분리본 §2) — 봉투 규약을 모른다.
 * 401 → single-flight refresh → 원 요청 1회 재시도. 로그아웃 정책은 핸들러 주입으로 분리.
 */

export type UnauthorizedHandler = () => void;

export function setUnauthorizedHandler(_handler: UnauthorizedHandler | null): void {
  throw new Error('NOT_IMPLEMENTED');
}

export function notifyUnauthorized(): void {
  throw new Error('NOT_IMPLEMENTED');
}

export function ensureRefreshed(): Promise<boolean> {
  throw new Error('NOT_IMPLEMENTED');
}

export const authFetch: typeof fetch = () => {
  throw new Error('NOT_IMPLEMENTED');
};
