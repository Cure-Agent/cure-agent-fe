## 이 디자인 시스템을 쓰는 법

Cure Agent 는 한의 임상 지침 어시스턴트다. 컴포넌트는 재사용 위젯이 아니라 **화면 단위 패널**이고,
대부분 서버 상태(react-query)와 Next 라우터를 읽는다. 아래 두 가지를 지키지 않으면 렌더되지 않는다.

### 1. 반드시 `DsPreviewProvider` 로 감쌀 것

```jsx
const { DsPreviewProvider, AppShell, CLINICIAN } = window.CureAgentFe;

<DsPreviewProvider>
  <AppShell me={CLINICIAN}>{/* 페이지 본문 */}</AppShell>
</DsPreviewProvider>
```

이 프로바이더가 세우는 것: `QueryClientProvider`, Next App Router 컨텍스트(`useRouter`/`usePathname`/`next-link`),
그리고 데모 데이터를 돌려주는 fetch. **빠뜨리면** 목록·상세 패널은 "불러오는 중…" 에서 멈추고,
`AppShell`·`OnboardingForm` 은 라우터 컨텍스트가 없어 예외를 던진다.

`pathname` prop 으로 활성 내비 항목을 바꾼다: `<DsPreviewProvider pathname="/patients">`.
경로는 `/assistant` `/guidelines` `/patients` `/history` 넷뿐이다.

### 2. 데모 데이터는 번들에 들어 있다 — 지어내지 말 것

DTO 를 props 로 받는 컴포넌트에는 `window.CureAgentFe` 의 값을 쓴다:
`CLINICIAN`, `PATIENT_SUMMARIES`, `PATIENT_DETAIL`, `CONVERSATIONS`, `MESSAGES`,
`EVIDENCE_DETAILS`, `CLINICAL_GUIDANCE`, `GUIDELINE_SUMMARIES`, `GUIDELINE_DETAIL`,
`GUIDELINE_EVIDENCE`, `OAUTH_PROVIDERS`. 전부 실제 지침 도메인의 한국어 예시다.

### 3. 스타일 = Tailwind v4 유틸리티. 커스텀 토큰은 없다

`@theme` 커스터마이즈가 없어 **디자인 언어는 Tailwind 기본 스케일 위의 관례**로만 존재한다.
`var(--color-*)` 를 직접 쓰지 말 것 — `_ds_bundle.css` 의 그 변수들은 Tailwind 가 생성한 내부 변수다.
클래스로 쓴다.

| 역할 | 실제 클래스 |
|---|---|
| 주요 액션 | `bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50` |
| 보조 액션 | `border border-gray-300 text-gray-600 hover:bg-gray-100` |
| 활성/선택 | `bg-emerald-50 text-emerald-800`, 강조 테두리 `border-emerald-600` |
| 카드·패널 | `rounded-xl border border-gray-200 bg-white p-4` |
| 인증 카드 | `rounded-2xl border border-gray-200 bg-white p-8 shadow-sm max-w-sm` |
| 입력 | `rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-600 focus:outline-none` |
| 페이지 배경 | `bg-gray-50` |
| 텍스트 | 제목 `text-gray-900 font-bold` / 본문 `text-gray-800` / 보조 `text-gray-500 text-xs` |
| 오류 | `bg-red-50 text-red-700` · 경고 `bg-amber-50 text-amber-800` · 정보 `bg-sky-100 text-sky-800` |

반경은 컨트롤 `rounded-lg`, 패널 `rounded-xl`, 인증 카드 `rounded-2xl` 로 고정. 본문은 `text-sm` 이 기본.
폰트는 시스템 스택(`--font-sans`)이며 웹폰트를 싣지 않는다.

**예외:** `SocialLoginButtons` 의 제공자 버튼은 각 사 로그인 가이드라인 색(`#FEE500` 카카오, `#03C75A` 네이버)을
그대로 쓴다. emerald 로 바꾸지 말 것.

### 4. 화면 조립 패턴

- 보호 화면은 `AppShell` 안에 본문을 넣는다. 본문 폭은 `mx-auto max-w-3xl` 이 기본.
- 어시스턴트는 3단: `grid grid-cols-[16rem_1fr_20rem] gap-4` → `ConversationList` | `ChatPanel` | `EvidenceInspector`.
- 히스토리는 2단: `grid grid-cols-[20rem_1fr] gap-4`.
- `EvidenceInspector` 는 `h-full` 이라 높이가 확정된 부모가 필요하다. 카드 안에서는 폭만 주고 높이는 비워 둔다.

### 5. 더 정확한 정보

`styles.css`(→ `_ds_bundle.css`) 가 실제로 실린 스타일 전부다. 컴포넌트별 props 계약은
`components/<group>/<Name>/<Name>.d.ts`, 쓰임새는 같은 폴더의 `<Name>.prompt.md` 에 있다.
추측하기 전에 이 파일들을 읽을 것.
