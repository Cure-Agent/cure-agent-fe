#!/usr/bin/env bash
# automation/bin 게이트 스크립트 스모크 테스트 — CI(scripts 잡)와 로컬에서 동일하게 실행한다.
# 핵심 검증 대상 셋: (3) 민감 파일 훅(.claude/hooks) — 하네스 stdin JSON으로 deny가 나오는지. (1) fail-closed 성질 — git 조회 실패가 통과(PASS)로 새지 않고
# ERROR(비 0 종료)로 끝나는지, (2) merge-gate.jq 판정 로직 — fixture JSON으로 게이트 규칙을 검증.
# gh 호출이 필요 없는 경로만 검사한다. 의존성은 git·jq뿐이다(둘 다 ubuntu 러너 기본 설치).
# 종료 마커: SMOKE result=PASS|FAIL
set -u

BIN=$(cd "$(dirname "$0")" && pwd) || exit 1
command -v jq >/dev/null 2>&1 \
  || { echo "jq가 필요합니다 (merge-gate 판정 테스트)"; echo "SMOKE result=FAIL"; exit 1; }
FAILED=0

# check <설명> <기대 종료코드> <기대 마커> <명령...>
check() {
  local desc=$1 want_rc=$2 want_marker=$3
  shift 3
  local out rc
  out=$("$@" 2>&1)
  rc=$?
  if [ "$rc" -ne "$want_rc" ] || ! grep -q "$want_marker" <<<"$out"; then
    echo "FAIL: $desc (rc=$rc, 기대 rc=$want_rc, 기대 마커 '$want_marker')"
    # 여러 줄 들여쓰기는 sed가 더 명확하다
    # shellcheck disable=SC2001
    sed 's/^/  | /' <<<"$out"
    FAILED=1
  else
    echo "ok: $desc"
  fi
}

# hook_check <설명> <기대: deny|pass> <command 문자열> — 훅에 하네스(Claude Code·Codex)가 주는 stdin JSON을 흘려 판정한다
HOOK="$BIN/../../.claude/hooks/validate-git-sensitive.sh"
hook_check() {
  local desc=$1 want=$2 cmd=$3
  local out rc
  out=$(jq -cn --arg c "$cmd" '{tool_name:"Bash",tool_input:{command:$c}}' | "$HOOK" 2>&1)
  rc=$?
  local got="pass"
  grep -q '"permissionDecision": "deny"' <<<"$out" && got="deny"
  if [ "$rc" -ne 0 ] || [ "$got" != "$want" ]; then
    echo "FAIL: $desc (rc=$rc, 판정=$got, 기대=$want)"
    # shellcheck disable=SC2001
    sed 's/^/  | /' <<<"$out"
    FAILED=1
  else
    echo "ok: $desc"
  fi
}

# 스크래치 리포 — 사용자 리포의 인덱스·워킹트리를 건드리지 않는다.
TMP=$(mktemp -d) || exit 1
trap 'rm -rf "$TMP"' EXIT
git -C "$TMP" init -q
echo hi > "$TMP/note.txt"
git -C "$TMP" add note.txt
git -C "$TMP" -c user.email=smoke@test -c user.name=smoke commit -qm init
cd "$TMP" || exit 1

check "sensitive-gate: 민감 파일 없음 → PASS" \
  0 "SENSITIVE_GATE result=PASS" "$BIN/sensitive-gate.sh"
echo secret > .env
git add -f .env
check "sensitive-gate: .env 스테이징 → BLOCKED" \
  1 "SENSITIVE_GATE result=BLOCKED" "$BIN/sensitive-gate.sh"
git reset -q HEAD .env
echo 'KEY=' > .env.example
git add -f .env.example
check "sensitive-gate: .env.example 스테이징 → PASS (템플릿 예외)" \
  0 "SENSITIVE_GATE result=PASS" "$BIN/sensitive-gate.sh"
git reset -q HEAD .env.example
echo key > AuthKey_test.p8
git add -f AuthKey_test.p8
check "sensitive-gate: *.p8 스테이징 → BLOCKED" \
  1 "SENSITIVE_GATE result=BLOCKED" "$BIN/sensitive-gate.sh"
git reset -q HEAD AuthKey_test.p8
echo '{}' > .mcp.json
git add -f .mcp.json
check "sensitive-gate: .mcp.json 스테이징 → BLOCKED" \
  1 "SENSITIVE_GATE result=BLOCKED" "$BIN/sensitive-gate.sh"
git reset -q HEAD .mcp.json
check "sensitive-gate: git 실패 → ERROR (fail-closed)" \
  1 "SENSITIVE_GATE result=ERROR" env GIT_DIR=/nonexistent "$BIN/sensitive-gate.sh"

# --- 훅 (.claude/hooks/validate-git-sensitive.sh) — 하네스 stdin JSON을 모사해 deny/pass를 판정한다.
# 핵심은 명시 인자 파싱이 광역 판정으로 새지 않는 것이다 — macOS sed는 \b를 몰라 원본 훅이 그랬고,
# 그 결과 `git add -f .env`(ignored 민감 파일 강제 추가)가 통과했다.
# 위 sensitive-gate 테스트가 남긴 untracked 파일을 치워 판정 대상을 .env 하나로 고정한다.
rm -f .env.example AuthKey_test.p8 .mcp.json
echo secret > .env
hook_check "hook: git 외 명령은 통과" pass "pnpm build"
hook_check "hook: git status는 통과" pass "git status --short"
hook_check "hook: git add .env → deny" deny "git add .env"
hook_check "hook: git add -A (광역) → untracked .env 감지 → deny" deny "git add -A && git commit -m x"
hook_check "hook: git add README.md (명시·비민감) → 통과" pass "git add README.md"
git add -f .env
hook_check "hook: .env 스테이징 상태의 git commit → deny" deny "git commit -m 'x'"
git reset -q HEAD .env
hook_check "hook: 스테이징 해제 후 git commit → 통과" pass "git commit -m 'x'"
printf '.env*\n' > .gitignore
hook_check "hook: ignored 민감 파일을 git add -f <파일>로 명시 → deny (명시 인자 파싱)" deny "git add -f .env"
hook_check "hook: ignored 민감 파일 + git add -A -f (광역 강제) → deny" deny "git add -A -f"
hook_check "hook: git add . (광역, 민감 파일은 ignored) → 통과 (git도 ignored는 add하지 않는다)" pass "git add ."
hook_check "hook: git add -f README.md (강제지만 명시·비민감) → 통과" pass "git add -f README.md"
hook_check "hook: git add -- .env (옵션 종료 뒤 명시) → deny" deny "git add -- .env"
rm -f .gitignore .env

# --- design-drift 판정 테스트 (기준 ref는 origin/main이 없는 스크래치 리포라 HEAD를 쓴다)
DRIFT="$BIN/design-drift.sh"
check "design-drift: config 없음 → SKIP" \
  0 "DESIGN_DRIFT result=SKIP reason=no-config" "$DRIFT" HEAD

mkdir -p .design-sync/.cache src
echo 'export const Btn = () => null' > src/btn.tsx
printf '{"componentSrcMap":{"Btn":"src/btn.tsx"}}' > .design-sync/config.json
git add -f src/btn.tsx .design-sync/config.json
git -c user.email=smoke@test -c user.name=smoke commit -qm ds
check "design-drift: 등록 소스 변경 없음 → CLEAN" \
  0 "DESIGN_DRIFT result=CLEAN" "$DRIFT" HEAD

echo '// touched' >> src/btn.tsx
check "design-drift: 소스 변경 + 앵커 없음 → DRIFT (판정 불가는 안전측)" \
  1 "DESIGN_DRIFT result=DRIFT changed=1 reason=anchor-absent" "$DRIFT" HEAD

echo '{}' > .design-sync/.cache/remote-sync.json
touch -t 203001010000 .design-sync/.cache/remote-sync.json
touch -t 202001010000 src/btn.tsx
check "design-drift: 앵커가 소스보다 최신 → CLEAN (동기화 후 재실행이 또 걸리지 않는다)" \
  0 "DESIGN_DRIFT result=CLEAN" "$DRIFT" HEAD

touch -t 200001010000 .design-sync/.cache/remote-sync.json
touch src/btn.tsx
check "design-drift: 소스가 앵커보다 최신 → DRIFT" \
  1 "DESIGN_DRIFT result=DRIFT changed=1 reason=stale-sources" "$DRIFT" HEAD

touch -t 203001010000 .design-sync/.cache/remote-sync.json
rm src/btn.tsx
check "design-drift: 등록 소스 삭제 → DRIFT (앵커가 최신이어도 잡는다)" \
  1 "DESIGN_DRIFT result=DRIFT changed=1" "$DRIFT" HEAD

git checkout -q -- src/btn.tsx

# --- 감시 목록: 카드가 아닌 의존 파일도 감시 대상에 넣는다 (componentSrcMap 은 카드 목록이라 못 쓴다).
# 목록이 config.json 이 아니라 별도 파일인 이유는 config.json 이 design-sync 컨버터의 스키마라
# 모르는 키를 보면 빌드 자체를 거부하기 때문이다 (NOTES.md 「감시 목록을 config.json 에 두면」).
mkdir -p src/shared
echo 'export const token = 1' > src/shared/helper.ts
printf '{"componentSrcMap":{"Btn":"src/btn.tsx"}}' > .design-sync/config.json
printf '["src/shared",":!src/**/*.test.*"]' > .design-sync/drift-watch.json
git add -f src/shared/helper.ts .design-sync/config.json .design-sync/drift-watch.json
git -c user.email=smoke@test -c user.name=smoke commit -qm watch
touch -t 203001010000 .design-sync/.cache/remote-sync.json
check "design-drift: 감시 목록 대상 변경 없음 → CLEAN" \
  0 "DESIGN_DRIFT result=CLEAN" "$DRIFT" HEAD

touch -t 200001010000 .design-sync/.cache/remote-sync.json
echo '// touched' >> src/shared/helper.ts
check "design-drift: 감시 목록의 helper 변경 → DRIFT (componentSrcMap 만 봤다면 놓쳤을 자리)" \
  1 "DESIGN_DRIFT result=DRIFT changed=1 reason=stale-sources" "$DRIFT" HEAD

git checkout -q -- src/shared/helper.ts
echo 'export const x = 1' > src/shared/helper.test.ts
check "design-drift: 감시 목록의 ':!' 제외가 먹는다 → CLEAN (테스트 파일은 번들에 안 실린다)" \
  0 "DESIGN_DRIFT result=CLEAN" "$DRIFT" HEAD
rm src/shared/helper.test.ts

printf '{"componentSrcMap":{}}' > .design-sync/config.json
printf '[":!src/**/*.test.*"]' > .design-sync/drift-watch.json
check "design-drift: 제외 pathspec만 남음 → SKIP (git의 '제외 외 전부' 매칭 방지)" \
  0 "DESIGN_DRIFT result=SKIP reason=exclude-only" "$DRIFT" HEAD

rm .design-sync/drift-watch.json
check "design-drift: 감시 대상 비어 있음 → SKIP (빈 pathspec으로 전체 매칭 방지)" \
  0 "DESIGN_DRIFT result=SKIP reason=empty-watch" "$DRIFT" HEAD

# 목록 파일이 깨진 것은 통과가 아니라 ERROR다 — 감시가 조용히 사라지면 배포가 새어 나간다
printf '{"not":"an array"}' > .design-sync/drift-watch.json
check "design-drift: 감시 목록이 배열이 아님 → ERROR (fail-closed)" \
  1 "DESIGN_DRIFT result=ERROR" "$DRIFT" HEAD
rm .design-sync/drift-watch.json

git checkout -q -- .design-sync/config.json
check "design-drift: 없는 기준 ref → ERROR (fail-closed)" \
  1 "DESIGN_DRIFT result=ERROR" "$DRIFT" no-such-ref
check "design-drift: git 실패 → ERROR (fail-closed)" \
  1 "DESIGN_DRIFT result=ERROR" env GIT_DIR=/nonexistent "$DRIFT" HEAD

# --- merge-gate.jq 판정 fixture 테스트 (gh 없이 게이트 규칙 자체를 검증)
GATE_JQ="$BIN/merge-gate.jq"
CHECKRUN_OK='{"__typename":"CheckRun","name":"codegen-check","status":"COMPLETED","conclusion":"SUCCESS"}'
VERCEL_OK='{"__typename":"StatusContext","context":"Vercel","state":"SUCCESS"}'

printf '{"mergeable":"MERGEABLE","statusCheckRollup":[%s,%s]}' \
  "$CHECKRUN_OK" "$VERCEL_OK" > fixture.json
check "merge-gate.jq: 전부 성공 → PASS" \
  0 "^PASS$" jq -r -f "$GATE_JQ" fixture.json

printf '{"mergeable":"MERGEABLE","statusCheckRollup":[{"__typename":"CheckRun","name":"codegen-check","status":"COMPLETED","conclusion":"FAILURE"},%s]}' \
  "$VERCEL_OK" > fixture.json
check "merge-gate.jq: 체크 실패 → FAIL failed=" \
  0 "^FAIL failed=codegen-check" jq -r -f "$GATE_JQ" fixture.json

printf '{"mergeable":"MERGEABLE","statusCheckRollup":[%s]}' \
  "$CHECKRUN_OK" > fixture.json
check "merge-gate.jq: Vercel 부재 → PENDING (vacuous pass 방지)" \
  0 "^PENDING vercel=ABSENT" jq -r -f "$GATE_JQ" fixture.json

printf '{"mergeable":"MERGEABLE","statusCheckRollup":[%s]}' \
  "$VERCEL_OK" > fixture.json
check "merge-gate.jq: Vercel만 있고 CI 미등록 → PENDING (조기 vacuous pass 방지)" \
  0 "^PENDING" jq -r -f "$GATE_JQ" fixture.json

printf '{"mergeable":"MERGEABLE","statusCheckRollup":[%s,%s,{"__typename":"StatusContext","context":"Vercel Preview Comments","state":"FAILURE"}]}' \
  "$CHECKRUN_OK" "$VERCEL_OK" > fixture.json
check "merge-gate.jq: 비차단 예외 실패는 무시 → PASS" \
  0 "^PASS$" jq -r -f "$GATE_JQ" fixture.json

printf '{"mergeable":"CONFLICTING","statusCheckRollup":[%s,%s]}' \
  "$CHECKRUN_OK" "$VERCEL_OK" > fixture.json
check "merge-gate.jq: 충돌 → FAIL mergeable=CONFLICTING" \
  0 "mergeable=CONFLICTING" jq -r -f "$GATE_JQ" fixture.json

printf '{"mergeable":"MERGEABLE","statusCheckRollup":[]}' > fixture.json
check "merge-gate.jq: 체크 0개 → PENDING (vacuous pass 방지)" \
  0 "^PENDING" jq -r -f "$GATE_JQ" fixture.json

if [ "$FAILED" -ne 0 ]; then
  echo "SMOKE result=FAIL"
  exit 1
fi
echo "SMOKE result=PASS"
