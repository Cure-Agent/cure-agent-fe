# merge-gate 판정 — merge-gate.sh가 `gh pr view --json mergeable,statusCheckRollup` 출력을 넘긴다.
# 출력은 "PASS" | "FAIL ..." | "PENDING ..." 한 줄. 로직을 바꾸면 smoke-test.sh의 fixture 기대값도 갱신한다.

def cname($x): (($x.name // $x.context) // "");

# Vercel은 commit status(StatusContext, .state)로, CI 등 Actions 잡은 CheckRun(.conclusion)으로
# 올라오므로 state()가 둘 다 PASS/PENDING/FAIL로 정규화한다 (NEUTRAL·SKIPPED는 통과).
def state($x):
  if $x.__typename == "StatusContext" then
    (if $x.state=="SUCCESS" then "PASS"
     elif ($x.state=="PENDING" or $x.state=="EXPECTED") then "PENDING"
     else "FAIL" end)
  else
    (if $x.status!="COMPLETED" then "PENDING"
     elif ($x.conclusion=="SUCCESS" or $x.conclusion=="NEUTRAL" or $x.conclusion=="SKIPPED") then "PASS"
     else "FAIL" end)
  end;

(.mergeable) as $m
# 게이트 대상 = 비차단 예외를 뺀 모든 체크. 이름을 고르는 게 아니라 실패 0을 요구한다.
| [.statusCheckRollup[]? | select(cname(.) != "Vercel Preview Comments")] as $checks
| [$checks[] | select(state(.)=="FAIL") | cname(.)] as $failed
| [$checks[] | select(state(.)=="PENDING") | cname(.)] as $pending
# Vercel 프리뷰 배포는 존재 자체가 필수 — 체크 등록 전 공집합 통과(vacuous pass)를 막는다.
| ([$checks[] | select(cname(.)=="Vercel")][0]) as $v
| (if $v == null then "ABSENT" else state($v) end) as $vercel
# Vercel 외 실제 체크(Actions 잡 등)가 최소 1개 있어야 PASS — Vercel만 먼저 등록된 순간
# (CI 잡 미등록) "Vercel 성공 + 대기 0"으로 통과하는 조기 vacuous pass를 막는다.
| [$checks[] | select(cname(.)!="Vercel")] as $others
| if (($failed | length) > 0 or $m=="CONFLICTING") then
    "FAIL failed=\($failed | join(",")) mergeable=\($m)"
  elif ($m=="MERGEABLE" and $vercel=="PASS" and ($pending | length)==0 and ($others | length) > 0) then
    "PASS"
  else
    "PENDING vercel=\($vercel) pending=\($pending | join(",")) mergeable=\($m)"
  end
