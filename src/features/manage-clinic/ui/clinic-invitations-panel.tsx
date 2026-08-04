'use client';

import { useState } from 'react';
import {
  type InvitationStatus,
  asText,
  useClinicInvitations,
  useIssueInvitation,
  useRevokeInvitation,
} from '../api/clinic.api';
import { invitationLink } from '../lib/invitation-link';

/** 상태는 컬럼이 아니라 acceptedAt·revokedAt·expiresAt에서 파생된 값이다 (spec 35) */
const STATUS_LABEL: Record<InvitationStatus, string> = {
  PENDING: '대기 중',
  ACCEPTED: '합류함',
  REVOKED: '취소됨',
  EXPIRED: '만료됨',
};

/** 색은 면허 인증 뱃지와 같은 뜻으로 읽힌다 — 초록은 끝난 일, 노랑은 아직 기다리는 일 */
const STATUS_STYLE: Record<InvitationStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-emerald-100 text-emerald-800',
  REVOKED: 'bg-gray-100 text-gray-500',
  EXPIRED: 'bg-gray-100 text-gray-500',
};

const formatDate = (value: string): string => new Date(value).toLocaleDateString('ko-KR');

/**
 * 초대 관리 — **개설자 전용**이다 (spec 35). 호출부가 `isOwner`를 확인하고 렌더한다.
 *
 * 발급 응답의 `token`이 링크를 볼 수 있는 유일한 기회다: BE는 해시만 저장하므로 목록에 실을 수
 * 없고 재열람 API도 없다. 그래서 방금 발급한 링크를 화면에서 놓치지 않게 따로 붙잡아 둔다.
 */
export function ClinicInvitationsPanel(): React.ReactElement {
  const invitations = useClinicInvitations(true);
  const issue = useIssueInvitation();
  const revoke = useRevokeInvitation();
  const [copied, setCopied] = useState(false);

  const issuedLink = issue.data ? invitationLink(issue.data.token) : null;
  const items = invitations.data?.pages.flatMap((page) => page.items) ?? [];

  const handleIssue = (): void => {
    setCopied(false);
    issue.mutate();
  };

  const handleCopy = async (): Promise<void> => {
    if (!issuedLink) return;
    try {
      await navigator.clipboard.writeText(issuedLink);
      setCopied(true);
    } catch {
      // 클립보드가 막힌 환경 — 아래 입력칸의 값을 직접 선택해 복사할 수 있다
    }
  };

  return (
    <section className="mt-4 rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">초대</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            링크를 만들어 직접 전달하면 그 사람이 우리 한의원으로 가입합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleIssue}
          disabled={issue.isPending}
          className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          초대 링크 만들기
        </button>
      </div>

      {issue.isError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {issue.error instanceof Error ? issue.error.message : '초대 링크를 만들지 못했습니다.'}
        </p>
      )}

      {issuedLink && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-medium text-emerald-900">
            지금만 확인할 수 있는 링크입니다 — 화면을 벗어나면 다시 볼 수 없어 새로 발급해야 합니다.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              value={issuedLink}
              aria-label="초대 링크"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-emerald-300 bg-white px-2 py-1.5 text-xs text-gray-700"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
            >
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
          {issue.data && (
            <p className="mt-2 text-xs text-emerald-700">
              {formatDate(issue.data.expiresAt)}까지 유효하며 한 번만 사용할 수 있습니다.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-gray-100 pt-2">
        {invitations.isPending && <p className="py-3 text-sm text-gray-400">불러오는 중…</p>}
        {invitations.isError && (
          <p role="alert" className="py-3 text-sm text-red-500">
            초대 목록을 불러오지 못했습니다.
          </p>
        )}
        {invitations.isSuccess && items.length === 0 && (
          <p className="py-3 text-sm text-gray-400">아직 보낸 초대가 없습니다.</p>
        )}

        <ul>
          {items.map((invitation) => {
            const acceptedBy = asText(invitation.acceptedByDisplayName);
            return (
              <li
                key={invitation.id}
                className="flex items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLE[invitation.status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {STATUS_LABEL[invitation.status] ?? invitation.status}
                  </span>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {invitation.status === 'ACCEPTED' && acceptedBy
                      ? `${acceptedBy} 합류`
                      : `${formatDate(invitation.expiresAt)}까지`}
                    {` · ${formatDate(invitation.createdAt)} 발급`}
                  </p>
                </div>
                {/* 취소는 아직 아무도 쓰지 않은 링크에만 뜻이 있다 */}
                {invitation.status === 'PENDING' && (
                  <button
                    type="button"
                    onClick={() => revoke.mutate(invitation.id)}
                    disabled={revoke.isPending}
                    className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    취소
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {invitations.hasNextPage && (
          <button
            type="button"
            onClick={() => void invitations.fetchNextPage()}
            disabled={invitations.isFetchingNextPage}
            className="mt-2 w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            더 보기
          </button>
        )}
      </div>
    </section>
  );
}
