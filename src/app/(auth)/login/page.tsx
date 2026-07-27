import { SocialLoginButtons } from '@/features/auth/ui/social-login-buttons';

/**
 * 소셜 로그인 진입 (docs/specs/17).
 * 콜백 실패는 `?error=<에러코드>`로 되돌아오므로 searchParams에서 읽어 표시한다.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}): Promise<React.ReactElement> {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-emerald-800">Cure Agent</h1>
        <p className="mb-6 mt-1 text-sm text-gray-500">한의 임상 지침 기반 어시스턴트</p>
        <SocialLoginButtons error={error} />
        <p className="mt-6 text-center text-xs leading-relaxed text-gray-400">
          처음 로그인하면 한의원 정보를 입력하는 가입 절차로 이어집니다.
        </p>
      </div>
    </div>
  );
}
