import Link from 'next/link';
import { LoginForm } from '@/features/auth/ui/login-form';

export default function LoginPage(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-emerald-800">Cure Agent</h1>
        <p className="mb-6 mt-1 text-sm text-gray-500">한의 임상 지침 기반 어시스턴트</p>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-gray-500">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="font-medium text-emerald-700 hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
