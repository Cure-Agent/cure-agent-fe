#!/usr/bin/env node
/**
 * BE 스펙 조달 — `/implement <번호>` Phase 0의 입력을 만든다.
 *
 * `docs/specs/`는 이 레포에 없다. 화면 스펙까지 **BE 레포**에 살고(단일 스펙 저장소 + 두 구현
 * 레포), 이 스크립트가 그것을 `.cure-implement/spec-<번호>.md`로 가져온다.
 *
 * 조달 순서:
 *   1. 로컬 형제 경로 `../cure-agent-be/docs/specs/<번호>-*.md` — 있으면 그대로 쓴다.
 *      두 레포를 나란히 두고 작업하는 로컬에서는 **아직 머지되지 않은 스펙도** 읽을 수 있다.
 *   2. BE main의 raw — 형제 경로가 없을 때(CI·다른 머신·워크트리). 파일명을 모르므로 GitHub
 *      contents API로 `<번호>-`로 시작하는 파일을 먼저 찾는다.
 *
 * 이 이중 경로는 `generate-api.mjs`가 계약을 가져오는 방식과 같은 이유다 — 레포 경계를 넘는
 * 참조를 형제 디렉토리 전제로만 두면 CI에서 조용히 깨진다.
 *
 * 실행: node scripts/fetch-spec.mjs 41
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, '.cure-implement');
const SIBLING_SPECS = join(ROOT, '..', 'cure-agent-be', 'docs', 'specs');

const REPO = process.env.CURE_AGENT_BE_REPO ?? 'Cure-Agent/cure-agent-be';
/**
 * **기본 ref가 `dev`인 이유**: BE의 기본 브랜치가 `dev`이고 스펙은 `dev-only`로 착지한다
 * (문서는 배포 산출물을 바꾸지 않으므로 main 머지·CD를 돌리지 않는다). 즉 **스펙은 항상 dev에
 * 먼저 있고 main에는 다음 `full` 배포가 실어 나른다** — main을 기본으로 두면 갓 쓴 스펙도,
 * dev에만 반영된 개정도 못 읽는다. 실측(2026-08-29): spec 41의 수용 기준 레포 라벨이
 * dev에 29곳, main에 2곳이었다.
 *
 * dev에서 못 찾으면 main으로 한 번 더 시도한다 — 오래된 스펙이 dev에서 정리됐을 가능성 대비.
 */
const REF = process.env.CURE_AGENT_BE_REF ?? 'dev';
const FALLBACK_REF = 'main';

const number = process.argv[2];
if (!number || !/^\d+$/.test(number)) {
  console.error('사용법: node scripts/fetch-spec.mjs <스펙 번호>   예) node scripts/fetch-spec.mjs 41');
  process.exit(1);
}
// 스펙 파일명은 zero-padding이 섞여 있다(05·41) — 양쪽 다 매칭한다
const prefixes = [`${number}-`, `${number.padStart(2, '0')}-`];

function fromSibling() {
  if (!existsSync(SIBLING_SPECS)) return null;
  const hit = readdirSync(SIBLING_SPECS).find(
    (name) => name.endsWith('.md') && prefixes.some((p) => name.startsWith(p)),
  );
  if (!hit) return null;
  return { source: join(SIBLING_SPECS, hit), body: readFileSync(join(SIBLING_SPECS, hit), 'utf8') };
}

async function fromRemote(ref) {
  const listUrl = `https://api.github.com/repos/${REPO}/contents/docs/specs?ref=${ref}`;
  const listRes = await fetch(listUrl, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'cure-agent-fe-fetch-spec' },
  });
  if (!listRes.ok) {
    throw new Error(`스펙 목록 조회 실패: HTTP ${listRes.status} — ${listUrl}`);
  }
  const entries = await listRes.json();
  const hit = entries.find(
    (e) => e.type === 'file' && e.name.endsWith('.md') && prefixes.some((p) => e.name.startsWith(p)),
  );
  if (!hit) return null;

  const rawUrl = `https://raw.githubusercontent.com/${REPO}/${ref}/docs/specs/${hit.name}`;
  const res = await fetch(rawUrl);
  if (!res.ok) throw new Error(`스펙 fetch 실패: HTTP ${res.status} — ${rawUrl}`);
  return { source: rawUrl, body: await res.text() };
}

const found =
  fromSibling() ?? (await fromRemote(REF)) ?? (REF === 'dev' ? await fromRemote(FALLBACK_REF) : null);
if (!found) {
  console.error(
    `스펙 ${number}을(를) 찾지 못했습니다.\n` +
      `  - 로컬 형제 경로: ${SIBLING_SPECS} (없거나 해당 번호 없음)\n` +
      `  - 원격: ${REPO}@${REF}${REF === 'dev' ? ` 및 @${FALLBACK_REF}` : ''} docs/specs/\n` +
      `아직 BE에 머지되지 않은 스펙이면 두 레포를 형제 디렉토리로 두고 다시 실행하세요.`,
  );
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, `spec-${number}.md`);
writeFileSync(outPath, found.body, 'utf8');
console.log(`스펙 ${number} 조달 완료`);
console.log(`  출처: ${found.source}`);
console.log(`  저장: .cure-implement/spec-${number}.md`);
