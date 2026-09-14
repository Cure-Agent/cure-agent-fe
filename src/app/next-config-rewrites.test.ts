// spec 52 FE 수용 기준 30 동결 테스트. 구현 중 수정 금지.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => { vi.stubEnv('AGENT_ORIGIN', 'http://agent.test:8000'); vi.stubEnv('BE_ORIGIN', 'http://be.test:3000'); });
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

async function rewrites() {
  vi.resetModules();
  const { default: config } = await import('../../next.config');
  expect(config.rewrites).toBeTypeOf('function');
  if (!config.rewrites) throw new Error('rewrites가 없다');
  const rules = await config.rewrites();
  expect(Array.isArray(rules)).toBe(true);
  if (!Array.isArray(rules)) throw new Error('rewrites가 배열이 아니다');
  return rules;
}

it('30-a·30-b: 환경 origin과 에이전트 우선순위', async () => {
  // RED: 현재 첫 규칙은 일반 BE 규칙이며 에이전트 규칙이 없다.
  const rules = await rewrites();
  expect(rules[0]).toEqual({ source: '/api/v1/agent/:path*', destination: 'http://agent.test:8000/api/v1/agent/:path*' });
  expect(rules).toContainEqual({ source: '/api/v1/:path*', destination: 'http://be.test:3000/api/v1/:path*' });
  expect(rules.findIndex((r) => r.source === '/api/v1/agent/:path*')).toBeLessThan(rules.findIndex((r) => r.source === '/api/v1/:path*'));
});

it('30-c: AGENT_ORIGIN 미설정 기본값', async () => {
  // RED: 스텁에는 localhost:8000으로 보내는 규칙이 없다.
  delete process.env.AGENT_ORIGIN;
  expect(await rewrites()).toContainEqual({ source: '/api/v1/agent/:path*', destination: 'http://localhost:8000/api/v1/agent/:path*' });
});
