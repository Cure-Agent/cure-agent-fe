# E2E — 크리티컬 플로우

깨지면 **제품을 쓸 수 없게 되는** 경로만 둔다. 화면 구석의 동작이나 분기별 문구는
단위 테스트(`src/**/*.test.tsx`, MSW)가 훨씬 싸고 빠르게 잡는다.

| 파일 | 플로우 | 깨지면 |
|------|--------|--------|
| `auth-gate.spec.ts` | 세션 판정 → 보호 화면 진입·차단 → 로그아웃 | 로그인한 사람이 튕기거나, 세션 없이 화면이 열린다 |
| `guideline-qa.spec.ts` | 대화 생성 → 질문 → SSE 스트리밍 답변 → 인용 근거 | 제품의 핵심 가치가 나오지 않는다 |
| `patient-registration.spec.ts` | 환자 등록 폼 → 계약 변환 → 상세 이동 | 잘못된 임상 정보가 저장된다 |

## 실행

```bash
pnpm test:e2e                 # 전체
pnpm test:e2e auth-gate       # 파일 하나
pnpm exec playwright test --ui # 디버깅
```

첫 실행 전 브라우저가 필요하다: `pnpm exec playwright install chromium`.

`playwright.config.ts`의 `webServer`가 **프로덕션 빌드**로 앱을 3101 포트에 띄운다
(dev의 3001과 겹치지 않아 개발 서버를 켜 둔 채로 돌릴 수 있다). dev 서버를 쓰지 않는 이유는
`assistant`의 `useSearchParams`/Suspense 경계처럼 build·prerender에서만 드러나는 문제가 있어서다.

## 스텁 규약

BE는 띄우지 않는다. `fixtures/api.ts`의 `mockApi()`가 브라우저에서 `/api/v1/**`를 전부
가로채 봉투(architecture.md §10.1)로 응답한다. 검증 대상은 "계약대로 된 응답을 받았을 때
FE의 화면·라우팅·스트림 조립이 끝까지 맞는가"다.

- **스텁하지 않은 요청은 통과하지 않는다.** 501로 막고 `api.unhandled`에 쌓이므로,
  각 테스트는 `expect(api.unhandled).toEqual([])`로 끝낸다. 화면만 보고 통과한 뒤
  실제로는 호출이 새어 나가는 상황을 막는 장치다.
- 안전망이 하나 더 있다: `webServer.env`가 `BE_ORIGIN`을 연결이 거부되는 주소로 고정한다.
  스텁이 빠져도 `.env`의 실제 BE로 요청이 새지 않는다.
- 핸들러를 **함수로** 주면 요청마다 다시 평가된다. 로그아웃 후 401, 스트림 종결 후
  달라지는 `GET messages`처럼 호출에 따라 변하는 서버 상태를 테스트 안의 변수로 표현할 때 쓴다.
- 시드 데이터(`fixtures/data.ts`)는 생성 스키마 타입으로 못 박혀 있다. 계약이 바뀌면
  테스트를 돌리기 전에 `pnpm typecheck`가 먼저 깨진다.

## 플로우를 추가할 때

늘리기 전에 단위 테스트로 못 잡는 이유부터 확인한다. E2E가 값을 더하는 건
**여러 계층이 이어져야만 성립하는** 검증이다 — 라우팅 전환, 스트림 조립, 패널 간 상태 전달,
입력의 계약 변환. 한 컴포넌트 안에서 끝나는 검증이면 `src` 쪽 테스트가 맞다.
