'use client';

import { useMe } from '@/features/auth/api/auth.api';
import { ProfilePanel } from '@/features/auth/ui/profile-panel';

export default function ProfilePage(): React.ReactElement | null {
  // 보호 레이아웃이 이미 세션을 확인하고 통과시켰다 — 같은 쿼리키라 여기서는 캐시를 읽는다
  const me = useMe();
  if (!me.data) return null;

  return (
    <section className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <h1 className="mb-4 shrink-0 text-2xl font-bold text-gray-900">프로필</h1>
      <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto">
        <ProfilePanel me={me.data} />
      </div>
    </section>
  );
}
