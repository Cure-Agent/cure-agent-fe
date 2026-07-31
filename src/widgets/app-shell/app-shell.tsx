'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { Clinician, useLogout } from '@/features/auth/api/auth.api';
import { LogoMark } from '@/shared/ui/logo-mark';

const NAV_ITEMS = [
  { href: '/assistant', label: '어시스턴트' },
  { href: '/guidelines', label: '지침' },
  { href: '/patients', label: '환자' },
  { href: '/history', label: '히스토리' },
] as const;

function PanelIcon({ className }: { className?: string }): React.ReactElement {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </svg>
  );
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async (): Promise<void> => {
    try {
      await logout.mutateAsync();
    } finally {
      router.replace('/login');
    }
  };

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-gray-50">
      <aside
        inert={!sidebarOpen}
        className={`flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white transition-[margin] duration-200 ease-in-out ${
          sidebarOpen ? 'ml-0' : '-ml-60'
        }`}
      >
        <div className="relative flex items-center gap-2.5 border-b border-gray-200 px-5 py-4">
          <LogoMark className="h-7 w-auto shrink-0 text-emerald-700" />
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-emerald-800">Cure Agent</p>
            <p className="truncate text-xs text-gray-500">한의 임상 지침 어시스턴트</p>
          </div>
          {/* 부제가 헤더 폭을 거의 다 쓰므로 플로우 밖(우상단)에 띄운다 — 행에 넣으면 부제가 잘린다 */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="사이드바 닫기"
            className="absolute right-2 top-2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="사이드바 열기"
          className="fixed left-3 top-3 z-10 rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 shadow-sm hover:bg-gray-100 hover:text-gray-700"
        >
          <PanelIcon className="h-5 w-5" />
        </button>
      )}
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
