'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useCompleteSignUp } from '../api/auth.api';

const FIELD_CLASS =
  'rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-600 focus:outline-none';

/**
 * 소셜 인증 후 온보딩 (docs/specs/17).
 * 이메일·소셜 신원은 티켓 안에 있으므로 여기서는 한의원 정보만 받는다.
 */
export function OnboardingForm({
  ticket,
  defaultDisplayName = '',
}: {
  ticket: string;
  defaultDisplayName?: string;
}): React.ReactElement {
  const router = useRouter();
  const completeSignUp = useCompleteSignUp();
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
    try {
      await completeSignUp.mutateAsync({ ticket, ...form });
      router.push('/assistant');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '가입에 실패했습니다.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="onboarding-name" className="text-sm font-medium text-gray-700">
          이름
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
      <div className="flex flex-col gap-1">
        <label htmlFor="onboarding-clinic" className="text-sm font-medium text-gray-700">
          한의원명
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
      <div className="flex flex-col gap-1">
        <label htmlFor="onboarding-license" className="text-sm font-medium text-gray-700">
          면허번호
        </label>
        <input
          id="onboarding-license"
          value={form.licenseNumber}
          onChange={(e) => set('licenseNumber', e.target.value)}
          required
          maxLength={50}
          className={FIELD_CLASS}
        />
        <p className="text-xs text-gray-500">암호화되어 저장되며, 면허 확인은 별도 진행됩니다.</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.termsAccepted}
          onChange={(e) => set('termsAccepted', e.target.checked)}
          required
        />
        서비스 이용약관에 동의합니다
      </label>
      {errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
          <Link href="/login" className="ml-2 font-medium text-emerald-700 hover:underline">
            다시 로그인
          </Link>
        </p>
      )}
      <button
        type="submit"
        disabled={completeSignUp.isPending}
        className="rounded-lg bg-emerald-700 py-2.5 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        가입 완료
      </button>
    </form>
  );
}
