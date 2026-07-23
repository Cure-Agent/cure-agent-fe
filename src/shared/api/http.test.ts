import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authFetch, ensureRefreshed, setUnauthorizedHandler } from './http';

/**
 * docs/specs/07 수용 기준 1~5 동결 테스트. 구현 중 수정 금지.
 */

const REFRESH_PATH = '/api/v1/auth/refresh';

type Call = { url: string; method: string; headers: Record<string, string> };
let calls: Call[] = [];

function recordCall(input: RequestInfo | URL, init?: RequestInit): Call {
  const url = String(input);
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const call = { url, method: init?.method ?? 'GET', headers };
  calls.push(call);
  return call;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  calls = [];
  setUnauthorizedHandler(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  setUnauthorizedHandler(null);
});

describe('authFetch (수용 기준 1~5)', () => {
  it('기준 1: 401 → refresh → 원 요청 재시도 성공', async () => {
    let dataCallCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const call = recordCall(input, init);
        if (call.url.includes(REFRESH_PATH)) return jsonResponse(200, { success: true });
        dataCallCount += 1;
        return dataCallCount === 1
          ? jsonResponse(401, { success: false, code: 'UNAUTHORIZED' })
          : jsonResponse(200, { success: true, data: { ok: true } });
      }),
    );

    const res = await authFetch('/api/v1/auth/me');
    expect(res.status).toBe(200);
    expect(calls.map((c) => c.url)).toEqual([
      '/api/v1/auth/me',
      expect.stringContaining(REFRESH_PATH),
      '/api/v1/auth/me',
    ]);
  });

  it('기준 2: 동시 401 3건 → refresh는 1회만 (single-flight)', async () => {
    const firstAttempt = new Set<string>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const call = recordCall(input, init);
        if (call.url.includes(REFRESH_PATH)) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return jsonResponse(200, { success: true });
        }
        if (!firstAttempt.has(call.url)) {
          firstAttempt.add(call.url);
          return jsonResponse(401, { success: false });
        }
        return jsonResponse(200, { success: true });
      }),
    );

    const results = await Promise.all([
      authFetch('/api/v1/r1'),
      authFetch('/api/v1/r2'),
      authFetch('/api/v1/r3'),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);

    const refreshCalls = calls.filter((c) => c.url.includes(REFRESH_PATH));
    expect(refreshCalls).toHaveLength(1);
  });

  it('기준 3: refresh 실패 → onUnauthorized 1회, 원 401 반환', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const call = recordCall(input, init);
        if (call.url.includes(REFRESH_PATH)) return jsonResponse(401, { success: false });
        return jsonResponse(401, { success: false, code: 'UNAUTHORIZED' });
      }),
    );

    const res = await authFetch('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    // 원 요청 1회 + refresh 1회 — 재시도는 없다
    expect(calls).toHaveLength(2);
  });

  it('기준 4: 비-GET에 X-CSRF-Protection 자동 부착, GET에는 미부착', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        recordCall(input, init);
        return jsonResponse(200, { success: true });
      }),
    );

    await authFetch('/api/v1/things', { method: 'POST', body: '{}' });
    await authFetch('/api/v1/things');

    expect(calls[0].headers['x-csrf-protection']).toBe('1');
    expect(calls[1].headers['x-csrf-protection']).toBeUndefined();
  });

  it('기준 5: refresh 요청 자체는 401이어도 재귀하지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        recordCall(input, init);
        return jsonResponse(401, { success: false });
      }),
    );

    await ensureRefreshed();
    const refreshCalls = calls.filter((c) => c.url.includes(REFRESH_PATH));
    expect(refreshCalls).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });
});
