'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useSignup } from '../api/auth.api';

const FIELD_CLASS =
  'rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-600 focus:outline-none';

export function SignupForm(): React.ReactElement {
  const router = useRouter();
  const signup = useSignup();
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
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
      await signup.mutateAsync(form);
      router.push('/assistant');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '가입에 실패했습니다.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="signup-email" className="text-sm font-medium text-gray-700">
          이메일
        </label>
        <input
          id="signup-email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          required
          className={FIELD_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="signup-password" className="text-sm font-medium text-gray-700">
          비밀번호 (10자 이상)
        </label>
        <input
          id="signup-password"
          type="password"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          required
          minLength={10}
          className={FIELD_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="signup-name" className="text-sm font-medium text-gray-700">
          이름
        </label>
        <input
          id="signup-name"
          value={form.displayName}
          onChange={(e) => set('displayName', e.target.value)}
          required
          className={FIELD_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="signup-clinic" className="text-sm font-medium text-gray-700">
          한의원명
        </label>
        <input
          id="signup-clinic"
          value={form.clinicName}
          onChange={(e) => set('clinicName', e.target.value)}
          required
          className={FIELD_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="signup-license" className="text-sm font-medium text-gray-700">
          면허번호
        </label>
        <input
          id="signup-license"
          value={form.licenseNumber}
          onChange={(e) => set('licenseNumber', e.target.value)}
          required
          className={FIELD_CLASS}
        />
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
        </p>
      )}
      <button
        type="submit"
        disabled={signup.isPending}
        className="rounded-lg bg-emerald-700 py-2.5 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        가입하기
      </button>
    </form>
  );
}
