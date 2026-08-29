---
description: BE docs/specs/ 스펙의 FE 범위 구현 — 브랜치 → 테스트 동결 → 구현 → 검증 → 배포(ship 위임)
argument-hint: <spec 번호 (예: 41)>
---

# /implement — 스펙 기반 구현 하네스 (fe)

**스펙이 계약이고, 동결된 테스트가 심판이다.** 이 절차 밖의 임기응변을 금지한다.

> **스펙은 이 레포에 없다.** `docs/specs/`는 **BE 레포(`Cure-Agent/cure-agent-be`)**에 있고
> 화면 스펙도 거기 산다(`07-fe-foundation` · `08-assistant-screens` · `09` · `10` · `11` · `41` …).
> 이 프로젝트는 **단일 스펙 저장소 + 두 구현 레포** 구조다 — 계약이 하나뿐이라 스펙도 하나다.

## Phase 0 — Preflight

1. **스펙 조달**: `node scripts/fetch-spec.mjs <번호>` — 로컬 형제 경로(`../cure-agent-be/docs/specs/`)가
   있으면 그것을, 없으면 BE main의 raw를 가져와 `.cure-implement/spec-<번호>.md`에 둔다
   (`scripts/generate-api.mjs`가 계약을 가져오는 방식과 같다). 못 찾으면 중단한다.
2. **FE 범위 판별**: 스펙의 수용 기준 중 **이 레포가 책임지는 항목만** 고른다. 스펙이 항목마다
   `(BE)`/`(FE)` 라벨을 달고 있으면 그대로 따르고, **라벨이 없으면 사람에게 분할을 확인받는다** —
   추측으로 가르지 않는다. BE 범위 기준을 여기서 구현하려 들면 안 된다.
3. 스펙이 §링크한 이 레포 `docs/architecture.md` 섹션을 읽는다. **§2(API 계층 원칙)·§3(Codegen 규칙)·
   §5(테스트)는 항상 포함**한다.
   > **형태는 문서가 아니라 코드에서 본다.** 요청·응답 타입은
   > `src/shared/api/generated/schema.ts`, 화면 구조는 해당 `features/*`가 진실이다.
4. `git status` clean 확인, `git checkout main && git pull origin main`.
5. **브랜치 생성**: `"<prefix>/<슬러그>"` → checkout. **이슈를 만들지 않는다**
   (`automation/ship.md` 「워크플로우 전제」 — 이 레포는 PR-퍼스트다).

> **커밋 제목에 `#`를 쓰지 않는다.** 이슈가 없어 `#N`에 넣을 번호가 없고, spec 번호를 `#`와 함께
> 쓰면 **GitHub이 같은 번호의 PR로 자동 링크한다** — `[TEST/#09]`·`[TEST/#10]`·`[TEST/#11]`이
> 각각 PR #9·#10·#11(가이던스 화면·계약 동기화·fixture 수정)에 잘못 걸린 전례가 이 레포에 있다.
> 형식은 **`[TYPE] spec <번호> <요약>`**이며, squash 머지가 붙이는 `(#PR번호)`가 추적 식별자다.

## Phase 1 — 계획

- FE 범위 수용 기준 각 항목 ↔ 구현 파일(레이어·feature) 매핑 계획을 세운다.
- **스펙에 모호함·결함이 있으면 구현하지 않는다.** 스펙은 BE 레포에 있으므로 **여기서 고칠 수 없다** —
  결함을 사용자에게 보고하고 BE 쪽 수정을 확정받은 뒤 진행한다. 테스트 동결 후 발견해도 동일
  (`automation/freeze.md` TEST-DISPUTE의 「명세 결함」).

## Phase 2 — 테스트 동결 (작성: Codex / 리뷰·동결: Claude)

**절차 원본은 `automation/freeze.md`다.** 그 문서를 읽고 아래 파라미터로 실행한다:

| 파라미터 | 값 |
|---|---|
| 명세 | Phase 0에서 조달한 스펙의 **FE 범위 기준** + §링크한 `docs/architecture.md` 섹션 |
| 작업 ID | **스펙 번호** (커밋 제목 `[TEST] spec <번호> …`에 쓰인다 — `#` 금지) |
| 동결 단위 | 스펙 1개 = 1 단위 |
| 참조 패턴 파일 | `src/shared/api/http.test.ts` + 대상 화면의 기존 `*.test.tsx` 1~2개 전문 |

Codex 프롬프트에 **이 레포가 책임지는 기준만** 싣고, BE 범위는 「건드리지 마라」로 명시한다 —
싣지 않으면 Codex가 BE 동작을 FE에서 단언하려 시도한다.

## Phase 3 — 구현

동결 테스트가 전부 통과할 때까지 구현한다. 필수 규칙:

- **API 3계층을 넘나들지 않는다** (§2): 전송(`shared/api/http.ts`) → 봉투 해석
  (`shared/api/api-client.ts`) → 소비(`features/*/api/`). 전송 계층은 봉투 규약을 모르고,
  feature는 fetch를 직접 부르지 않는다
- **`shared/api/generated/`·`openapi/`는 codegen 산출물이다 — 수동 편집 금지** (§3). CI의
  재생성 diff = 0 검사가 강제한다. 계약이 부족하면 BE 스펙 문제이지 여기서 메울 일이 아니다
- **수동 DTO를 만들지 않는다** (§3) — 타입은 전부 `generated/schema.ts`에서 가져온다
- **enum에 exhaustive switch를 쓸 때 `default`를 반드시 둔다** (§3 전방 호환)
- **토큰이 FE 코드·스토리지에 등장하면 안 된다** (§2) — HttpOnly 쿠키로만 존재한다
- 스트리밍 중간 상태는 TanStack Query가 아니라 `model/stream-state.model.ts`가 갖는다 (§4)
- 테스트는 MSW로 모킹한다 — 수동 mock 금지 (§5). e2e 하네스는 **미스텁 요청을 실패로 잡으므로**
  새로 부르는 엔드포인트가 생기면 해당 spec의 스텁도 함께 추가한다
- `.design-sync/config.json`의 `componentSrcMap`에 등록된 컴포넌트를 고쳤으면 **재동기화가 배포보다
  먼저다** (`automation/ship.md` 「워크플로우 전제」) — ship Preflight의 드리프트 게이트가 강제한다

## Phase 4 — 검증

1. `pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build` 전부 green.
2. **동결 무결성 감사**: `automation/freeze.md`의 「사후 감사」를 실행한다 — 동결 커밋에서 목록을
   복원해 `git diff`가 비어 있는지 확인하고, 비어있지 않으면 중단·보고한다. 감사는 항상 **마지막
   코드 변경 뒤**에 실행하고, 감사 이후 코드가 다시 바뀌면 재실행한다.
3. 수용 기준 항목별 → 커버하는 테스트 매핑을 만든다 (최종 보고·PR 본문에 포함).
4. 스펙의 Out of scope를 침범하지 않았는지 점검한다.
5. **사용자 확인 대기** — 수용 기준 매핑을 보고하고 배포 승인을 받는다. OK 시에도 **동결은 아직
   해제하지 않는다**(배포 실패로 재수정하는 시나리오에서 테스트가 무방비가 되지 않도록).

   > **spec 승인이 이것을 대체하지 않는다.** spec은 「무엇을 만들지」의 합의이고 여기는 「이렇게
   > 만들어진 결과물을 배포할지」다. Phase 5가 `automation/ship.md`에 위임하면 ship Preflight가
   > feature 브랜치를 감지해 **Phase 1·3을 스킵**하므로 ship이 가진 사용자 확인이 건너뛰어지고,
   > 이후 `automation/pipeline.md`가 PR → 머지 → **Vercel 프로덕션 배포**까지 멈추지 않는다.
   > 이 레포는 `main` = 프로덕션이라 되돌릴 창이 BE보다 좁다.

## Phase 5 — 배포·후속

1. 구현 커밋: `[FEAT] spec <번호> <요약>` — 동결 커밋과 분리 유지. 트레일러:
   `Co-Authored-By: Claude Code <noreply@anthropic.com>`
2. **배포는 `automation/ship.md`에 위임한다.** 그 문서를 읽고 실행하면 현재 feature 브랜치를
   Preflight가 감지해 **Phase 1·3을 스킵하고 Phase 2(검증)로 직행**한다.
   전달할 컨텍스트: 브랜치명, 타입, 스펙 번호, 그리고 **Phase 4-1 검증 완료 사실**(전 구간 green) —
   ship Preflight의 검증 스킵 판정 입력이다.
   - PR 본문에는 **스펙 번호·BE 링크 + 수용 기준 ↔ 테스트 매핑 표**를 넣는다.
3. **배포 성공 후** `automation/freeze.md`의 「동결 해제」를 수행한다 — 배포가 실패해 코드를
   재수정하는 동안은 동결을 유지해 테스트를 계속 보호한다.
4. **브랜치 정리**는 `automation/pipeline.md`가 수행한다. 누락되면 스텝마다 브랜치가 누적되므로
   최종 보고 전에 `git branch -a`로 확인한다.
   > **squash 머지 함정**: squash는 커밋 SHA를 새로 만들므로 원본 브랜치는 `main`의 조상이
   > **아니다**. `git branch -d`가 거부하는데, 확인 없이 `-D`를 쓰면 머지되지 않은 작업을 조용히
   > 날린다. **PR 머지 여부를 먼저 확인**한 뒤 확인된 것만 지운다:
   > `gh pr list --head <브랜치> --state merged --json number`
5. 최종 보고: 수용 기준 매핑, 계약 소비 변경 여부, 동결 해제 완료 여부.
