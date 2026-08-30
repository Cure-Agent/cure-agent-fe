'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useInvitationPreview } from '@/features/manage-clinic/api/clinic.api';
import {
  clearInvitationToken,
  peekInvitationToken,
} from '@/features/manage-clinic/lib/invitation-link';
import type { CompleteSignUpInput } from '../api/auth.api';
import { useCompleteSignUp } from '../api/auth.api';
import { formatMessageNodes, messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';

const FIELD_CLASS =
  'rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-600 focus:outline-none';

/**
 * 소셜 인증 후 온보딩 (docs/specs/17·35).
 * 이메일·소셜 신원은 티켓 안에 있으므로 여기서는 한의원 정보만 받는다.
 *
 * 갈래가 둘이다 — **새 한의원 개설**(`clinicName`)과 **초대 합류**(`invitationToken`).
 * 서버가 둘을 함께 받으면 422이므로(spec 35) 한쪽만 보내고, 화면에서도 입력을 하나만 띄운다.
 * 초대 토큰은 소셜 왕복을 sessionStorage로 건너온다 — 콜백 URL에 실을 자리가 없다.
 */
export function OnboardingForm({
  ticket,
  defaultDisplayName = '',
}: {
  ticket: string;
  defaultDisplayName?: string;
}): React.ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const router = useRouter();
  const completeSignUp = useCompleteSignUp();
  // sessionStorage는 서버 렌더에 없다 — 마운트 후에 읽어 하이드레이션 불일치를 피한다
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  useEffect(() => {
    setInvitationToken(peekInvitationToken());
  }, []);

  const preview = useInvitationPreview(invitationToken);
  const previewEnabled = invitationToken !== null;
  // 링크를 받아 왔더라도 그사이 만료·취소됐을 수 있다. 그때는 합류를 접고 개설로 흘린다 —
  // 소셜 인증까지 끝낸 사람을 막다른 골목에 세우지 않는다
  const isJoining = previewEnabled && preview.isSuccess;
  const invitationExpired = previewEnabled && preview.isError;
  const isCheckingInvitation = previewEnabled && preview.isPending;

  const [form, setForm] = useState({
    displayName: defaultDisplayName,
    clinicName: '',
    licenseNumber: '',
    termsAccepted: false,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    const base = {
      ticket,
      displayName: form.displayName,
      licenseNumber: form.licenseNumber,
      termsAccepted: form.termsAccepted,
    };
    // 상호배타 — 둘을 함께 실으면 서버가 422로 되돌린다
    const body: CompleteSignUpInput =
      isJoining && invitationToken
        ? { ...base, invitationToken }
        : { ...base, clinicName: form.clinicName };

    try {
      await completeSignUp.mutateAsync(body);
      // 1회용 토큰이라 소비된 뒤에는 남겨둘 이유가 없다
      clearInvitationToken();
      router.push('/assistant');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t.signupFailed);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {isJoining && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <p className="text-sm text-emerald-900">
            {formatMessageNodes(t.joiningClinic, {
              clinic: <span className="font-medium">{preview.data?.clinicName}</span>,
            })}
          </p>
          <p className="mt-0.5 text-xs text-emerald-700">
            {t.joinInviteSharesRecords}
          </p>
        </div>
      )}
      {invitationExpired && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          {t.inviteExpiredCreateClinic}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="onboarding-name" className="text-sm font-medium text-gray-700">
          {t.displayName}
        </label>
        <input
          id="onboarding-name"
          value={form.displayName}
          onChange={(e) => set('displayName', e.target.value)}
          required
          maxLength={50}
          className={FIELD_CLASS}
        />
      </div>
      {/* 합류에는 한의원명이 없다 — 서버가 초대의 클리닉을 그대로 쓴다 */}
      {!isJoining && (
        <div className="flex flex-col gap-1">
          <label htmlFor="onboarding-clinic" className="text-sm font-medium text-gray-700">
            {t.clinicName}
          </label>
          <input
            id="onboarding-clinic"
            value={form.clinicName}
            onChange={(e) => set('clinicName', e.target.value)}
            required
            maxLength={100}
            className={FIELD_CLASS}
          />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="onboarding-license" className="text-sm font-medium text-gray-700">
          {t.licenseNumber}
        </label>
        <input
          id="onboarding-license"
          value={form.licenseNumber}
          onChange={(e) => set('licenseNumber', e.target.value)}
          required
          maxLength={50}
          className={FIELD_CLASS}
        />
        <p className="text-xs text-gray-500">{t.licenseEncrypted}</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.termsAccepted}
          onChange={(e) => set('termsAccepted', e.target.checked)}
          required
        />
        {t.agreeToTerms}
      </label>
      {errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
          <Link href="/login" className="ml-2 font-medium text-emerald-700 hover:underline">
            {t.loginAgain}
          </Link>
        </p>
      )}
      <button
        type="submit"
        disabled={completeSignUp.isPending || isCheckingInvitation}
        className="rounded-lg bg-emerald-700 py-2.5 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {isJoining ? t.join : t.completeSignup}
      </button>
    </form>
  );
}
