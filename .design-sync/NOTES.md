# design-sync 노트 (cure-agent-fe)

claude.ai/design 프로젝트: `Cure Agent Design System` — https://claude.ai/design/p/9f248790-1f98-46b1-a575-d663ea90fe90

## 이 레포의 특이점

- **디자인 시스템 패키지가 아니라 Next 앱이다.** `dist/` 도 패키지 export 도 없다.
  `.design-sync/ds-preview/entry.ts` 를 `--entry` 로 넘겨서 (1) 패키지 루트를 레포 루트로 잡고
  (2) 번들에 실릴 export 집합을 명시한다. **컴포넌트를 추가하려면 이 배럴과 `config.json` 의
  `componentSrcMap` 양쪽에 등록해야 한다.**
- **`--entry` 없이 돌리면 즉사한다**: 컨버터는 `node_modules/<pkg>/package.json` 을 가정하는데
  자기 자신은 거기 없다 (`ENOENT … node_modules/cure-agent-fe/package.json`).
- **빌드 명령 두 단계** (`cfg.buildCmd`):
  1. Tailwind 컴파일 → `.design-sync/.cache/tailwind.css` (`cfg.cssEntry` 가 가리키는 파일)
  2. `tsc -p .design-sync/tsconfig.dts.json` → `dist/types/**.d.ts`
  **둘 다 컨버터 실행 전에 돌아야 한다.** 빠뜨리면 스타일이 없거나 props 계약이 빈다.

## 왜 이렇게 했는지 (되돌리지 말 것)

- **`process` 심 (`ds-preview/process-shim.ts`)** — `src/shared/config/env.ts` 의
  `process.env.NEXT_PUBLIC_API_BASE_URL` 은 Next 빌드타임 치환에 의존한다. esbuild 는
  `process.env.NODE_ENV` 만 define 하므로 브라우저에서 `ReferenceError: process is not defined` 가
  나고 번들 초기화 전체가 죽는다. 심은 `cfg.extraEntries` 의 **첫 항목**이어야 한다
  (`.bundle-entry.mjs` 가 extraEntries 를 메인보다 먼저 re-export → 본문이 먼저 실행).
  이 파일은 어떤 것도 import 하면 안 된다.
- **`dist/types` 로 선언 방출** — 컨버터의 ts-morph 는 `.tsx` 소스가 아니라 **`.d.ts` 트리에서만**
  `<Name>Props` 를 찾는다. `lib/dts.mjs` 의 `findTypesRoot` 가 탐색하는 고정 후보
  (`build/ts`, `dist/types`, `types`, `lib`, `dist`) 중 하나여야 해서 `dist/types` 를 골랐다.
  `dist/` 는 gitignore 됨.
- **`dtsPropsFor` 14개 전부 수기 작성** — 선언을 방출해도 props 타입이
  `components['schemas']['XxxDto']` 형태의 인덱스 접근이라 `typeText` 가 `components` 로 뭉갠다.
  설계 에이전트가 쓸 수 없는 계약이라 DTO 형태를 인라인해 손으로 적었다.
  **OpenAPI 스키마가 바뀌면 여기도 같이 고쳐야 한다** (아래 재동기화 위험 참고).
- **프리뷰 프로바이더 (`ds-preview/provider.tsx`)** — react-query + Next App Router 컨텍스트를
  세우고, 전역 `fetch` 를 픽스처로 가로챈다. 쿼리 키를 추측해 캐시에 심는 대신 전송 계층을
  가로챈 이유: 앱의 진짜 경로(openapi-fetch → authFetch → unwrap)를 그대로 지나므로
  쿼리 키가 바뀌어도 안 깨진다. fetch 교체는 프로바이더가 마운트될 때만 일어난다.
- **픽스처를 번들에 re-export** — 컴포넌트 대부분이 서버 DTO 를 props 로 받아서, 프리뷰 카드와
  설계 에이전트가 같은 데모 데이터를 쓰게 했다. 카드와 실제 디자인이 어긋나지 않는다.
- **`@source "./previews/*.tsx"`** (`tailwind-entry.css`) — `.design-sync` 는 dot 디렉터리라
  Tailwind 자동 소스 탐지가 건너뛴다. **프리뷰를 새로 쓰거나 고치면 Tailwind 를 다시 컴파일해야**
  거기서 처음 쓴 클래스가 CSS 에 들어간다.
- **`.design-sync/tsconfig.json` + `ds-preview/preview-module.ts`** — 에디터 전용이고 빌드에는
  관여하지 않는다. 프리뷰는 패키지 이름 `cure-agent-fe` 로 import 하는데 (번들에서 `entry.ts` 와
  `extraEntries` 의 export 가 한 전역으로 합쳐지므로 옳다) 레포에 `node_modules/cure-agent-fe` 가
  없어 IDE 가 전부 `TS2307 Cannot find module 'cure-agent-fe'` 로 붉게 칠했다. 루트 tsconfig 의
  와일드카드는 dot 디렉터리를 건너뛰어 `pnpm typecheck` 는 조용했다 — **에디터에만 보이던 오류**다.
  이제 이 tsconfig 가 프리뷰·하네스를 명시적으로 포함하고 그 이름을 `preview-module.ts`
  (= `entry` + `provider` 스타 재export) 로 매핑한다. **`preview-module.ts` 를 `extraEntries` 나
  `--entry` 에 넣지 말 것** — 스타 export 가 겹쳐 esbuild 가 이름 충돌로 export 를 조용히 떨군다.
  덤으로 프리뷰가 처음으로 타입 검사를 받게 됐고, 그때 드러난 `process-shim.ts` 의
  `typeof globalThis &` 교차(= `@types/node` 의 `ProcessEnv` 와 충돌)도 같이 고쳤다.
  방출 JS 는 동일하므로 재동기화는 필요 없다.
- **`LogoMark` 는 배럴에만 있고 `componentSrcMap` 에는 없다 — 의도다.** 위쪽 "배럴과
  componentSrcMap 양쪽에 등록" 규칙은 **카드가 되는 컴포넌트**에만 해당한다. 이 레포에서
  **카드 목록을 정하는 것은 `componentSrcMap` 키뿐**이다: `lib/source-kit.mjs` 가
  `exportedNames(PKG_DIR, pkgJson)` 로 목록을 뽑는데, 그게 보는 entry 는
  `pkgJson.types ?? 'index.d.ts'` → 이 레포 루트에 `index.d.ts` 가 없고 `package.json` 에
  `types` 필드도 없어 **항상 빈 집합**이고, 그 뒤 `componentSrcMap` 항목만 채워 넣는다.
  따라서 배럴 단독 추가는 `window.CureAgentFe` 전역에만 실려 프리뷰가 조립에 쓸 수 있게 될 뿐
  새 카드를 만들지 않는다 (2026-07-28 실측: `LogoMark` 추가 후 bundle export 28 → 29,
  `components: 14` 불변). 프리뷰 셸이 쓰는 조각은 이 방식으로 넣을 것.

## 렌더 체크 환경

- playwright 브라우저는 받지 않았다. `.ds-sync` 에 `playwright` 만 설치하고
  (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`) 시스템에 있는 Chrome 을 쓴다:
  `DS_CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  → `package-validate.mjs` / `package-capture.mjs` 앞에 붙일 것. (~200MB 다운로드 회피)
- `/opt/homebrew/bin/chromium` 은 껍데기만 남아 있다 (Chromium.app 없음). 쓰지 말 것.
- 스크린샷이 playwright 고정 chromium 이 아니라 stable Chrome 으로 찍혔다는 점만 기억.

## 알려진 렌더 경고 / 정적으로 도달 못 하는 상태

이 목록에 없는 경고가 뜨면 새 것이니 확인할 것.

- `[GRID_OVERFLOW] EvidenceInspector` — 최초 1회 발생, `cfg.overrides.EvidenceInspector.cardMode="column"`
  으로 해소. 넓은 패널은 미리 `column`, 화면 전체(AppShell·HistoryPanel)는 `single` + viewport 로 지정해 뒀다.
- `AppShell` 리뷰 시트 하단의 로그아웃 버튼 잘림 — **카드 결함이 아니다.** `?story=` 캡처에만 body
  padding 24px 이 남는데 `min-h-screen` 이 뷰포트와 같아 48px 이 넘친다. 실제 카드 렌더(padding 0)는 온전하다.
- `HistoryPanel` 우측 상세 / `ConversationList`·목록류의 선택 후 상태 — 클릭 이후에만 나타나므로
  정적 카드에는 담기지 않는다. 초기 상태가 담긴 것이 정상.
- `ChatPanel` 의 스트리밍/보류/오류 상태 — 실제 SSE 진행 중에만 나타난다. 정적으로 담지 않았다.
- `RequestGuidanceButton` 은 외형이 하나뿐이라 스토리도 하나다 (변형 축 없음 — 의도).
- `fonts/` 없음 / `tokens/` 비어 있음 — 정상이다. 시스템 폰트 스택만 쓰고, 커스텀 CSS 변수 토큰이 없다.
- `[RENDER_SKIPPED] render check did not run` — **앵커가 있고 변경이 0건인 재동기화에서는 정상이다.**
  드라이버가 렌더 체크를 건너뛴다 (올릴 게 없으므로). 실제로 렌더를 다시 확인하고 싶으면
  드라이버에 `--render-sample 0` 을 붙여 전체 패스를 강제할 것. 새 경고가 아니다.

## 컴포넌트를 고쳤는데 `verification.changed` 가 비어 있을 때 (정상이다)

2026-07-27 `AppShell` 사이드바에 로고 마크를 넣었더니 드라이버 판정이 이렇게 나왔다:
`unchanged` 14개 전부 / `changed` `added` 비어 있음 / `upload.components` 비어 있음, 그런데
`upload.bundle` `upload.styling` `upload.aux` 는 true.

**동기화가 안 된 게 아니다.** 컨버터가 내보내는 컴포넌트 파일은 `.jsx`(한 줄 re-export 스텁)·
`.d.ts`(props 계약)·`.prompt.md` 셋뿐이라, **컴포넌트 내부 마크업만 바꾸면 이 셋이 바이트 동일**하다.
실제 변경은 `_ds_bundle.js` 와 `_ds_bundle.css` 에 담겨 `upload.bundle`/`styling` 으로 잡힌다.
카드(`AppShell.html`)는 런타임에 번들에서 컴포넌트를 불러 그리므로 새 마크업이 그대로 보인다 —
`_screenshots/app-shell__AppShell.png` 로 눈으로 확인했다.

따라서 **판정 기준은 `verification.changed` 가 아니라 `upload.any`** 다. props 계약이나 JSDoc 이
바뀌지 않는 한 마크업 변경은 영원히 `unchanged` 로 분류된다. 프리뷰 재채점이 불필요하다는 뜻이지
업로드가 생략된다는 뜻이 아니다.

**무엇이 `changed` 를 켜는지** (2026-07-28 두 사례로 확인):
- `previews/<Name>.tsx` 를 고치면 → **`changed`** 다. 합성 `.prompt.md` 가 프리뷰의 예시를 읽으므로
  sourceKey 가 움직인다. (로그인 카드 셸을 고쳤을 때 `grade cleared — contract changed` 가 떴다.)
- **컴포넌트 소스의 마크업만** 고치면 → `unchanged` 다. 방출 3종이 바이트 동일하다.
  (소셜 버튼을 세로 라벨형 → 원형 아이콘형으로 완전히 갈아엎었는데도 `changed: []` 였다.)

두 번째 경우가 함정이다: **외형이 완전히 바뀌었는데 채점은 이월된다.** 렌더 체크는 돌지만
`_screenshots/review/` 시트는 재캡처되지 않아, 기록된 채점이 실제 올라간 카드와 어긋난 채 남는다.
외형을 크게 바꾼 걸 아는 상태라면 강제로 재확인할 것:
`node .ds-sync/package-capture.mjs --out ./ds-bundle --components <Name> --spot-check-components <Name>`

**세 번째 사례 (2026-07-30) — 강제 재확인이 불필요한 경우도 있다.** `ChatPanel` 에 스트림
비정상 종료 처리와 오류 상태의 부분 본문 렌더 블록을 추가했는데 판정은 `unchanged` 였다.
여기서는 그게 옳다 — 새 블록은 `state.phase === 'error'` 에서만 나오고, 위 "정적으로 도달 못 하는
상태" 목록대로 `ChatPanel` 의 오류/스트리밍 상태는 카드에 담기지 않기 때문에 **카드 외형이
실제로 안 바뀐다.** 판단 기준: 바뀐 마크업이 카드가 담는 초기 상태에서 보이는가. 보이면 강제
재확인, 아니면 `unchanged` 이월이 정확하다. (이 실행에서도 `upload.bundle`/`styling` 은 true 라
코드 변경 자체는 정상적으로 올라갔다.)

## conventions.md 자동 대조 시 오탐 하나

백틱 토큰을 긁어 `_ds_bundle.css` 와 대조하면 **`next-link` 가 "누락 클래스" 로 잡힌다** — 실제로는
"Next App Router 컨텍스트(`useRouter`/`usePathname`/`next-link`)" 프로즈 안의 모듈 이름이고
클래스가 아니다. 소문자+하이픈이라 유틸리티 클래스 판별식에 걸릴 뿐이다. 무시할 것.
(2026-07-27 기준 클래스 41개·HEX 2개·식별자 20개 전량 검증 — 실제 드리프트 0건.)

추출 휴리스틱에 따라 **오탐이 다섯 더 나올 수 있다**: `_ds_bundle.css`·`styles.css` (파일명인데
식별자/클래스로 분류됨), `var(--color-*` (프로즈의 와일드카드 표기라 실제 변수명이 아님),
`aria-hidden` (HTML 속성명인데 소문자+하이픈이라 `next-link` 와 같은 이유로 클래스로 잡힘),
`pathname` (`DsPreviewProvider` 의 **실제 prop** 인데 소문자 한 단어라 클래스로 잡힘 —
`ds-preview/provider.tsx:59`, 기본값 `/assistant`).
여섯 다 "이름이 틀린" 게 아니라 "클래스/식별자가 아닌 것을 그렇게 분류한" 것이다.
(2026-07-28 재검증 — `LogoMark` 절 추가 후 클래스 50개·HEX 2개·식별자 25개, 실제 드리프트 0건.)
(2026-07-30 재검증 — 클래스 53개·HEX 2개·식별자 26개, 번들 export 29개 중 픽스처·`LogoMark`·
`DsPreviewProvider` 13종 전량 확인, 실제 드리프트 0건. `@theme` 부재 주장도 확인 —
`tailwind-entry.css` 의 `@theme` 히트는 "커스텀 @theme 도 없다"고 적은 **주석**이다.)

## 로컬 앵커 캐시는 믿지 말 것 (2026-07-30 실측)

`.design-sync/.cache/remote-sync.json` 은 gitignore 된 머신 상태라 **직전 업로드가 아니라 그보다
앞선 실행의 앵커가 남아 있을 수 있다.** 이번 실행에서 실제로 그랬다 — 로컬 캐시의 `styleSha` 는
`434068…`, 원격 `_ds_sync.json` 은 `45b3f1…` 이었다. 그대로 `--remote` 에 넘겼다면 diff 가
틀린 기준으로 계산된다. **매 재동기화마다 `DesignSync(get_file, "_ds_sync.json")` 으로 새로
받아 덮어쓸 것** (한 줄 요약의 "원격 앵커 내려받기" 단계가 이것이다 — 생략 금지).
`finalize_plan` 직전 한 번 더 받아 동시 동기화 여부도 확인한다.

## 재동기화 위험 (다음 실행이 지켜볼 것)

- **`dtsPropsFor` 는 OpenAPI 스키마를 손으로 베낀 것이다.** `pnpm api:sync` 로
  `src/shared/api/generated/schema.ts` 가 갱신되면 여기 적힌 DTO 형태가 조용히 낡는다.
  스키마가 바뀐 커밋 뒤에는 `dtsPropsFor` 를 실제 스키마와 대조할 것.
  **대조 이력** — 2026-07-27, 소셜 로그인 리팩터링 스키마 기준으로 전량 대조 완료.
  `ClinicianResponseDto` `PatientSummaryResponseDto` `PatientDetailResponseDto`
  `ConversationSummaryResponseDto` `GuidelineSummaryResponseDto` `EvidenceDetailResponseDto`
  `CompleteSignUpRequestDto` 구조 전부 일치. **의도적으로 다른 것 하나**: 버전 문자열의
  `@example` 을 스키마는 `1.0`, `dtsPropsFor` 는 `"2.0"` 으로 적어 뒀다 — 픽스처가
  1.0/1.1/2.0 을 섞어 쓰고 카드에 2.0 이 보이기 때문. 타입 계약(`string`)은 동일하므로
  드리프트가 아니다. 다음 대조 때 되돌리지 말 것.
- **`ds-preview/fixtures.ts` 의 API 경로 정규식** 도 손으로 적었다. BE 라우트가 바뀌면 매칭이
  깨져 컴포넌트가 오류 상태로 렌더된다 (404 봉투를 돌려주게 해 뒀으니 조용히 비지는 않는다).
- **`ds-preview/entry.ts` 는 자동으로 안 늘어난다.** `src/features/*/ui` 에 컴포넌트를 추가해도
  배럴과 `componentSrcMap` 에 넣지 않으면 동기화 대상에서 빠진다.
- **Next 내부 경로 딥임포트** — `provider.tsx` 가
  `next/dist/shared/lib/app-router-context.shared-runtime` 과 `hooks-client-context.shared-runtime`
  을 직접 import 한다. Next 메이저 업그레이드에서 깨질 수 있는 사설 경로다 (현재 Next 16.2.11).
  깨지면 모든 프리뷰가 라우터 컨텍스트 오류를 낸다.
- **`conventions.md` 는 손으로 검증했다** — 거기 적힌 클래스·export 이름을 매 재동기화마다
  새 빌드 산출물과 대조할 것 (`_ds_bundle.css`, `_ds_bundle.js`, `components/*/` 트리).
- Tailwind 출력은 소스 스캔 결과다. 컴포넌트에서 클래스를 지우면 CSS 에서도 사라지므로,
  프리뷰만 그 클래스를 쓰고 있었다면 프리뷰가 조용히 스타일을 잃는다.
- **`previews/SocialLoginButtons.tsx` 의 `LoginCard` 껍데기는 `src/app/(auth)/login/page.tsx` 를
  손으로 베낀 것이다.** 자동 동기화가 아니다 — 로그인 페이지의 헤더·문구를 고치면 여기도 같이
  고쳐야 카드가 실제 화면과 어긋나지 않는다. `login/page.tsx` 는 `componentSrcMap` 에 없어
  드리프트 게이트가 잡아 주지 않으므로 **사람이 기억해야 하는 유일한 짝**이다.
  (2026-07-28: 마크+워드마크 가로 잠금으로 양쪽을 맞췄다. 현재 잠금은 사이드바 `h-7`/`gap-2.5`,
  인증 카드 `h-10`/`gap-3` 로 크기만 다르고 구조는 같다.)

## 재동기화 한 줄 요약

```sh
cd cure-agent-fe
cp -r <skill>/package-build.mjs <skill>/package-validate.mjs <skill>/package-capture.mjs \
      <skill>/resync.mjs <skill>/lib <skill>/storybook .ds-sync/     # 스테이징 갱신
(cd .ds-sync && npm i esbuild ts-morph @types/react @tailwindcss/cli@4.3.3 && \
 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright)                 # 새 클론일 때만
eval "$(python3 -c "import json;print(json.load(open('.design-sync/config.json'))['buildCmd'])")"
# 원격 앵커 내려받기 → .design-sync/.cache/remote-sync.json
DS_CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules \
  --entry ./.design-sync/ds-preview/entry.ts --out ./ds-bundle \
  --remote .design-sync/.cache/remote-sync.json
```
