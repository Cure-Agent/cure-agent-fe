/**
 * MSW 테스트 인프라 (FE 분리본 §5 — API 모킹은 MSW로, 수동 mock 금지).
 * 테스트 파일에서 `useMswServer()`를 호출해 라이프사이클을 등록한다.
 * API_BASE_URL이 빈 값(same-origin)이므로 핸들러는 상대 경로('/api/v1/...')로 등록한다
 * (happy-dom 환경 필수 — 파일 상단 @vitest-environment happy-dom).
 */
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

export const server = setupServer();

export function useMswServer(): void {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

/** 성공 봉투 (architecture.md §10.1) */
export function envelope<T>(
  data: T,
  page: { size: number; hasNext: boolean; nextCursor: string | null } | null = null,
): Record<string, unknown> {
  return {
    success: true,
    code: 'SUCCESS',
    message: '요청에 성공하였습니다.',
    data,
    page,
    timestamp: new Date().toISOString(),
    traceId: 'test-trace',
  };
}

/** 실패 봉투 */
export function errorEnvelope(code: string, message: string): Record<string, unknown> {
  return {
    success: false,
    code,
    message,
    data: null,
    page: null,
    timestamp: new Date().toISOString(),
    traceId: 'test-trace',
  };
}
