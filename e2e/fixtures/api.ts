/**
 * 브라우저 레벨 API 스텁 — E2E의 BE 대역.
 *
 * 단위 테스트의 MSW(src/shared/test/msw.ts)와 같은 규약을 브라우저 쪽에서 세운다:
 * 봉투(architecture.md §10.1)로 응답하고, **스텁되지 않은 요청은 통과시키지 않는다**.
 * 미스텁 요청은 501로 막고 `unhandled`에 기록해 두므로, 테스트가 화면만 보고
 * 통과한 뒤 실제로는 호출이 새어 나가는 상황이 조용히 넘어가지 않는다.
 */
import type { Page, Route } from '@playwright/test';

export interface PageInfo {
  size: number;
  hasNext: boolean;
  nextCursor: string | null;
}

// 봉투의 timestamp는 화면에 쓰이지 않는다 — 스냅샷 안정성을 위해 고정값을 쓴다
const FIXED_TIMESTAMP = '2026-01-01T00:00:00.000Z';
const TRACE_ID = 'e2e-trace';

/** 성공 봉투 (architecture.md §10.1) */
export function envelope<T>(data: T, page: PageInfo | null = null): Record<string, unknown> {
  return {
    success: true,
    code: 'SUCCESS',
    message: '요청에 성공하였습니다.',
    data,
    page,
    timestamp: FIXED_TIMESTAMP,
    traceId: TRACE_ID,
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
    timestamp: FIXED_TIMESTAMP,
    traceId: TRACE_ID,
  };
}

export interface ApiResponse {
  status?: number;
  /** 봉투로 감싸지 않은 원본 바디 — 헬퍼(ok/fail)가 이미 감싼 값을 넣는다 */
  json?: unknown;
  /** SSE 프레임으로 직렬화할 이벤트 목록 (§8 ConversationStreamEvent) */
  sse?: unknown[];
}

export interface ApiRequest {
  /** 패턴의 `:name` 자리에 들어온 값 */
  params: Record<string, string>;
  searchParams: Record<string, string>;
  /** JSON 본문 (없으면 null) */
  body: unknown;
  route: Route;
}

export type ApiHandler = ApiResponse | ((request: ApiRequest) => ApiResponse | Promise<ApiResponse>);

/** `'GET /api/v1/patients/:patientId'` 형태의 키 → 핸들러 */
export type ApiRoutes = Record<string, ApiHandler>;

export interface RecordedCall {
  method: string;
  pathname: string;
  searchParams: Record<string, string>;
  body: unknown;
}

export interface ApiMock {
  /** 스텁이 없어 501로 막힌 요청 — 테스트가 끝날 때 비어 있어야 한다 */
  readonly unhandled: string[];
  /** 스텁이 실제로 받은 요청 — 전송된 본문을 검증할 때 쓴다 */
  readonly calls: RecordedCall[];
  callsTo(method: string, pattern: string): RecordedCall[];
}

/** 성공 응답 */
export function ok(data: unknown): ApiResponse {
  return { json: envelope(data) };
}

/** 목록 응답 — page 메타를 items 길이에 맞춰 채운다 */
export function okList(items: unknown[]): ApiResponse {
  return { json: envelope(items, { size: items.length, hasNext: false, nextCursor: null }) };
}

/** 실패 응답 */
export function fail(status: number, code: string, message: string): ApiResponse {
  return { status, json: errorEnvelope(code, message) };
}

/** SSE 응답 — 프레임 직렬화는 sseBody가 한다 */
export function stream(events: unknown[]): ApiResponse {
  return { sse: events };
}

/** 이벤트 목록 → `data: {json}\n\n` 프레임 (stream-client.ts가 파싱하는 형태) */
function sseBody(events: unknown[]): string {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
}

/** 세그먼트 단위 매칭. `:name`은 한 세그먼트 와일드카드다. 불일치면 null */
function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const expected = pattern.split('/');
  const actual = pathname.split('/');
  if (expected.length !== actual.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < expected.length; i += 1) {
    const segment = expected[i];
    if (segment.startsWith(':')) params[segment.slice(1)] = decodeURIComponent(actual[i]);
    else if (segment !== actual[i]) return null;
  }
  return params;
}

/**
 * `/api/v1/**`를 전부 가로채 routes로 응답한다.
 *
 * 핸들러를 함수로 주면 요청마다 다시 평가되므로, 로그아웃 후 401처럼
 * **호출에 따라 변하는 서버 상태**를 테스트 안의 변수로 표현할 수 있다.
 */
export async function mockApi(page: Page, routes: ApiRoutes): Promise<ApiMock> {
  const unhandled: string[] = [];
  const calls: RecordedCall[] = [];

  const entries = Object.entries(routes).map(([key, handler]) => {
    const separator = key.indexOf(' ');
    if (separator < 0) throw new Error(`라우트 키는 "<METHOD> <경로>" 형식이어야 한다: "${key}"`);
    return {
      method: key.slice(0, separator).toUpperCase(),
      pattern: key.slice(separator + 1),
      handler,
    };
  });

  await page.route(/\/api\/v1\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const searchParams = Object.fromEntries(url.searchParams);

    let body: unknown = null;
    try {
      body = request.postDataJSON() ?? null;
    } catch {
      body = request.postData(); // JSON이 아닌 본문은 원문 그대로 남긴다
    }

    let params: Record<string, string> | null = null;
    const matched = entries.find((entry) => {
      if (entry.method !== method) return false;
      params = matchPath(entry.pattern, url.pathname);
      return params !== null;
    });

    if (!matched) {
      unhandled.push(`${method} ${url.pathname}`);
      await route.fulfill({
        status: 501,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(
          errorEnvelope('E2E_UNSTUBBED', `스텁되지 않은 요청: ${method} ${url.pathname}`),
        ),
      });
      return;
    }

    calls.push({ method, pathname: url.pathname, searchParams, body });

    const { handler } = matched;
    const response =
      typeof handler === 'function'
        ? await handler({ params: params ?? {}, searchParams, body, route })
        : handler;

    if (response.sse) {
      await route.fulfill({
        status: response.status ?? 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: sseBody(response.sse),
      });
      return;
    }

    await route.fulfill({
      status: response.status ?? 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(response.json ?? null),
    });
  });

  return {
    unhandled,
    calls,
    callsTo(method, pattern) {
      return calls.filter(
        (call) => call.method === method.toUpperCase() && matchPath(pattern, call.pathname) !== null,
      );
    },
  };
}
