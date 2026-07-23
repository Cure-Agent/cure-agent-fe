'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useLogin } from '../api/auth.api';

export function LoginForm(): React.ReactElement {
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      await login.mutateAsync({ email, password });
      router.push('/assistant');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '로그인에 실패했습니다.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="login-email" className="text-sm font-medium text-gray-700">
          이메일
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-600 focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="login-password" className="text-sm font-medium text-gray-700">
          비밀번호
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-600 focus:outline-none"
        />
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}
      <button
        type="submit"
        disabled={login.isPending}
        className="rounded-lg bg-emerald-700 py-2.5 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        로그인
      </button>
    </form>
  );
}
