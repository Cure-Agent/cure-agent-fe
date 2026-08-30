'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { SocialLoginButtons } from '@/features/auth/ui/social-login-buttons';
import { LogoMark } from '@/shared/ui/logo-mark';
import { useInvitationPreview } from '../api/clinic.api';
import { stashInvitationToken } from '../lib/invitation-link';
import { formatMessageNodes, messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';

/**
 * 초대 링크 수락 진입 (BE docs/specs/35).
 *
 * 링크를 연 사람은 아직 계정이 없다 — 프리뷰가 비인증 경로인 이유다. 여기서 보여줄 수 있는
 * 것은 한의원명뿐이며(초대자·클리닉 id는 응답에 없다), 합류는 소셜 로그인 → 온보딩으로 이어진다.
 *
 * 세션을 확인하지 않는다. `useMe()`를 부르면 비로그인 방문자가 401 → refresh 실패 →
 * 전역 핸들러의 `/login` 리다이렉트로 튕겨 나가, 정작 초대받은 사람이 이 화면을 못 본다.
 */
export function InvitationLanding({ token }: { token: string }): React.ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const preview = useInvitationPreview(token);

  // 소셜 왕복 동안 토큰을 맡겨 둔다 — 콜백은 `/signup?ticket=`만 들고 돌아온다.
  // 유효한 초대일 때만 맡긴다: 죽은 토큰을 남기면 다음 가입이 만료 안내부터 보게 된다
  useEffect(() => {
    if (preview.isSuccess) stashInvitationToken(token);
  }, [preview.isSuccess, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-center gap-3">
          <LogoMark className="h-10 w-auto shrink-0 text-emerald-700" />
          <div>
            <h1 className="text-xl font-bold leading-tight text-emerald-800">Cure Agent</h1>
            <p className="mt-0.5 text-sm text-gray-500">{t.appTaglineShort}</p>
          </div>
        </div>

        {preview.isPending && (
          <p className="py-6 text-center text-sm text-gray-500">{t.checkingInvitation}</p>
        )}

        {preview.isError && (
          <>
            {/* 만료·사용됨·취소됨·없음을 서버가 하나로 뭉쳐 내려준다(spec 35) —
                구분해 알려주면 유출된 토큰의 실재 여부를 확인해주는 셈이다 */}
            <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              {t.invitationInvalid}
            </p>
            <p className="mt-6 text-center text-sm text-gray-500">
              {t.haveAccount}{' '}
              <Link href="/login" className="font-medium text-emerald-700 hover:underline">
                {t.login}
              </Link>
            </p>
          </>
        )}

        {preview.isSuccess && (
          <>
            <p className="mb-6 text-center text-sm leading-relaxed text-gray-600">
              {formatMessageNodes(t.invitedByClinic, {
                clinic: (
                  <span className="font-medium text-gray-900">{preview.data.clinicName}</span>
                ),
              })}
              <br />
              {t.loginLeadsToSignup}
            </p>
            <SocialLoginButtons />
            <p className="mt-6 text-center text-xs leading-relaxed text-gray-400">
              {t.joinSharesRecords}
              <br />
              {t.joinBlockedIfInClinic}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
