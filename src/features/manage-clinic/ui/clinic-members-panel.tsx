'use client';

import { useState } from 'react';
import { formatMessage, formatMessageNodes, messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';
import {
  type ClinicMember,
  useClinicMembers,
  useRemoveMember,
  useTransferOwner,
} from '../api/clinic.api';

const formatDate = (value: string): string => new Date(value).toLocaleDateString('ko-KR');

/**
 * 클리닉 구성원 목록 — **전원에게 열려 있다** (spec 35·36).
 * 환자·대화를 전원이 공유하는데 동료가 누구인지 모르는 상태가 더 이상하다는 판단이다.
 * 탈퇴한 사람은 서버가 목록에서 빼므로 익명화된 값이 여기 나타나지 않는다.
 *
 * **개설자 권한 이양도 이 자리다.** 이양이 바꾸는 것은 「누가 이 클리닉의 개설자인가」이고
 * 그 결과가 바로 이 목록의 배지로 드러난다. 탈퇴 흐름에 묶어 두면 떠날 생각이 없는 개설자가
 * 권한만 넘길 방법이 없어진다 — 원장이 바뀌는 일과 계정을 지우는 일은 서로 다른 사건이다.
 *
 * **구성원 내보내기(spec 38)는 행에 붙인다** — 이양과 진입점이 다른 데는 이유가 있다.
 * 이양은 「누구에게?」가 질문이라 고르는 절차 자체가 동작의 일부고, 가능 여부도 목록 전체의
 * 성질(넘길 상대가 있는가)로 정해져 헤더가 제자리다. 내보내기는 대상이 이미 정해진 채로
 * 시작하고 가능 여부가 **행마다** 갈리므로(자신은 409다), 헤더에 두면 방금 읽은 목록에서
 * 한 줄만 빠진 목록을 다시 읽히게 된다. 확인 절차의 문법만 이양과 같게 맞춘다.
 */
export function ClinicMembersPanel({ meId }: { meId: string }): React.ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const members = useClinicMembers();
  const transferOwner = useTransferOwner();
  const removeMember = useRemoveMember();

  const [isChoosing, setIsChoosing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [handedOverTo, setHandedOverTo] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removedName, setRemovedName] = useState<string | null>(null);

  const isOwner = members.data?.some((member) => member.id === meId && member.isOwner) ?? false;
  const others = members.data?.filter((member) => member.id !== meId) ?? [];
  // 넘길 상대가 없으면 이양이라는 동작 자체가 성립하지 않는다
  const canTransfer = isOwner && others.length > 0;

  const cancel = (): void => {
    setIsChoosing(false);
    setSelectedId(null);
    setErrorMessage(null);
  };

  // 두 확인이 함께 열리면 무엇을 승인하는 중인지 흐려진다 — 여는 쪽이 상대를 접는다
  const startTransfer = (): void => {
    setRemovingId(null);
    setRemoveError(null);
    setIsChoosing(true);
  };

  const startRemove = (memberId: string): void => {
    cancel();
    setRemoveError(null);
    setRemovingId(memberId);
  };

  const cancelRemove = (): void => {
    setRemovingId(null);
    setRemoveError(null);
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
      setErrorMessage(error instanceof Error ? error.message : t.handOverFailed);
    }
  };

  const handleRemove = async (member: ClinicMember): Promise<void> => {
    setRemoveError(null);
    try {
      await removeMember.mutateAsync(member.id);
      // 성공하면 그 행이 목록에서 사라진다 — 무슨 일이 일어났는지는 배너만이 말해준다
      setRemovedName(member.displayName);
      setRemovingId(null);
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : t.removeFailed);
    }
  };

  return (
    <section className="mt-4 rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-sm font-semibold text-gray-900">{t.membersHeading}</h2>
        {canTransfer && !isChoosing && (
          <button
            type="button"
            onClick={startTransfer}
            className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
          >
            {t.handOverOwnership}
          </button>
        )}
      </div>

      {members.isPending && <p className="py-3 text-sm text-gray-400">{t.loading}</p>}
      {members.isError && (
        <p role="alert" className="py-3 text-sm text-red-500">
          {t.membersLoadFailed}
        </p>
      )}

      {handedOverTo && !isChoosing && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {formatMessage(t.handedOverNotice, { name: handedOverTo })}
        </p>
      )}

      {/* 축하할 일도 경고할 일도 아니다 — 색으로 무게를 얹지 않는다 */}
      {removedName && !removingId && (
        <p className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">
          {formatMessage(t.removedNotice, { name: removedName })}
        </p>
      )}

      <ul className="mt-2">
        {members.data?.map((member) => {
          // 자기 자신은 서버가 409로 막는다(spec 38) — 누를 수 없는 버튼을 그리지 않는다
          const canRemove = isOwner && member.id !== meId;
          const isRemoving = removingId === member.id;

          return (
            <li key={member.id} className="border-b border-gray-100 py-3 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm text-gray-800">{member.displayName}</span>
                  {member.id === meId && <span className="shrink-0 text-xs text-gray-400">{t.self}</span>}
                  {member.isOwner && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      {t.owner}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {formatMessage(t.joinedOn, { date: formatDate(member.joinedAt) })}
                  </span>
                  {/*
                    「권한 넘기기」보다 시선을 덜 끌어야 한다 — 되돌릴 수는 있어도 오조작이 남에게 간다.
                    다만 합류일과 같은 회색으로 나란히 두면 눌리는 것인지가 드러나지 않아,
                    패딩으로 누를 자리를 넓히고 hover에서만 배경을 준다. `-mr-2`는 그 패딩이
                    만드는 어긋남을 되돌려 윗행 합류일과 오른쪽 끝을 맞춘다.
                  */}
                  {canRemove && !isRemoving && (
                    <button
                      type="button"
                      onClick={() => startRemove(member.id)}
                      className="-mr-2 rounded-md px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      {t.remove}
                    </button>
                  )}
                </div>
              </div>

              {isRemoving && (
                // 확인을 그 행 아래 붙여 연다 — 대상이 눈에 붙어 있어야 잘못 눌러도 실행 전에 안다
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-800">
                    {formatMessageNodes(t.removeConfirm, {
                    name: <strong>{member.displayName}</strong>,
                  })}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-gray-600">
                    {/* 계정 삭제로 오해하기 딱 좋은 자리라 남는 것부터 적는다 */}
                    <li>{t.removeKeepsAccount}</li>
                    <li>{t.removeKeepsRecords}</li>
                    {/* 고지하지 않으면 놀라는 부수효과다 — 이양 후 전임자를 내보내는 경로에서 실재한다 */}
                    <li>{t.removeRevokesInvites}</li>
                    <li>{t.removeLogsOut}</li>
                  </ul>
                  {removeError && (
                    <p role="alert" className="mt-2 text-sm text-red-600">
                      {removeError}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={cancelRemove}
                      disabled={removeMember.isPending}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {t.cancel}
                    </button>
                    {/* 빨강은 「계정 삭제」에 남겨 둔다 — 같은 색을 쓰면 같은 무게로 읽힌다 */}
                    <button
                      type="button"
                      onClick={() => handleRemove(member)}
                      disabled={removeMember.isPending}
                      className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
                    >
                      {formatMessage(t.removeWithName, { name: member.displayName })}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {isChoosing && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <fieldset>
            <legend className="text-xs font-medium text-gray-700">
              {t.handOverTarget}
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
                    {formatMessage(t.joinedOn, { date: formatDate(member.joinedAt) })}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            {t.handOverWarning}
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
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleTransfer}
              disabled={transferOwner.isPending || !selectedId}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {t.handOver}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
