#!/usr/bin/env node
/**
 * OpenAPI 계약 동기화 + 타입 생성 (architecture.md §1, FE 분리본 §3)
 *
 * - `pnpm api:sync`     : BE 레포 raw에서 스펙 fetch → openapi/ 갱신 → 타입 재생성
 * - `pnpm api:generate` : 커밋된 로컬 스펙에서 타입만 재생성 (CI가 diff=0 검증에 사용)
 *
 * openapi/cure-agent.v1.json 과 src/shared/api/generated/* 는 이 스크립트의 산출물이다.
 * 직접 편집 금지 — CI의 재생성 diff 검사가 편집을 차단한다.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = join(ROOT, 'openapi', 'cure-agent.v1.json');
const GENERATED_DIR = join(ROOT, 'src', 'shared', 'api', 'generated');

const SPEC_URL =
  process.env.CURE_AGENT_SPEC_URL ??
  'https://raw.githubusercontent.com/Cure-Agent/cure-agent-be/main/openapi/cure-agent.v1.json';

const CLIENT_TEMPLATE = `// 이 파일은 scripts/generate-api.mjs가 생성한다 — 직접 수정 금지 (architecture.md §1)
// 전송 정책(401 refresh, CSRF 헤더)은 shared/api/http.ts의 authFetch를 options.fetch로 주입해 적용한다.
import createClient, { type ClientOptions } from 'openapi-fetch';
import type { paths } from './schema';

export const createApiClient = (baseUrl: string, options: ClientOptions = {}) =>
  createClient<paths>({ baseUrl, credentials: 'include', ...options });

export type ApiClient = ReturnType<typeof createApiClient>;
`;

async function syncSpec() {
  console.log(`BE 스펙 fetch: ${SPEC_URL}`);
  const res = await fetch(SPEC_URL);
  if (!res.ok) {
    throw new Error(`스펙 fetch 실패: HTTP ${res.status} — BE 레포의 openapi/ 경로를 확인하세요`);
  }
  const spec = await res.json();
  mkdirSync(dirname(SPEC_PATH), { recursive: true });
  writeFileSync(SPEC_PATH, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
  console.log('openapi/cure-agent.v1.json 갱신 완료');
}

function generate() {
  mkdirSync(GENERATED_DIR, { recursive: true });
  execSync(
    `pnpm exec openapi-typescript "${SPEC_PATH}" -o "${join(GENERATED_DIR, 'schema.ts')}"`,
    { cwd: ROOT, stdio: 'inherit' },
  );
  writeFileSync(join(GENERATED_DIR, 'client.ts'), CLIENT_TEMPLATE, 'utf8');
  console.log('src/shared/api/generated/{schema.ts, client.ts} 생성 완료');
}

if (process.argv.includes('--sync')) {
  await syncSpec();
}
generate();
