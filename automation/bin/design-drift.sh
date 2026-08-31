#!/usr/bin/env bash
# 디자인 시스템 드리프트 게이트 — ship이 design-sync 재동기화를 건너뛰고 배포하는 것을 막는다.
#
# 판정 대상은 .design-sync/config.json 의 두 필드를 합친 것이다:
#   componentSrcMap 의 값 — 카드가 되는 컴포넌트 소스
#   driftWatch      — 그 컴포넌트들이 가져다 쓰는 것 (git pathspec, ':!' 제외 문법 허용)
#
# driftWatch 가 따로 있는 이유: componentSrcMap 의 키가 이 레포에서 **카드 목록을 정하는
# 유일한 것**이라(NOTES.md 의 LogoMark 절) 감시 대상을 늘리려고 거기에 helper 를 넣으면
# 카드가 생겨 버린다. 감시 목록과 카드 목록은 갈라 둬야 한다.
#
# 2026-08-31 이전에는 componentSrcMap 만 봤고, 그래서 등록 컴포넌트가 import 하는 것을
# 고친 배포가 전부 새어 나갔다 — 실측으로 번들에 실리는 src 파일 47개 중 14개만 감시하고
# 있었다(커버리지 30%). driftWatch 는 그 47개를 덮는 디렉터리를 포함 나열한다.
# src/app 을 ':!' 로 빼지 않고 features/shared/widgets 를 나열하는 쪽을 고른 이유는,
# git pathspec 의 제외가 포함보다 우선이라 'src' 를 넣고 src/app 을 빼면 그 안의
# utilities.css 를 도로 넣을 수 없기 때문이다.
#
# .design-sync/ 자체(config.json·previews/)는 재동기화가 만들어내는 산출물이라 감시하지 않는다 —
# 넣으면 "동기화 → 산출물 변경 → 또 DRIFT" 로 사용자에게 한 바퀴 더 돌게 만든다.
# (한계: 사람이 previews/ 를 손으로 고친 경우는 잡히지 않는다.
#  또 하나: Tailwind 출력은 @source 가 훑는 src 전체의 클래스 사용에 의존하므로,
#  감시 밖인 src/app 라우트에서 새 클래스를 처음 쓰면 번들 CSS 변경이 잡히지 않는다.
#  라우트는 프리뷰에 실리지 않아 카드가 어긋날 경로가 좁고, 다음 재동기화가 따라잡는다.)
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
  || die_error "jq가 필요합니다 (componentSrcMap·driftWatch 파싱)"

SRC=$(jq -r '((.componentSrcMap // {}) | .[]), ((.driftWatch // [])[])' "$CONFIG" 2>&1) \
  || die_error "config.json 파싱 실패: $SRC"

PATHS=()
while IFS= read -r p; do
  [ -n "$p" ] && PATHS+=("$p")
done <<EOF
$SRC
EOF

if [ "${#PATHS[@]}" -eq 0 ]; then
  echo "$MARK result=SKIP reason=empty-watch"
  exit 0
fi

# 제외(':!')만 남으면 git 은 "제외되지 않은 전부" 로 매칭해 리포 전체가 DRIFT 로 걸린다.
# 포함이 하나도 없다는 것은 감시 대상이 없다는 뜻이므로, 전체 매칭 대신 SKIP 한다
# (빈 pathspec 방지와 같은 이유의 방어다).
INCLUDES=0
for p in "${PATHS[@]}"; do
  case "$p" in
    ':!'* | ':(exclude)'*) ;;
    *) INCLUDES=$((INCLUDES + 1)) ;;
  esac
done
if [ "$INCLUDES" -eq 0 ]; then
  echo "$MARK result=SKIP reason=exclude-only"
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
