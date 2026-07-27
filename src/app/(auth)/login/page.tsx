import { SocialLoginButtons } from '@/features/auth/ui/social-login-buttons';
import { LogoMark } from '@/shared/ui/logo-mark';

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
        {/* 마크 + 워드마크 가로 조합 — AppShell 사이드바 헤더와 같은 잠금(lockup)이다 */}
        <div className="mb-6 flex items-center gap-3">
          <LogoMark className="h-10 w-auto shrink-0 text-emerald-700" />
          <div>
            <h1 className="text-xl font-bold leading-tight text-emerald-800">Cure Agent</h1>
            <p className="mt-0.5 text-sm text-gray-500">한의 임상 지침 어시스턴트</p>
          </div>
        </div>
        <SocialLoginButtons error={error} />
        <p className="mt-6 text-center text-xs leading-relaxed text-gray-400">
          처음 로그인하면 한의원 정보를 입력하는 가입 절차로 이어집니다.
        </p>
      </div>
    </div>
  );
}
