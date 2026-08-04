'use client';

import { useClinicMembers } from '../api/clinic.api';

const formatDate = (value: string): string => new Date(value).toLocaleDateString('ko-KR');

/**
 * 클리닉 구성원 목록 — **전원에게 열려 있다** (spec 35·36).
 * 환자·대화를 전원이 공유하는데 동료가 누구인지 모르는 상태가 더 이상하다는 판단이다.
 * 탈퇴한 사람은 서버가 목록에서 빼므로 익명화된 값이 여기 나타나지 않는다.
 */
export function ClinicMembersPanel({ meId }: { meId: string }): React.ReactElement {
  const members = useClinicMembers();

  return (
    <section className="mt-4 rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-gray-900">함께 일하는 사람</h2>

      {members.isPending && <p className="py-3 text-sm text-gray-400">불러오는 중…</p>}
      {members.isError && (
        <p role="alert" className="py-3 text-sm text-red-500">
          구성원을 불러오지 못했습니다.
        </p>
      )}

      <ul className="mt-2">
        {members.data?.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-b-0"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm text-gray-800">{member.displayName}</span>
              {member.id === meId && <span className="shrink-0 text-xs text-gray-400">나</span>}
              {member.isOwner && (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  개설자
                </span>
              )}
            </div>
            <span className="shrink-0 text-xs text-gray-500">
              {formatDate(member.joinedAt)} 합류
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
