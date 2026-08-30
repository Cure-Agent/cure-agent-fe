'use client';

import { useId } from 'react';
import { GoogleLogo, KakaoLogo, NaverLogo } from '@/shared/ui/provider-logos';
import { OAuthProvider, oauthLoginHref, useOAuthProviders } from '../api/auth.api';
import { type MessageKey, messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';

/**
 * 제공자별 브랜드 표기 — 각 사의 로그인 버튼 가이드라인을 따른다 (docs/specs/17)
 *
 * 심볼만 쓰는 **아이콘형** 버튼이라 `label`은 화면에 그려지지 않고 `aria-label`로만 쓴다.
 * 그래도 각 사가 규정한 문구를 그대로 둔다 — 접근 가능한 이름이 곧 버튼의 이름이라
 * 문구 규정이 여기에도 그대로 적용된다. 화면에 안 보인다고 임의로 바꾸지 말 것.
 */
const BRAND: Record<
  OAuthProvider,
  {
    labelKey: MessageKey;
    className: string;
    Logo: (props: { className?: string }) => React.ReactElement;
  }
> = {
  GOOGLE: {
    labelKey: 'loginWithGoogle',
    /* 흰 컨테이너는 흰 카드 위에서 경계가 사라진다 — 테두리가 장식이 아니라 필수다 */
    className: 'border border-gray-300 bg-white hover:bg-gray-50',
    Logo: GoogleLogo,
  },
  KAKAO: {
    /* 카카오는 레이블을 완성형 '카카오 로그인' / 축약형 '로그인'으로만 규정한다 — 임의 문구 금지 */
    labelKey: 'loginWithKakao',
    /* 색 규정 고정값 — 컨테이너 #FEE500 (레이블 색 규정은 아이콘형이라 걸리지 않는다) */
    className: 'bg-[#FEE500] hover:brightness-95',
    Logo: KakaoLogo,
  },
  NAVER: {
    labelKey: 'loginWithNaver',
    className: 'bg-[#03C75A] hover:brightness-95',
    Logo: NaverLogo,
  },
};

/** 콜백이 로그인 페이지로 되돌려 보낼 때 붙이는 에러코드 → 사용자 문구 */
const ERROR_MESSAGE: Record<string, MessageKey> = {
  AUTH_OAUTH_DENIED: 'authOauthDenied',
  AUTH_OAUTH_STATE_MISMATCH: 'authOauthStateMismatch',
  AUTH_OAUTH_EMAIL_MISSING: 'authOauthEmailMissing',
  AUTH_OAUTH_PROVIDER_UNSUPPORTED: 'authOauthProviderUnsupported',
  AUTH_OAUTH_TICKET_INVALID: 'authOauthTicketInvalid',
  AUTH_OAUTH_FAILED: 'authOauthFailed',
};

export function SocialLoginButtons({ error }: { error?: string }): React.ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const providers = useOAuthProviders();
  const labelId = useId();

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {t[ERROR_MESSAGE[error] ?? 'loginFailed']}
        </p>
      )}

      {providers.isPending && (
        <p className="py-2 text-center text-sm text-gray-500">{t.socialLoginLoading}</p>
      )}

      {providers.isError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {t.socialLoginLoadFailed}
        </p>
      )}

      {providers.data && providers.data.length > 0 && (
        <>
          {/* 묶음 레이블이 "가입까지 포함" 의미를 진다 — 버튼 문구는 각 사 규정에 묶여 있어 못 쓴다 */}
          <p id={labelId} className="text-center text-sm text-gray-500">
            {t.socialLoginStart}
          </p>

          <div role="group" aria-labelledby={labelId} className="flex justify-center gap-5">
            {/* next/link가 아닌 순수 <a>여야 한다 — 클라이언트 라우팅이 아니라 BE로의 전체 이동이다 */}
            {providers.data.map((provider) => {
              const { labelKey, className, Logo } = BRAND[provider];
              return (
                <a
                  key={provider}
                  href={oauthLoginHref(provider)}
                  /* 화면에 문구가 없으므로 이 aria-label이 버튼의 유일한 이름이다 */
                  aria-label={t[labelKey]}
                  /* 44px — 터치 타깃 하한이자 카카오 심볼:버튼 비(0.378)가 맞는 지름. 줄이지 말 것 */
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition ${className}`}
                >
                  {/* 크기는 각 사 가이드의 최소치가 달라 마크 컴포넌트가 직접 갖는다 (전부 18px) */}
                  <Logo />
                </a>
              );
            })}
          </div>
        </>
      )}

      {providers.data?.length === 0 && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t.socialLoginNone}
        </p>
      )}
    </div>
  );
}
