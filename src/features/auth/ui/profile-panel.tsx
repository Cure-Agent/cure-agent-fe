'use client';

/**
 * 계정 프로필 — 읽기 전용이다. 프로필 수정 API가 없어(BE auth 컨트롤러는 signup·refresh·logout·me
 * 넷뿐) 온보딩(docs/specs/17)에서 정해진 값을 그대로 보여준다.
 *
 * 되돌릴 수 없는 계정 동작(회원탈퇴)이 들어갈 자리는 이 화면이다 — 로그아웃처럼 항상 보이는
 * 사이드바에 두면 나가려다 지우는 오조작이 만들어진다.
 */
import type { ReactNode, ReactElement } from 'react';
import type { Clinician } from '../api/auth.api';

/** 면허 인증 상태. 지금은 어떤 기능도 게이트하지 않는다 — 사실만 표시하고 제한을 암시하지 않는다 */
const VERIFICATION_LABELS: Record<Clinician['verificationStatus'], string> = {
  PENDING: '확인 중',
  VERIFIED: '인증 완료',
  REJECTED: '인증 반려',
};

const VERIFICATION_STYLES: Record<Clinician['verificationStatus'], string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  VERIFIED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
};

/** dl 안의 한 행 — 라벨은 고정폭, 값은 남는 폭에서 줄인다 */
function Row({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-gray-100 py-3 last:border-b-0">
      <dt className="shrink-0 text-sm text-gray-500">{label}</dt>
      <dd className="min-w-0 truncate text-sm text-gray-800">{children}</dd>
    </div>
  );
}

export interface ProfilePanelProps {
  me: Clinician;
}

export function ProfilePanel({ me }: ProfilePanelProps): ReactElement {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <dl>
        <Row label="이름">{me.displayName}</Row>
        {/* 소셜 계정에서 받은 이메일이 계정 동일성의 단일 기준이다 (docs/specs/17) */}
        <Row label="이메일">{me.email}</Row>
        <Row label="소속">{me.clinic.name}</Row>
        <Row label="면허 인증">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              VERIFICATION_STYLES[me.verificationStatus]
            }`}
          >
            {VERIFICATION_LABELS[me.verificationStatus]}
          </span>
        </Row>
      </dl>
    </div>
  );
}
