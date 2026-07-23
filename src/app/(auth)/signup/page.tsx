import Link from 'next/link';
import { SignupForm } from '@/features/auth/ui/signup-form';

export default function SignupPage(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-emerald-800">의료인 가입</h1>
        <p className="mb-6 mt-1 text-sm text-gray-500">
          가입 즉시 이용할 수 있으며, 면허 확인은 별도 진행됩니다
        </p>
        <SignupForm />
        <p className="mt-6 text-center text-sm text-gray-500">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-medium text-emerald-700 hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
