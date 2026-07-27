import Link from 'next/link';
import { redirect } from 'next/navigation';
import { OnboardingForm } from '@/features/auth/ui/onboarding-form';

/**
 * 소셜 인증 후 온보딩 (docs/specs/17).
 * 콜백이 `?ticket=`을 붙여 보내며, 티켓 없이 직접 들어오면 로그인부터 다시 시작해야 한다.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string }>;
}): Promise<React.ReactElement> {
  const { ticket } = await searchParams;
  if (!ticket) redirect('/login');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-emerald-800">의료인 가입</h1>
        <p className="mb-6 mt-1 text-sm text-gray-500">
          소셜 인증이 확인되었습니다. 한의원 정보만 입력하면 가입이 완료됩니다.
        </p>
        <OnboardingForm ticket={ticket} />
        <p className="mt-6 text-center text-sm text-gray-500">
          다른 계정으로 하시겠어요?{' '}
          <Link href="/login" className="font-medium text-emerald-700 hover:underline">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
