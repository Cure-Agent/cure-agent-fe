'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/api-client';
import { unwrap } from '@/shared/api/api-error';
import type { components } from '@/shared/api/generated/schema';

export type Clinician = components['schemas']['ClinicianResponseDto'];
export type AuthSession = components['schemas']['AuthSessionResponseDto'];

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  clinicName: string;
  licenseNumber: string;
  termsAccepted: boolean;
}

export const ME_QUERY_KEY = ['auth', 'me'] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => unwrap<Clinician>(await api.GET('/api/v1/auth/me')),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) =>
      unwrap<AuthSession>(await api.POST('/api/v1/auth/login', { body: input })),
    onSuccess: (session) => {
      queryClient.setQueryData(ME_QUERY_KEY, session.clinician);
    },
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SignUpInput) =>
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
