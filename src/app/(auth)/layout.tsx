import type { ReactNode } from 'react';
import { LanguageSwitch } from '@/shared/ui/language-switch';

/**
 * 비인증 화면의 공통 셸 — 로그인·회원가입·초대 수락이 여기를 지난다.
 *
 * 이 화면들의 문구는 이미 표시 언어를 따르지만(`Message`·`messagesFor`), 로그인 전에는
 * AppShell이 없어 **바꿀 수단이 없었다.** 자동 판정(`navigator.language`)만 남고 사람이
 * 뒤집을 수 없는 상태였다 — `shared/i18n/ui-lang.ts`가 스스로 적어 둔 「고른 값이 언제나
 * 이긴다」가 로그인 전 화면에서만 지켜지지 않았다.
 *
 * 페이지가 아니라 **레이아웃**에 두는 이유: 세 화면이 각자 자기 카드를 그리므로 페이지마다
 * 넣으면 세 벌이 되고, 앞으로 늘어날 비인증 화면은 또 빠뜨린다.
 */
export default function AuthLayout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <>
      {/* 카드는 세로 중앙에 서므로 우상단은 비어 있다 — fixed로 띄워 각 페이지의 레이아웃을
          건드리지 않는다. 카드가 화면보다 길어져 스크롤이 생겨도 컨트롤은 자리를 지킨다.
          shadow-sm: 카드와 같은 높이감으로, 배경(gray-50) 위에서 경계가 사라지지 않게 한다 */}
      <div className="fixed right-4 top-4 z-10">
        <LanguageSwitch className="shadow-sm" />
      </div>
      {children}
    </>
  );
}
