'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useClinicMembers } from '@/features/manage-clinic/api/clinic.api';
import { ApiError } from '@/shared/api/api-error';
import { useWithdraw } from '../api/auth.api';

/**
 * 회원탈퇴 (BE docs/specs/36). 되돌릴 수 없는 계정 동작이라 사이드바가 아니라 이 화면에 둔다 —
 * 로그아웃과 나란히 두면 나가려다 지우는 오조작이 만들어진다.
 *
 * 개설자에게 남은 동료가 있으면 서버가 409 `CLINIC_OWNER_MUST_TRANSFER`로 막는다. 그 요청은
 * 익명화를 시작하지도 않으므로(판정이 파기보다 앞선다) 안내만 하고 그대로 멈춘다.
 * **이양은 여기서 하지 않는다** — 「함께 일하는 사람」의 상시 동작이다. 탈퇴 흐름 안에 숨겨 두면
 * 떠날 생각이 없는 개설자가 권한만 넘길 방법이 없어진다.
 */
export function WithdrawSection({ meId }: { meId: string }): React.ReactElement {
  const router = useRouter();
  const members = useClinicMembers();
  const withdraw = useWithdraw();

  const [stage, setStage] = useState<'idle' | 'confirming' | 'done'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsTransfer, setNeedsTransfer] = useState(false);

  const others = members.data?.filter((member) => member.id !== meId) ?? [];
  // 마지막 한 사람이면 서버가 클리닉 전체를 파기 예약한다 — 남는 것과 사라지는 것이 달라진다
  const isLastMember = members.isSuccess && others.length === 0;

  const reset = (): void => {
    setStage('idle');
    setErrorMessage(null);
    setNeedsTransfer(false);
  };

  const handleWithdraw = async (): Promise<void> => {
    setErrorMessage(null);
    setNeedsTransfer(false);
    try {
      await withdraw.mutateAsync();
      setStage('done');
      // 세션이 이미 끊겼다 — 돌아올 화면이 없으므로 replace다
      router.replace('/login');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CLINIC_OWNER_MUST_TRANSFER') {
        // 서버 문구가 무엇을 해야 하는지 담고 있다 (§10.1 — message 그대로 쓴다)
        setErrorMessage(error.message);
        setNeedsTransfer(true);
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '탈퇴에 실패했습니다.');
    }
  };

  if (stage === 'done') {
    return (
      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-400">탈퇴했습니다. 로그인 화면으로 이동합니다…</p>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-xl border border-red-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-red-800">계정 삭제</h2>

      {stage === 'idle' && (
        <>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            탈퇴하면 이름·이메일·면허번호가 즉시 삭제되고 모든 기기에서 로그아웃됩니다. 되돌릴 수
            없습니다.
          </p>
          <button
            type="button"
            onClick={() => setStage('confirming')}
            className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            회원탈퇴
          </button>
        </>
      )}

      {stage === 'confirming' && (
        <div className="mt-2">
          <p className="text-sm text-gray-800">정말 탈퇴하시겠습니까?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-gray-600">
            <li>이름·이메일·면허번호가 즉시 삭제됩니다.</li>
            {/* 남는 것과 사라지는 것이 구성원 수로 갈린다 — 확정 전에는 어느 쪽도 단정하지 않는다 */}
            {members.isPending && <li>한의원 구성원을 확인하는 중입니다…</li>}
            {isLastMember && (
              // 접근할 사람이 0명이 된 진료 기록을 무기한 남기지 않는다는 판단이다 (spec 36)
              <li className="text-red-700">
                한의원의 마지막 구성원이라 <strong>환자·대화 기록이 모두 함께 삭제</strong>됩니다.
              </li>
            )}
            {members.isSuccess && !isLastMember && (
              <li>환자·대화 기록은 한의원의 자산이라 남은 구성원에게 그대로 남습니다.</li>
            )}
            {members.isError && (
              <li className="text-amber-700">
                구성원 정보를 확인하지 못했습니다. 남은 구성원이 없다면 환자·대화 기록도 함께
                삭제됩니다.
              </li>
            )}
            <li>같은 소셜 계정으로 새로 가입할 수 있지만, 이전 기록과는 이어지지 않습니다.</li>
          </ul>
          {errorMessage && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {errorMessage}
            </p>
          )}
          {needsTransfer && (
            // 여기서 대상을 고르게 하지 않는다 — 이양은 위 「함께 일하는 사람」의 동작이다
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              위 「함께 일하는 사람」에서 <strong>개설자 권한 넘기기</strong>로 다른 구성원에게
              권한을 넘긴 뒤 다시 시도해주세요.
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={withdraw.isPending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              취소
            </button>
            {/* 무엇이 사라지는지 확정되기 전에는 되돌릴 수 없는 결정을 받지 않는다 */}
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={withdraw.isPending || members.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              탈퇴하기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
