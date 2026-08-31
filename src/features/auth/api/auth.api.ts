'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scheduleWelcomeTour } from '@/features/onboarding-tour/model/tour-state';
import { api } from '@/shared/api/api-client';
import { unwrap } from '@/shared/api/api-error';
import { buildUrl } from '@/shared/api/http';
import type { components } from '@/shared/api/generated/schema';

export type Clinician = components['schemas']['ClinicianResponseDto'];
export type AuthSession = components['schemas']['AuthSessionResponseDto'];
export type OAuthProvider = components['schemas']['OAuthProvidersResponseDto']['providers'][number];

/**
 * 티켓과 함께 보내는 온보딩 입력 — 이메일·소셜 신원은 서버가 티켓에서 꺼낸다 (docs/specs/17).
 * `clinicName`(새 개설)과 `invitationToken`(합류)은 **상호배타다** — 함께 보내면 422다 (docs/specs/35).
 */
export type CompleteSignUpInput = components['schemas']['CompleteSignUpRequestDto'];

export const ME_QUERY_KEY = ['auth', 'me'] as const;
export const OAUTH_PROVIDERS_QUERY_KEY = ['auth', 'oauth', 'providers'] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => unwrap<Clinician>(await api.GET('/api/v1/auth/me')),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/** 로그인 버튼으로 노출할 활성 제공자 — BE에 client id가 설정된 것만 내려온다 */
export function useOAuthProviders() {
  return useQuery({
    queryKey: OAUTH_PROVIDERS_QUERY_KEY,
    queryFn: async () => {
      const data = unwrap<{ providers: OAuthProvider[] }>(
        await api.GET('/api/v1/auth/oauth/providers'),
      );
      return data.providers;
    },
    retry: false,
    staleTime: Infinity,
  });
}

/**
 * 소셜 로그인 시작 URL. 반드시 링크(전체 페이지 이동)로 열어야 한다 —
 * 제공자 동의 화면으로의 302를 fetch가 대신 따라가면 쿠키·리다이렉트가 성립하지 않는다.
 */
export function oauthLoginHref(provider: OAuthProvider): string {
  return buildUrl(`/api/v1/auth/oauth/${provider.toLowerCase()}`);
}

export function useCompleteSignUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CompleteSignUpInput) =>
      unwrap<AuthSession>(await api.POST('/api/v1/auth/signup', { body: input })),
    onSuccess: (session) => {
      queryClient.setQueryData(ME_QUERY_KEY, session.clinician);
      /**
       * 온보딩 둘러보기를 예약하는 **유일한 지점**이다 (features/onboarding-tour).
       *
       * 「신규 회원」을 서버에 물어볼 수 없어서다 — `ClinicianResponseDto`에는 가입 시각도
       * 온보딩 완료 여부도 없다. 가입을 실제로 통과하는 이 순간이 FE가 신규를 아는 유일한
       * 시점이라, 여기가 아니면 로그인한 모든 사람에게 뜨거나 아무에게도 뜨지 않는다.
       */
      scheduleWelcomeTour();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap<null>(await api.POST('/api/v1/auth/logout')),
    onSettled: () => {
      queryClient.clear();
    },
  });
}

/**
 * 회원탈퇴 (docs/specs/36) — 개인정보를 즉시 익명화하고 모든 기기의 세션을 끊는다.
 * **철회·복구 경로는 없다**(spec 36 Out of scope).
 *
 * 남은 구성원이 있는 개설자는 409 `CLINIC_OWNER_MUST_TRANSFER`로 막히며, 그 요청은
 * 익명화를 시작하지도 않는다 — 호출부가 이양을 안내한 뒤 다시 시도할 수 있다.
 * 그래서 캐시 비우기를 `onSettled`가 아니라 `onSuccess`에 둔다: 409로 돌아온 화면은
 * 이양 대상을 고르기 위해 살아 있어야 한다.
 */
export function useWithdraw() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap<null>(await api.DELETE('/api/v1/auth/me')),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
