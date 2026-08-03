'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { Clinician, useLogout } from '@/features/auth/api/auth.api';
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

const NAV_ITEMS = [
  { href: '/assistant', label: '어시스턴트', Icon: AssistantIcon },
  { href: '/guidelines', label: '지침', Icon: GuidelineIcon },
  { href: '/patients', label: '환자', Icon: PatientIcon },
] as const;

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
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
            <p className="truncate text-xs text-gray-500">한의 임상 지침 어시스턴트</p>
          </div>
          {/* 부제가 헤더 폭을 거의 다 쓰므로 플로우 밖에 띄운다 — 행에 넣으면 부제가 잘린다.
              세로는 접힘 레일의 토글과 같은 중앙 정렬 */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="사이드바 닫기"
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
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  active
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-200 p-4">
          <p className="truncate text-sm font-medium text-gray-900">{me.displayName}</p>
          {/* 소셜 계정에서 받은 이메일이 이 계정의 식별자다 — 어느 계정으로 들어와 있는지 확인할 곳이 여기뿐이다 */}
          <p className="truncate text-xs text-gray-500">{me.email}</p>
          <p className="truncate text-xs text-gray-500">{me.clinic.name}</p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            className="mt-3 w-full rounded-lg border border-gray-300 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            로그아웃
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
              onClick={() => setSidebarOpen(true)}
              aria-label="사이드바 열기"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <PanelIcon className="h-5 w-5" />
            </button>
          </div>
          <nav aria-label="주요 메뉴" className="mt-3 flex flex-col items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-lg p-2 ${
                    active
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <item.Icon className="h-5 w-5" />
                </Link>
              );
            })}
          </nav>
        </div>
      )}
      {/* 스크롤 금지 — 각 페이지가 h-full 안에서 자체 스크롤 영역을 만든다 */}
      <main className="flex-1 overflow-hidden p-8">{children}</main>
    </div>
  );
}
