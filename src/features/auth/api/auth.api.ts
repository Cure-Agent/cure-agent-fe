'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/api-client';
import { unwrap } from '@/shared/api/api-error';
import { buildUrl } from '@/shared/api/http';
import type { components } from '@/shared/api/generated/schema';

export type Clinician = components['schemas']['ClinicianResponseDto'];
export type AuthSession = components['schemas']['AuthSessionResponseDto'];
export type OAuthProvider = components['schemas']['OAuthProvidersResponseDto']['providers'][number];

/** 티켓과 함께 보내는 온보딩 입력 — 이메일·소셜 신원은 서버가 티켓에서 꺼낸다 (docs/specs/17) */
export interface CompleteSignUpInput {
  ticket: string;
  displayName: string;
  clinicName: string;
  licenseNumber: string;
  termsAccepted: boolean;
}

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
