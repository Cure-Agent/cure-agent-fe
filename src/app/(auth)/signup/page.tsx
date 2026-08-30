import Link from 'next/link';
import { redirect } from 'next/navigation';
import { OnboardingForm } from '@/features/auth/ui/onboarding-form';
import { Message } from '@/shared/i18n/message';

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
        <h1 className="text-xl font-bold text-emerald-800"><Message k="signupHeading" /></h1>
        <p className="mb-6 mt-1 text-sm text-gray-500">
          <Message k="signupLead" />
        </p>
        <OnboardingForm ticket={ticket} />
        <p className="mt-6 text-center text-sm text-gray-500">
          <Message k="useAnotherAccount" />{' '}
          <Link href="/login" className="font-medium text-emerald-700 hover:underline">
            <Message k="backToLogin" />
          </Link>
        </p>
      </div>
    </div>
  );
}
