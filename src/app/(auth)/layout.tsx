import type { ReactNode } from 'react';

/**
 * 비인증 화면의 공통 셸 — 로그인·회원가입·초대 수락이 여기를 지난다.
 *
 * 이 화면들의 문구는 이미 표시 언어를 따르지만(`Message`·`messagesFor`), 로그인 전에는
 * AppShell이 없어 **바꿀 수단이 없었다.** 자동 판정(`navigator.language`)만 남고 사람이
 * 뒤집을 수 없는 상태였다 — 표시 언어 컨트롤이 셸이 아니라 여기에도 서야 하는 이유다.
 */

// TODO(stub): 구현 예정 — children만 통과시킨다
export default function AuthLayout({ children }: { children: ReactNode }): React.ReactElement {
  return <>{children}</>;
}
