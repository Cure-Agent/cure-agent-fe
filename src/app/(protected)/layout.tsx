'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useMe } from '@/features/auth/api/auth.api';
import { AppShell } from '@/widgets/app-shell/app-shell';

export default function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement | null {
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);

  if (me.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        세션 확인 중…
      </div>
    );
  }
  if (me.isError || !me.data) return null;

  return <AppShell me={me.data}>{children}</AppShell>;
}
