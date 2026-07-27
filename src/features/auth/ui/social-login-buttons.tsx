'use client';

import { OAuthProvider, oauthLoginHref, useOAuthProviders } from '../api/auth.api';

/** 제공자별 브랜드 표기 — 각 사의 로그인 버튼 가이드라인을 따른다 (docs/specs/17) */
const BRAND: Record<OAuthProvider, { label: string; className: string }> = {
  GOOGLE: {
    label: 'Google로 계속하기',
    className: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  },
  KAKAO: {
    label: '카카오로 계속하기',
    className: 'bg-[#FEE500] text-[#191600] hover:brightness-95',
  },
  NAVER: {
    label: '네이버로 계속하기',
    className: 'bg-[#03C75A] text-white hover:brightness-95',
  },
};

/** 콜백이 로그인 페이지로 되돌려 보낼 때 붙이는 에러코드 → 사용자 문구 */
const ERROR_MESSAGE: Record<string, string> = {
  AUTH_OAUTH_DENIED: '소셜 로그인이 취소되었습니다.',
  AUTH_OAUTH_STATE_MISMATCH: '로그인 요청이 만료되었습니다. 다시 시도해주세요.',
  AUTH_OAUTH_EMAIL_MISSING: '가입에는 이메일이 필요합니다. 이메일 제공에 동의해주세요.',
  AUTH_OAUTH_PROVIDER_UNSUPPORTED: '지원하지 않는 소셜 로그인입니다.',
  AUTH_OAUTH_TICKET_INVALID: '가입 정보가 만료되었습니다. 다시 로그인해주세요.',
  AUTH_OAUTH_FAILED: '소셜 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.',
};

export function SocialLoginButtons({ error }: { error?: string }): React.ReactElement {
  const providers = useOAuthProviders();

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {ERROR_MESSAGE[error] ?? '로그인에 실패했습니다. 다시 시도해주세요.'}
        </p>
      )}

      {providers.isPending && (
        <p className="py-2 text-center text-sm text-gray-500">로그인 수단 확인 중…</p>
      )}

      {providers.isError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          로그인 수단을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.
        </p>
      )}

      {/* next/link가 아닌 순수 <a>여야 한다 — 클라이언트 라우팅이 아니라 BE로의 전체 이동이다 */}
      {providers.data?.map((provider) => (
        <a
          key={provider}
          href={oauthLoginHref(provider)}
          className={`rounded-lg py-2.5 text-center font-medium transition ${BRAND[provider].className}`}
        >
          {BRAND[provider].label}
        </a>
      ))}

      {providers.data?.length === 0 && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          사용 가능한 소셜 로그인이 없습니다. 관리자에게 문의해주세요.
        </p>
      )}
    </div>
  );
}
