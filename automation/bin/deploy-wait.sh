#!/usr/bin/env bash
# Vercel 프로덕션 배포 대기 — main 머지 커밋의 GitHub Deployment(environment=Production) 상태를
# 폴링한다 (30초 간격, 최대 10분). 병합 커밋에는 check-run/commit-status가 붙지 않으므로
# Deployments API를 본다.
#
# 상태는 최신 1건이 아니라 **이력 전체**에서 판정한다 — 새 배포가 성공하면 GitHub가 이전 배포에
# inactive 상태를 자동으로 덧붙이므로(연속 머지), 최신 상태만 보면 성공한 배포를 놓친다.
#
# 사용법: deploy-wait.sh <머지커밋SHA>
# 종료 마커: DEPLOY_RESULT result=success|failure|error|SUPERSEDED|TIMEOUT|API_ERROR
#   SUPERSEDED = 종료 상태 없이 더 새 배포로 대체됨 — 최신 프로덕션 배포에 이 커밋이 포함됐는지 확인할 것.
set -u

SHA=${1:?usage: deploy-wait.sh <머지커밋SHA>}
OWNER_REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner') \
  || { echo "DEPLOY_RESULT result=API_ERROR"; exit 1; }
INTERVAL=30
LIMIT=600
API_ERRORS=0
SECONDS=0

# GitHub 조회 실패를 pending으로 삼키지 않는다 — 3회 연속 실패 시 API_ERROR로 종료.
api_fail() {
  API_ERRORS=$((API_ERRORS + 1))
  echo "GitHub API query failed ($API_ERRORS/3)"
  if [ "$API_ERRORS" -ge 3 ]; then echo "DEPLOY_RESULT result=API_ERROR"; exit 1; fi
}

while :; do
  if DEP=$(gh api "repos/$OWNER_REPO/deployments?sha=$SHA&environment=Production" --jq '.[0].id // empty'); then
    API_ERRORS=0
    if [ -n "$DEP" ]; then
      if STATES=$(gh api "repos/$OWNER_REPO/deployments/$DEP/statuses" --jq '[.[].state] | join(" ")'); then
        API_ERRORS=0
        case " $STATES " in
          *" success "*)  echo "DEPLOY_RESULT result=success"; exit 0 ;;
          *" failure "*)  echo "DEPLOY_RESULT result=failure"; exit 1 ;;
          *" error "*)    echo "DEPLOY_RESULT result=error"; exit 1 ;;
          *" inactive "*) echo "DEPLOY_RESULT result=SUPERSEDED"; exit 1 ;;
        esac
      else
        api_fail
      fi
    fi
  else
    api_fail
  fi
  if [ "$SECONDS" -ge "$LIMIT" ]; then echo "DEPLOY_RESULT result=TIMEOUT"; exit 1; fi
  sleep "$INTERVAL"
done
