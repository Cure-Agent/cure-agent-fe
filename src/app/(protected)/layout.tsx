'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useMe } from '@/features/auth/api/auth.api';
import { AppShell } from '@/widgets/app-shell/app-shell';
import { messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';

export default function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement | null {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);

  if (me.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        {t.confirmingSession}
      </div>
    );
  }
  if (me.isError || !me.data) return null;

  return <AppShell me={me.data}>{children}</AppShell>;
}
