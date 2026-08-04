# Cure Agent FE 설계 문서 (분리본)

> **설계의 원본은 BE 레포에 있습니다**: [cure-agent-be/docs/architecture.md](https://github.com/Cure-Agent/cure-agent-be/blob/main/docs/architecture.md)
> 이 문서는 FE 구조와 FE 규칙만 다룹니다. 공통 계약(응답 봉투, 에러코드, SSE 이벤트 스키마, 인증 API, DTO)은 원본을 참조하며, 여기에 복사하지 않습니다(드리프트 방지).

---

## 1. 디렉토리 구조

```
cure-agent-fe/
├── openapi/
│   └── cure-agent.v1.json            # BE에서 fetch 동기화, 직접 편집 금지(CI diff 검사로 강제)
├── scripts/
│   └── generate-api.mjs
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx        # 소셜 로그인 진입 (?error= 표시)
│   │   │   ├── invite/[token]/page.tsx  # 초대 링크 수락 진입 (비인증 — BE specs/35)
│   │   │   └── signup/page.tsx       # 소셜 인증 후 온보딩 (?ticket= 필수)
│   │   ├── (protected)/
│   │   │   ├── layout.tsx
│   │   │   ├── assistant/
│   │   │   │   ├── page.tsx
│   │   │   │   └── _components/      # 화면 전용 조립부 (라우트 콜로케이션)
│   │   │   ├── guidelines/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [guidelineId]/page.tsx
│   │   │   │   └── _components/
│   │   │   └── patients/
│   │   │       ├── page.tsx
│   │   │       ├── [patientId]/page.tsx
│   │   │       └── _components/
│   │   ├── error.tsx / loading.tsx / not-found.tsx
│   │   └── providers.tsx
│   │
│   ├── widgets/                      # 실제로 2개 이상 화면에서 재사용되는 것만
│   │   ├── app-shell/
│   │   └── evidence-inspector/       # /assistant, /guidelines 공용
│   │
│   ├── features/
│   │   ├── auth/                     # 소셜 로그인 + 온보딩 + logout + 회원탈퇴 (BE docs/specs/17·36)
│   │   ├── ask-guideline/
│   │   ├── filter-guidelines/
│   │   ├── inspect-evidence/
│   │   ├── manage-clinic/            # 구성원·초대·개설자 이양 (BE docs/specs/35·36)
│   │   ├── manage-patient/
│   │   ├── request-clinical-guidance/
│   │   ├── review-clinical-guidance/
│   │   ├── manage-conversation/
│   │   └── submit-answer-feedback/
│   │
│   └── shared/
│       ├── api/
│       │   ├── generated/            # schema.ts, client.ts — 편집 금지, codegen 산출물
│       │   ├── http.ts               # 전송 계층
│       │   ├── api-client.ts         # 봉투 해석·언랩 계층
│       │   ├── api-error.ts
│       │   ├── stream-client.ts      # SSE (http.ts의 refresh 경로 공유)
│       │   └── query-client.ts
│       ├── auth/ config/ lib/ ui/ test/
│
├── package.json
└── next.config.ts
```

**의존 방향(단방향 고정)**: `app → widgets → features → shared`

- widgets는 2개 이상 화면에서 실제 재사용되는 것만 둔다. 화면 1:1 조립부는 해당 라우트의 `_components/`에 콜로케이션한다.
- 별도 entities/ 레이어는 만들지 않는다. FE가 다루는 것은 대부분 API 응답 DTO다.
- FE 전용 타입(폼 값, 스트리밍 중간 상태, Evidence 패널 선택 상태, ViewModel)은 feature 내부 `model/`에 둔다.
  - 예: `features/manage-patient/model/patient-form.model.ts`, `features/ask-guideline/model/stream-state.model.ts`

---

## 2. API 계층 원칙

3계층으로 분리하고 역할을 넘나들지 않는다.

| 계층 | 파일 | 책임 |
|---|---|---|
| 전송 | `shared/api/http.ts` | URL 빌드, `credentials: "include"`, 401 → refresh → 재시도. 봉투 규약을 모른다 |
| 봉투 해석 | `shared/api/api-client.ts` | `success`/`code` 분기, data 언랩, `ApiError` 변환 |
| 소비 | `features/*/api/` | TanStack Query hook 정의 |

**전송 계층 규칙:**

- **401 → refresh 단일화(single-flight)**: refresh는 앱 전체에서 공유 promise 하나로 1회만 수행하고, 대기 중인 요청들이 결과를 공유한 뒤 원 요청을 1회 재시도한다.
- refresh 실패 시 정책(로그아웃·리다이렉트)은 `setUnauthorizedHandler(handler)` 주입으로 분리한다 — 전송 계층을 상태관리·라우터에 결합시키지 않는다.
- openapi-fetch에는 이 로직을 middleware로 이식한다.
- 토큰은 HttpOnly 쿠키로만 존재한다. **FE 코드·스토리지에 토큰이 등장하면 안 된다.**
- 상태 변경 요청(POST/PATCH/DELETE)에는 `X-CSRF-Protection: 1` 헤더를 자동 부착한다 (원본 §4.1).

**stream-client 규칙:**

- POST + `fetch()` + ReadableStream으로 SSE를 소비한다 (EventSource 미사용).
- **http.ts의 `ensureRefreshed()`를 공유한다** — 스트리밍 요청도 토큰 만료를 만난다.
- CSRF 헤더도 동일하게 부착한다.

**초대 링크 왕복 규칙 (원본 §5.2, BE docs/specs/35):**

- BE 소셜 콜백은 `/signup?ticket=`만 들고 돌아온다 — **초대 토큰을 실을 자리가 없다.** `/invite/[token]`이 sessionStorage(`cure.invitationToken`)에 맡기고 온보딩이 되찾는다. 소셜 로그인은 같은 탭의 전체 페이지 이동이라 왕복 동안 값이 살아남는다.
- localStorage가 아니라 **sessionStorage**다: 1회용 합류 권한이므로 탭을 닫으면 함께 사라져야 하고, 다른 탭의 가입 흐름에 새어 들어가서도 안 된다.
- **유효한 초대일 때만** 맡기고, 가입에 **성공한 뒤** 지운다 — 읽으면서 비우면 폼 검증 실패로 한 번 되돌아왔을 때 합류 맥락이 사라진다.
- `clinicName`(새 개설)과 `invitationToken`(합류)은 **상호배타**다(함께 보내면 422). 화면도 입력을 하나만 띄운다.
- 프리뷰(`GET /invitations/{token}`)는 **비인증 경로**다. 이 화면에서 `useMe()`를 부르지 않는다 — 비로그인 방문자가 401 → refresh 실패 → 전역 `/login` 리다이렉트로 튕겨 나가 정작 초대받은 사람이 화면을 못 본다.

---

## 3. Codegen 규칙

- `openapi/cure-agent.v1.json`은 `scripts/generate-api.mjs`가 BE 레포에서 fetch해 동기화한다. **직접 편집 금지** — CI가 재생성 diff = 0을 검사해 강제한다.
- **자동 동기화**: BE 계약이 main에 반영되면 `contract-sync` 워크플로우(repository_dispatch)가 `api:sync`를 실행해 **동기화 PR(`chore/contract-sync`)을 자동 생성**한다. dispatch 실패는 BE `contract-notify` job의 hard-fail로 감지하며 cron 폴백은 두지 않는다. 동기화 PR은 PAT(`CONTRACT_SYNC_TOKEN` 시크릿)로 생성되어 **pull_request CI가 정상 트리거된다** — breaking 판정은 PR CI가 하고, main 브랜치 보호(required checks: `codegen-check`·`gitleaks`)가 머지를 강제한다. contract-sync run 자체의 typecheck는 조기 신호로 남는다(실패 = breaking → run이 빨갛게 실패하고 PR 본문에 판정이 기록됨). breaking이면 FE 적응 커밋을 같은 브랜치에 쌓은 뒤 머지한다.
- `shared/api/generated/`는 codegen 산출물이다. 수동 편집 금지.
- 수동 DTO(`interfaces/response/*` 류)를 만들지 않는다. 타입은 전부 generated에서 가져온다.
- **enum 전방 호환**: OpenAPI enum에 값이 추가될 수 있음을 전제로, unknown variant를 안전하게 무시/기본 렌더링한다. exhaustive switch에는 `default`를 반드시 둔다.
- 도구: `openapi-typescript` + `openapi-fetch`. TanStack Query hook은 각 feature에서 직접 정의한다.

---

## 4. 스트리밍 UI·복구 흐름

이벤트 스키마와 서버측 규약은 원본 §8이 계약이다. FE 관점 요약:

1. 스트림의 첫 이벤트 `message.accepted`에서 `assistantMessageId`를 저장한다 — 복구의 기준점.
2. `answer.delta`는 `seq`로 순서·중복을 감지하며 누적한다.
3. 스트리밍 중간 상태는 TanStack Query가 아니라 `features/ask-guideline/model/stream-state.model.ts`(useReducer 또는 zustand)로 관리한다. 완료 시(`answer.completed`) Query 캐시에 반영한다.
4. **스트림이 비정상 종료되면** `GET /conversations/{id}/messages`로 최종 상태를 조회한다:
   - `COMPLETED`/`ABSTAINED` → 그 내용으로 확정 렌더
   - `STREAMING`/`FAILED`/`CANCELLED` → 재시도 UI 제공
5. 재시도는 같은 `clientRequestId`로 안전하다(서버 unique constraint가 중복 생성을 차단).
6. 이탈(탭 닫기·화면 전환) 시 AbortController로 요청을 중단한다 — 서버가 `CANCELLED`로 정리한다.

---

## 5. 테스트

- `*.test.ts`는 대상 파일 옆에 colocation한다.
- API 모킹은 OpenAPI 스키마 기반 MSW 핸들러(`shared/test/`)로 한다 — 수동 mock 타입 작성 금지.
- stream-client는 ReadableStream 모의로 delta 순서·복구 흐름을 단위 테스트한다.
- 커서 페이지네이션 UI는 `PageMeta { size, hasNext, nextCursor }` 기준으로 구현한다. **totalCount는 계약에 없다** — "총 N건" UI를 만들지 않는다.
