'use client';

import { useState } from 'react';
import { useClinicMembers, useTransferOwner } from '../api/clinic.api';

const formatDate = (value: string): string => new Date(value).toLocaleDateString('ko-KR');

/**
 * 클리닉 구성원 목록 — **전원에게 열려 있다** (spec 35·36).
 * 환자·대화를 전원이 공유하는데 동료가 누구인지 모르는 상태가 더 이상하다는 판단이다.
 * 탈퇴한 사람은 서버가 목록에서 빼므로 익명화된 값이 여기 나타나지 않는다.
 *
 * **개설자 권한 이양도 이 자리다.** 이양이 바꾸는 것은 「누가 이 클리닉의 개설자인가」이고
 * 그 결과가 바로 이 목록의 배지로 드러난다. 탈퇴 흐름에 묶어 두면 떠날 생각이 없는 개설자가
 * 권한만 넘길 방법이 없어진다 — 원장이 바뀌는 일과 계정을 지우는 일은 서로 다른 사건이다.
 */
export function ClinicMembersPanel({ meId }: { meId: string }): React.ReactElement {
  const members = useClinicMembers();
  const transferOwner = useTransferOwner();

  const [isChoosing, setIsChoosing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [handedOverTo, setHandedOverTo] = useState<string | null>(null);

  const isOwner = members.data?.some((member) => member.id === meId && member.isOwner) ?? false;
  const others = members.data?.filter((member) => member.id !== meId) ?? [];
  // 넘길 상대가 없으면 이양이라는 동작 자체가 성립하지 않는다
  const canTransfer = isOwner && others.length > 0;

  const cancel = (): void => {
    setIsChoosing(false);
    setSelectedId(null);
    setErrorMessage(null);
  };

  const handleTransfer = async (): Promise<void> => {
    if (!selectedId) return;
    setErrorMessage(null);
    const target = others.find((member) => member.id === selectedId);
    try {
      await transferOwner.mutateAsync(selectedId);
      setHandedOverTo(target?.displayName ?? null);
      setIsChoosing(false);
      setSelectedId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '권한을 넘기지 못했습니다.');
    }
  };

  return (
    <section className="mt-4 rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-sm font-semibold text-gray-900">함께 일하는 사람</h2>
        {canTransfer && !isChoosing && (
          <button
            type="button"
            onClick={() => setIsChoosing(true)}
            className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
          >
            개설자 권한 넘기기
          </button>
        )}
      </div>

      {members.isPending && <p className="py-3 text-sm text-gray-400">불러오는 중…</p>}
      {members.isError && (
        <p role="alert" className="py-3 text-sm text-red-500">
          구성원을 불러오지 못했습니다.
        </p>
      )}

      {handedOverTo && !isChoosing && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {handedOverTo}님에게 개설자 권한을 넘겼습니다. 이제 초대 발급과 다음 이양은 그 구성원의
          몫입니다.
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

      {isChoosing && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <fieldset>
            <legend className="text-xs font-medium text-gray-700">
              개설자 권한을 넘길 구성원
            </legend>
            <div className="mt-2">
              {others.map((member) => (
                <label
                  key={member.id}
                  className="flex cursor-pointer items-center gap-2 border-b border-gray-200 py-2.5 last:border-b-0"
                >
                  <input
                    type="radio"
                    name="transfer-target"
                    value={member.id}
                    checked={selectedId === member.id}
                    onChange={() => setSelectedId(member.id)}
                  />
                  <span className="min-w-0 truncate text-sm text-gray-800">
                    {member.displayName}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-gray-500">
                    {formatDate(member.joinedAt)} 합류
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            넘기고 나면 초대 발급과 다음 이양은 그 구성원만 할 수 있습니다. 되돌리려면 새 개설자가
            다시 넘겨줘야 합니다.
          </p>
          {errorMessage && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {errorMessage}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={transferOwner.isPending}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleTransfer}
              disabled={transferOwner.isPending || !selectedId}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              권한 넘기기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
