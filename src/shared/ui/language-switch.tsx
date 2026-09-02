'use client';

/**
 * 표시 언어 선택 — 공용 컨트롤.
 *
 * 로그인한 화면(AppShell 사이드바)과 로그인 전 화면((auth) 레이아웃)이 **같은 컨트롤**을 쓴다.
 * 두 벌로 갈라 두면 선택지 라벨·저장 규칙·접근 이름이 조용히 어긋난다.
 *
 * 표시 언어를 prop으로 받지 않고 **스스로 읽는다** — 호출부가 서버 컴포넌트일 수 있어
 * (`src/app/(auth)/layout.tsx`) 위에서 내려줄 방법이 없다.
 *
 * 배치(여백·위치)는 호출부가 `className`으로 정한다. 이 컴포넌트는 컨트롤의 모양과 동작만 갖는다.
 */

// TODO(stub): 구현 예정 — 시그니처만 둔다
export function LanguageSwitch({ className }: { className?: string }): React.ReactElement {
  return <div className={className} />;
}

// TODO(stub): 구현 예정 — 시그니처만 둔다
export function LanguageRailToggle({ className }: { className?: string }): React.ReactElement {
  return <div className={className} />;
}
