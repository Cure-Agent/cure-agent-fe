# ship — 코드 변경 배포 자동화 (하네스 중립 명세)

워킹 트리의 코드 변경사항을 검증하고 배포까지 자동화한다.
코드 수정이 이미 완료된 상태에서 사용한다 — 문제 분석·코드 변경은 수행하지 않는다.

> **이 파일은 하네스 중립 「진실의 원천」이다.** 직접 실행 대상이 아니라, 사용하는 LLM 하네스의 진입 어댑터를 통해 실행된다:
> - Claude Code → `.claude/commands/ship.md`
> - Codex → `.codex/skills/ship/SKILL.md`
> - Gemini → `.gemini/commands/ship.toml`
>
> 각 어댑터는 **폴링 모드**와 **안전 규칙 적용 방식**(훅 유무)을 지정한다. 배포(Phase 4)의 CI·Vercel 체크 폴링은 `automation/pipeline.md`의 「폴링 실행 규칙」에 정의된 **하네스별 모드**를 따른다.

## 워크플로우 전제 (fe)

- **PR-퍼스트**: 이슈를 새로 만들지 않는다. `<prefix>/<슬러그>` 브랜치 → `main` PR → 머지 → Vercel 자동 배포. 사람이 이미 만든 이슈가 있으면 브랜치 슬러그에 번호를 넣고(관행: `feat/11-history-screens`) PR 본문 `Closes #N`으로 연결한다(선택).
- **라벨·담당자 자동화는 없다.** ship는 라벨·담당자를 부여하지 않는다 — 컨벤션에 맞는 PR 제목·브랜치명만 만든다.
- **`main` = 프로덕션**. `main` push를 Vercel이 감지해 프로덕션 배포한다. 별도 CD 워크플로우는 없다.
- **계약 동기화 PR(`chore/contract-sync`)은 ship 대상이 아니다** — Contract Sync 워크플로우가 자동 생성하고, CI 확인 후 사람이 머지한다 (architecture.md §3).
- **디자인 시스템 재동기화가 배포보다 먼저다.** `.design-sync/config.json`의 `componentSrcMap`에 등록된 컴포넌트를 고쳤으면 claude.ai/design 재동기화를 마친 뒤 ship한다 — 재동기화가 고치는 `config.json`·`previews/`가 커밋 대상이라(`.gitignore`가 `.cache/`만 제외한다) 같은 배포 커밋에 실려야 한다. Preflight의 드리프트 게이트가 이 순서를 강제한다. **재동기화 자체는 ship이 수행하지 않는다** — Claude Code 전용 `DesignSync` 도구와 사람이 승인하는 업로드가 필요해 하네스 중립이 아니다. 게이트는 판정만 하고 중단한다. 재동기화 절차는 `.design-sync/NOTES.md`의 「재동기화 한 줄 요약」이 원천이다.

## Preflight

1. `gh auth status` — 인증 실패 시 **중단**.
2. `git fetch origin main` — 이후 모든 main 대비 비교(변경 유무 판정 등)는 **`origin/main` 기준**이다. 로컬 `main`은 뒤처져 있을 수 있으므로 비교 기준으로 쓰지 않는다.
3. 현재 브랜치 판별:
   - **feature 브랜치** (`<prefix>/...`, `main` 아님):
     - 브랜치 prefix에서 타입을 파싱한다.
     - `git log origin/main..HEAD`와 `git status --porcelain`으로 변경사항 확인 — 커밋도 변경도 없으면 **중단** ("배포할 변경사항이 없습니다"). 변경 유무 판정에 `git diff`(무인자)를 쓰지 않는다 — staged 변경이 보이지 않는다.
     - 최신 동기화: `git pull --rebase --autostash origin main` — 충돌 처리는 main 경로와 동일하다(자동 해결하지 않는다). 이 rebase로 Phase 1의 분석 diff에 main 쪽 무관한 변경이 섞이지 않고, Phase 2가 실제 push될 트리를 검증하며, `automation/pipeline.md` Step 1-2의 rebase는 사실상 no-op이 된다. 브랜치가 이미 push돼 있었어도 Step 1-3의 `--force-with-lease` push가 재작성된 커밋을 안전하게 반영한다.
     - **Phase 3(브랜치 생성)을 스킵**한다 (타입은 브랜치 prefix로 확정).
   - **`main`**:
     - `git log origin/main..HEAD --oneline` — **push 안 된 로컬 커밋이 있으면 중단**하고 커밋 목록과 함께 보고한다. `main` 직접 커밋은 ship가 배포하지 않는다 — 워킹트리만 보는 아래 판정이 이 커밋들을 놓치므로, 사용자가 브랜치로 옮기는 등 직접 처리해야 한다.
     - `git status --porcelain` — 변경사항이 없으면 **중단** ("배포할 변경사항이 없습니다").
     - 최신 동기화: `git pull --rebase --autostash origin main`. **충돌 시 자동 해결하지 않는다** — rebase 충돌은 `git rebase --abort`로 원상복구 후 보고하고 중단, autostash 재적용 충돌은 변경이 stash에 보존된 상태이므로(`git stash list`로 확인) 그대로 두고 보고하고 중단한다.
     - feature 브랜치는 Phase 3에서 생성한다.
4. **디자인 시스템 드리프트 게이트**: `automation/bin/design-drift.sh` 실행 (기준 ref 인자 생략 시 `origin/main`). 3의 rebase가 끝나 `origin/main` 비교 기준이 확정된 뒤, **Phase 2의 무거운 검증(`pnpm build` 등)에 들어가기 전에** 판정한다 — 빌드를 다 돌린 뒤 "재동기화 먼저" 로 중단하면 그만큼 버린다. 판정 대상·DRIFT 조건은 **스크립트 상단 주석이 원천**이다(`smoke-test.sh`가 회귀 검증).
   - `result=CLEAN`·`result=SKIP` → Phase 1로 진행한다.
   - `result=DRIFT` → 출력된 소스 목록과 함께 **재동기화가 필요하다고 보고하고 중단**한다. ship은 재동기화를 대신 수행하지 않는다 (「워크플로우 전제」 참고). 사용자가 이번 배포에서 동기화를 건너뛰겠다고 **명시하면** 그대로 Phase 1로 진행한다.
   - `result=ERROR` → jq 부재 또는 git 조회 실패(fail-closed). 드리프트 없음으로 취급하지 않고 보고 후 중단한다.

## Phase 1: 변경사항 분석

> 사용자가 인자로 타입과 설명을 직접 제공한 경우 (예: `ship feat 히스토리 검색 추가`), 해당 값을 사용하고 사용자 확인 없이 Phase 2로 직행한다.

1. `git diff origin/main`과 `git status --porcelain`(untracked 신규 파일 확인)으로 변경된 파일과 내용을 분석한다. 무인자 `git diff`를 쓰지 않는다 — staged·커밋된 변경이 보이지 않아, 변경이 모두 커밋된 feature 브랜치에서는 분석 대상이 비어 보인다.
2. 변경 성격에 맞는 타입을 결정한다 (기존 관행: PR 제목 `[FEAT/#11] 히스토리 2-pane 화면 구현`, 브랜치 `feat/11-history-screens`):

   | 타입 | 브랜치 prefix | PR 제목 |
   |------|---------------|---------|
   | 기능 | `feat/` | `[FEAT/#이슈] 설명` |
   | 버그 수정 | `fix/` | `[FIX] 설명` |
   | 리팩토링 | `refactor/` | `[REFACTOR] 설명` |
   | 테스트 | `test/` | `[TEST/#이슈] 설명` |
   | 문서 | `docs/` | `[DOCS/#이슈] 설명` |
   | 기타 | `chore/` | `[CHORE] 설명` |
   | CI | `ci/` | `[CI] 설명` |

   연결 이슈가 없으면 `/#이슈`를 생략한다 (예: `[FEAT] 설명`).
3. 변경 내용을 한 줄로 요약한다.
4. **사용자 확인 대기**:
   ```
   변경사항 요약:
   - 타입: feat
   - 설명: ...
   - 변경 파일: N개

   이대로 배포를 진행할까요? (타입이나 설명을 변경하려면 알려주세요)
   ```

## Phase 2: 검증

CI(`.github/workflows/ci.yml`)의 머지 게이트 잡(`codegen-check`)과 **동일한 게이트를 같은 순서**로 로컬 선검증한다 — 전체 검사로 대체하지 않는다. (`scripts` 잡은 `automation/bin` 게이트 스크립트 회귀 검증이라 스크립트를 수정한 변경이 아니면, `gitleaks` 잡은 히스토리 시크릿 스캔이라 어느 변경이든 로컬 선검증 대상이 아니다 — 머지 게이트에서 함께 검사된다.)

### 게이트 — `codegen-check` 잡

1. **계약 재생성**: `pnpm api:generate`
2. **드리프트 0 확인**: `git diff --exit-code openapi src/shared/api/generated` — diff가 나오면 생성물 수동 편집이거나 생성 누락이다 (architecture.md §3). 자동으로 커밋에 섞지 말고 보고 후 중단한다.
3. **타입 검사**: `pnpm typecheck` — stale `.next/types`가 옛 라우트를 참조해 헛실패할 수 있다. 라우트가 바뀐 변경이면 `rm -rf .next` 후 실행한다 (CI는 fresh 체크아웃이라 이 문제가 없다).
4. **유닛 테스트**: `pnpm test`
5. **빌드**: `pnpm build`

- 게이트 실패 시 → 실패 내용을 사용자에게 보고하고 **중단**한다 (자동 수정하지 않는다). 원인 확인은 파일 읽기 도구로 최소한만 하고, 심층 진단하지 않는다.
- `pnpm install --frozen-lockfile`이 필요한 상태(lockfile 변경 등)면 먼저 설치한다.

## Phase 3: 브랜치 (이슈 생성 없음)

> Preflight에서 이미 feature 브랜치로 진입한 경우 이 Phase를 스킵한다.

1. feature 브랜치 생성: `<prefix>/<슬러그>` → checkout (변경사항은 워킹 트리에 그대로 유지됨).
   - 슬러그는 변경 내용을 나타내는 짧은 **영문 kebab-case**로 만들고, 연결 이슈가 있으면 앞에 번호를 붙인다 (기존 관행: `feat/11-history-screens`, `fix/conversation-fixture-status`).
2. 이슈는 생성하지 않는다. 연결할 기존 이슈가 있으면 번호를 기억해 Phase 4의 PR 본문 `Closes #N`에 넣는다.

## Phase 4: 배포

`automation/pipeline.md`를 읽고 Step 1부터 실행한다.
CI·Vercel 체크 대기 폴링은 `automation/pipeline.md`의 「폴링 실행 규칙」에 정의된 **현재 하네스의 폴링 모드**를 따른다 (진입 어댑터가 지정).

전달할 컨텍스트:
- 브랜치명, 타입, 설명 (Phase 1 요약 또는 사용자 인자)
- (선택) 연결 이슈번호

## 규칙

- Phase 1~3에서는 코드를 수정하지 않는다 — 이미 완료된 변경사항을 검증하는 것이 목적이다.
- 검증 실패 시 (Phase 2) 자동 수정하지 않고 사용자에게 보고한다.
- **라벨·담당자를 부여하지 않는다.**
- 모든 `gh`/`git` 명령 실패 시 에러 내용을 사용자에게 보고한다.
- PR 생성 시 `.github/PULL_REQUEST_TEMPLATE.md` 형식을 준수한다.
- **민감 파일 커밋 금지**: 배포 과정의 `git add/commit/push`는 `automation/pipeline.md`의 「민감 파일 커밋 금지」 규칙을 따른다.
