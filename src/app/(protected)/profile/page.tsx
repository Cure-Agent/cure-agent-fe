'use client';

import { useMe } from '@/features/auth/api/auth.api';
import { ProfilePanel } from '@/features/auth/ui/profile-panel';
import { WithdrawSection } from '@/features/auth/ui/withdraw-section';
import { useClinicMembers } from '@/features/manage-clinic/api/clinic.api';
import { ClinicInvitationsPanel } from '@/features/manage-clinic/ui/clinic-invitations-panel';
import { ClinicMembersPanel } from '@/features/manage-clinic/ui/clinic-members-panel';

export default function ProfilePage(): React.ReactElement | null {
  // 보호 레이아웃이 이미 세션을 확인하고 통과시켰다 — 같은 쿼리키라 여기서는 캐시를 읽는다
  const me = useMe();
  // 개설자 여부를 알려주는 API는 없다 — 구성원 목록의 isOwner가 유일한 근거다 (BE spec 36)
  const members = useClinicMembers();
  if (!me.data) return null;

  const meId = me.data.id;
  const isOwner = members.data?.some((member) => member.id === meId && member.isOwner) ?? false;

  return (
    <section className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <h1 className="mb-4 shrink-0 text-2xl font-bold text-gray-900">프로필</h1>
      <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto pb-8">
        <ProfilePanel me={me.data} />
        <ClinicMembersPanel meId={meId} />
        {/* 초대 발급·취소는 개설자 전용이다 — 아닌 사람에게는 403이 될 자리를 아예 열지 않는다 */}
        {isOwner && <ClinicInvitationsPanel />}
        <WithdrawSection meId={meId} />
      </div>
    </section>
  );
}
