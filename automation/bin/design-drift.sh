#!/usr/bin/env bash
# 디자인 시스템 드리프트 게이트 — ship이 design-sync 재동기화를 건너뛰고 배포하는 것을 막는다.
#
# 판정 대상은 .design-sync/config.json 의 componentSrcMap 에 등록된 컴포넌트 소스뿐이다.
# .design-sync/ 자체(config.json·previews/)는 재동기화가 만들어내는 산출물이라 감시하지 않는다 —
# 넣으면 "동기화 → 산출물 변경 → 또 DRIFT" 로 사용자에게 한 바퀴 더 돌게 만든다.
# (한계: 사람이 previews/ 를 손으로 고친 경우는 잡히지 않는다.)
#
# DRIFT = 아래 둘이 모두 참일 때만이다:
#   1. 등록된 소스가 기준 ref 대비 변경됨 (= 이번 배포에 컴포넌트 변경이 들어 있다)
#   2. 그 소스가 마지막 재동기화 앵커(.design-sync/.cache/remote-sync.json)보다 새로움
#      (= 재동기화 이후에 손댔다). 1만 보면 동기화를 마친 뒤 재실행해도 계속 걸린다.
# 앵커가 없으면(새 클론 등) 2를 판정할 수 없으므로 DRIFT 로 본다.
#
# 게이트는 fail-closed다 — jq 부재나 git 조회 실패는 통과가 아니라 ERROR로 종료한다.
# 재동기화 자체는 이 스크립트가 하지 않는다(Claude Code 전용 DesignSync 도구 + 사람이 승인하는
# 업로드가 필요하다). 이 게이트는 "빠뜨렸다"는 사실만 알린다.
#
# 사용법: design-drift.sh [기준 ref]        # 기본값 origin/main
# 종료 마커: DESIGN_DRIFT result=CLEAN|DRIFT|SKIP|ERROR
#   DRIFT(종료코드 1)면 출력된 소스 목록을 사용자에게 보고하고 재동기화를 먼저 수행한다.
#   SKIP 은 이 레포에 design-sync 설정이 없다는 뜻이다(통과).
set -u

MARK=DESIGN_DRIFT
CONFIG=.design-sync/config.json
ANCHOR=.design-sync/.cache/remote-sync.json
BASE=${1:-origin/main}

die_error() { echo "$1"; echo "$MARK result=ERROR"; exit 1; }

ROOT=$(git rev-parse --show-toplevel 2>&1) \
  || die_error "git 리포를 찾을 수 없습니다: $ROOT"
cd "$ROOT" || die_error "리포 루트로 이동할 수 없습니다: $ROOT"

if [ ! -f "$CONFIG" ]; then
  echo "$MARK result=SKIP reason=no-config"
  exit 0
fi
command -v jq >/dev/null 2>&1 \
  || die_error "jq가 필요합니다 (componentSrcMap 파싱)"

SRC=$(jq -r '.componentSrcMap // {} | .[]' "$CONFIG" 2>&1) \
  || die_error "config.json 파싱 실패: $SRC"

PATHS=()
while IFS= read -r p; do
  [ -n "$p" ] && PATHS+=("$p")
done <<EOF
$SRC
EOF

if [ "${#PATHS[@]}" -eq 0 ]; then
  echo "$MARK result=SKIP reason=empty-map"
  exit 0
fi

# 추적 중인 파일의 변경(커밋·스테이징·워킹트리, 삭제 포함) + 신규 untracked 파일.
# pathspec 으로 git 이 직접 매칭하게 둔다 — 문자열 교집합을 손으로 계산하지 않는다.
CHANGED=$(git diff --name-only "$BASE" -- "${PATHS[@]}" 2>&1) \
  || die_error "git diff 실패 (기준 ref '$BASE'): $CHANGED"
UNTRACKED=$(git ls-files --others --exclude-standard -- "${PATHS[@]}" 2>&1) \
  || die_error "git ls-files 실패: $UNTRACKED"

HITS=$(printf '%s\n%s\n' "$CHANGED" "$UNTRACKED" | grep -v '^[[:space:]]*$' | sort -u || true)
if [ -z "$HITS" ]; then
  echo "$MARK result=CLEAN"
  exit 0
fi

# 앵커 대비 신선도 — 앵커보다 새롭거나 삭제된 소스만 남긴다.
REASON=stale-sources
if [ -f "$ANCHOR" ]; then
  STALE=""
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    if [ ! -e "$f" ] || [ "$f" -nt "$ANCHOR" ]; then
      STALE="${STALE}${f}
"
    fi
  done <<EOF
$HITS
EOF
  if [ -z "$STALE" ]; then
    echo "$MARK result=CLEAN"
    exit 0
  fi
  HITS=$STALE
else
  REASON=anchor-absent
fi

COUNT=$(printf '%s\n' "$HITS" | grep -cv '^[[:space:]]*$' || true)
echo "재동기화가 필요한 디자인 시스템 소스 ($REASON):"
# 여러 줄 들여쓰기는 sed가 더 명확하다
# shellcheck disable=SC2001
printf '%s\n' "$HITS" | grep -v '^[[:space:]]*$' | sed 's/^/  /'
echo "$MARK result=DRIFT changed=$COUNT reason=$REASON"
exit 1
