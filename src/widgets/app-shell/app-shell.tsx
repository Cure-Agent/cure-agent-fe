'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useState } from 'react';
import { Clinician, useLogout } from '@/features/auth/api/auth.api';
import { completeTourStep, useTourHighlight } from '@/features/onboarding-tour/model/tour-state';
import type { TourAnchor } from '@/features/onboarding-tour/model/tour-steps';
import { OnboardingTour } from '@/features/onboarding-tour/ui/onboarding-tour';
import { type MessageKey, messagesFor } from '@/shared/i18n/messages';
import { type UiLang, setUiLang, useUiLang } from '@/shared/i18n/ui-lang';
import { LogoMark } from '@/shared/ui/logo-mark';

type IconProps = { className?: string };

function iconSvg(children: ReactNode) {
  return function Icon({ className }: IconProps): React.ReactElement {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
      >
        {children}
      </svg>
    );
  };
}

const PanelIcon = iconSvg(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
  </>,
);

const AssistantIcon = iconSvg(<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />);

const GuidelineIcon = iconSvg(
  <>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </>,
);

const PatientIcon = iconSvg(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>,
);

// 환자 아이콘(여러 사람)과 헷갈리지 않게 테두리 원을 두른 1인 형태로 구분한다
const ProfileIcon = iconSvg(
  <>
    <path d="M18 20a6 6 0 0 0-12 0" />
    <circle cx="12" cy="10" r="4" />
    <circle cx="12" cy="12" r="10" />
  </>,
);

const LogoutIcon = iconSvg(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </>,
);

// 라벨을 문자열이 아니라 **메시지 키**로 든다 — 표시 언어가 바뀌면 따라와야 하는데
// 모듈 상수는 렌더 밖에서 한 번 만들어지므로 문자열을 박으면 첫 언어에 굳는다
//
// `tourAnchor`는 온보딩 둘러보기가 짚는 항목 — 환자 맞춤 경로의 첫 단계가 이 메뉴다
const NAV_ITEMS = [
  { href: '/assistant', labelKey: 'navAssistant', Icon: AssistantIcon, tourAnchor: null },
  { href: '/guidelines', labelKey: 'navGuidelines', Icon: GuidelineIcon, tourAnchor: null },
  {
    href: '/patients',
    labelKey: 'navPatients',
    Icon: PatientIcon,
    tourAnchor: 'nav-patients',
  },
] as const satisfies readonly {
  href: string;
  labelKey: MessageKey;
  Icon: unknown;
  tourAnchor: TourAnchor | null;
}[];

// 사이드바를 접을지는 로그인 세션이 아니라 그 사람의 화면 크기·작업 습관에 딸린 취향이다 —
// 계정으로 나누지 않은 단일 키에 남겨, 다시 로그인해도 마지막 배치가 그대로 이어지게 한다
const SIDEBAR_STORAGE_KEY = 'cure-agent:sidebar-open';

// AppShell은 세션 확인이 끝난 뒤에만 마운트되므로((protected)/layout) 서버 렌더에 실리지 않는다.
// 그래서 첫 렌더에서 곧바로 읽어도 hydration이 어긋나지 않고, 접어 둔 사용자에게 열림→접힘이 번쩍이지도 않는다.
// try/catch는 저장소 차단(사파리 프라이빗 등)과 window 없는 환경을 함께 덮는다 — 어느 쪽이든 기본값 열림이다
function readSidebarOpen(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

/**
 * 표시 언어 선택.
 *
 * **선택지 라벨을 번역하지 않는다** — 각 항목을 그 언어 자체로(`한국어`·`English`) 적는다.
 * 데모의 실제 시나리오는 「한국어 로케일 노트북으로 영어권 방문자에게 시연」이고, 그때 화면은
 * 전부 한국어다. 라벨을 현재 UI 언어로 번역하면 **한국어를 못 읽는 사람이 자기 항목을 찾을
 * 수 없다.** 언어 이름을 그 언어로 적는 것이 이 컨트롤의 유일한 요건이다.
 *
 * 사이드바 하단 계정 블록에 두는 이유: 표시 언어는 화면이 아니라 **사람에 딸린 설정**이라
 * 계정 동작(프로필·로그아웃)과 같은 자리에 있어야 하고, 어느 화면에서도 손이 닿는다.
 */
const LANG_OPTIONS = [
  { value: 'ko', label: '한국어', code: 'KO', switchKey: 'switchToKorean' },
  { value: 'en', label: 'English', code: 'EN', switchKey: 'switchToEnglish' },
] as const satisfies readonly {
  value: UiLang;
  label: string;
  code: string;
  switchKey: MessageKey;
}[];

function LanguageSwitch({
  lang,
  t,
}: {
  lang: UiLang;
  t: Record<MessageKey, string>;
}): React.ReactElement {
  return (
    <div
      role="group"
      aria-label={t.displayLanguage}
      className="mb-2 flex rounded-lg border border-gray-300 p-0.5"
    >
      {LANG_OPTIONS.map((option) => {
        const active = option.value === lang;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setUiLang(option.value)}
            aria-pressed={active}
            className={`flex-1 rounded-md py-1 text-xs font-medium ${
              active ? 'bg-emerald-50 text-emerald-800' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 접힘 레일용 — 폭이 56px뿐이라 두 항목을 나란히 둘 수 없다.
 * 현재 언어 코드를 보여주고 누르면 다른 언어로 넘어간다. 접근성 이름은 **넘어갈 대상**을
 * 말한다 — 코드만 읽으면 「지금 이것」인지 「눌러서 이것」인지 갈리지 않는다.
 */
function LanguageRailToggle({
  lang,
  t,
}: {
  lang: UiLang;
  t: Record<MessageKey, string>;
}): React.ReactElement {
  const current = LANG_OPTIONS.find((option) => option.value === lang) ?? LANG_OPTIONS[0];
  const next = LANG_OPTIONS.find((option) => option.value !== lang) ?? LANG_OPTIONS[1];
  return (
    <button
      type="button"
      onClick={() => setUiLang(next.value)}
      aria-label={t[next.switchKey]}
      title={t[next.switchKey]}
      className={`${railIconClass(false)} text-xs font-semibold`}
    >
      {current.code}
    </button>
  );
}

// 레일 아이콘의 형태·색을 한곳에 묶는다 — 메뉴와 프로필이 따로 흘러가지 않게 한다
function railIconClass(active: boolean): string {
  return `rounded-lg p-2 ${
    active ? 'bg-emerald-50 text-emerald-800' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
  }`;
}

export function AppShell({
  me,
  children,
}: {
  me: Clinician;
  children: ReactNode;
}): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const lang = useUiLang();
  const t = messagesFor(lang);
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen);
  // 훅은 map 안에서 부를 수 없다 — 강조 여부를 미리 읽어 두고 해당 항목에서만 쓴다
  const patientsHighlight = useTourHighlight('nav-patients');

  // 접기·펼치기는 곧 사용자가 명시적으로 내린 선택이다 — 화면과 저장소를 한 번에 움직여 둘이 갈라지지 않게 한다
  const persistSidebarOpen = useCallback((open: boolean): void => {
    setSidebarOpen(open);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open));
    } catch {
      // 저장이 막혀 있어도 이번 방문 동안의 토글은 그대로 동작해야 한다
    }
  }, []);

  const handleLogout = async (): Promise<void> => {
    try {
      await logout.mutateAsync();
    } finally {
      router.replace('/login');
    }
  };

  return (
    // h-screen + overflow-hidden: 화면 크기를 고정하고 스크롤은 각 페이지 내부 영역이 맡는다
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside
        inert={!sidebarOpen}
        className={`flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white transition-[margin] duration-200 ease-in-out ${
          sidebarOpen ? 'ml-0' : '-ml-60'
        }`}
      >
        {/* h-18: 접힘 레일 헤더와 같은 높이 토큰 — 두 상태의 상단 기준선을 맞춘다 */}
        <div className="relative flex h-18 items-center gap-2.5 border-b border-gray-200 px-5">
          <LogoMark className="h-7 w-auto shrink-0 text-emerald-700" />
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-emerald-800">Cure Agent</p>
            <p className="truncate text-xs text-gray-500">{t.appTagline}</p>
          </div>
          {/* 부제가 헤더 폭을 거의 다 쓰므로 플로우 밖에 띄운다 — 행에 넣으면 부제가 잘린다.
              세로는 접힘 레일의 토글과 같은 중앙 정렬 */}
          <button
            type="button"
            onClick={() => persistSidebarOpen(false)}
            aria-label={t.closeSidebar}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <PanelIcon className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => item.tourAnchor && completeTourStep(item.tourAnchor)}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  active
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                } ${item.tourAnchor === 'nav-patients' ? patientsHighlight : ''}`}
              >
                {t[item.labelKey]}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-200 p-4">
          <LanguageSwitch lang={lang} t={t} />
          {/* 계정 정보 블록이 프로필 진입점이다. -mx-2 px-2: 글자 위치는 그대로 두고 호버 영역만 넓힌다.
              되돌릴 수 없는 계정 동작(회원탈퇴)은 이 자리가 아니라 프로필 안에 둔다 — 로그아웃과
              나란히 두면 나가려다 지우는 오조작이 만들어진다 */}
          <Link
            href="/profile"
            aria-label={t.myProfile}
            className="-mx-2 block rounded-lg px-2 py-1.5 hover:bg-gray-100"
          >
            <p className="truncate text-sm font-medium text-gray-900">{me.displayName}</p>
            {/* 소셜 계정에서 받은 이메일이 이 계정의 식별자다 — 어느 계정으로 들어와 있는지 알려 준다 */}
            <p className="truncate text-xs text-gray-500">{me.email}</p>
            <p className="truncate text-xs text-gray-500">{me.clinic.name}</p>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            className="mt-1.5 w-full rounded-lg border border-gray-300 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            {t.logout}
          </button>
        </div>
      </aside>
      {/* 접힘 상태: 떠 있는 버튼 대신 레이아웃 폭을 차지하는 아이콘 레일 —
          본문(대화 목록 등)과 겹치지 않고, 탭을 열지 않아도 바로 이동할 수 있다 */}
      {!sidebarOpen && (
        <div className="flex w-14 shrink-0 flex-col items-center border-r border-gray-200 bg-white">
          {/* 열림 헤더와 같은 h-18 + border-b — 접었을 때도 상단 영역 높이·구분선이 일치한다 */}
          <div className="flex h-18 w-full items-center justify-center border-b border-gray-200">
            <button
              type="button"
              onClick={() => persistSidebarOpen(true)}
              aria-label={t.openSidebar}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <PanelIcon className="h-5 w-5" />
            </button>
          </div>
          <nav aria-label={t.mainMenu} className="mt-3 flex flex-col items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => item.tourAnchor && completeTourStep(item.tourAnchor)}
                  aria-label={t[item.labelKey]}
                  title={t[item.labelKey]}
                  aria-current={active ? 'page' : undefined}
                  className={`${railIconClass(active)} ${
                    item.tourAnchor === 'nav-patients' ? patientsHighlight : ''
                  }`}
                >
                  <item.Icon className="h-5 w-5" />
                </Link>
              );
            })}
          </nav>
          {/* 열림 상태에서 계정 블록이 하단 구분선 아래 있는 것과 같은 자리 — 접어도 프로필·로그아웃이 남는다.
              둘 다 주요 메뉴가 아니라 계정 동작이므로 위 nav 밖에 두고,
              순서도 열림 상태와 같이 프로필 → 로그아웃이다 (두 상태가 다른 순서를 가르치지 않게) */}
          <div className="mt-auto flex w-full flex-col items-center gap-1 border-t border-gray-200 py-3">
            <LanguageRailToggle lang={lang} t={t} />
            <Link
              href="/profile"
              aria-label={t.myProfile}
              title={t.myProfile}
              aria-current={pathname.startsWith('/profile') ? 'page' : undefined}
              className={railIconClass(pathname.startsWith('/profile'))}
            >
              <ProfileIcon className="h-5 w-5" />
            </Link>
            {/* 로그아웃은 경로가 아니라 동작이라 활성 상태가 없다 — 항상 비활성 스타일이다 */}
            <button
              type="button"
              onClick={handleLogout}
              disabled={logout.isPending}
              aria-label={t.logout}
              title={t.logout}
              className={`${railIconClass(false)} disabled:opacity-50`}
            >
              <LogoutIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
      {/* 스크롤 금지 — 각 페이지가 h-full 안에서 자체 스크롤 영역을 만든다 */}
      <main className="flex-1 overflow-hidden p-8">{children}</main>
      {/* 둘러보기는 화면이 아니라 셸에 붙는다 — 환자 맞춤 경로가 세 화면을 건너다니므로
          페이지마다 두면 그 이동 중에 안내가 끊긴다. 꺼져 있으면 아무것도 그리지 않는다 */}
      <OnboardingTour />
    </div>
  );
}
