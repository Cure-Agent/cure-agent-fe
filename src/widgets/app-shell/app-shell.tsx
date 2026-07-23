'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Clinician, useLogout } from '@/features/auth/api/auth.api';

const NAV_ITEMS = [
  { href: '/assistant', label: '어시스턴트' },
  { href: '/guidelines', label: '지침' },
  { href: '/patients', label: '환자' },
  { href: '/history', label: '히스토리' },
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

  const handleLogout = async (): Promise<void> => {
    try {
      await logout.mutateAsync();
    } finally {
      router.replace('/login');
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-60 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <p className="text-lg font-bold text-emerald-800">Cure Agent</p>
          <p className="text-xs text-gray-500">한의 임상 지침 어시스턴트</p>
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
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
