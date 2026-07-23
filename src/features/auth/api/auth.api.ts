/** 로그인/세션 API 훅 (docs/specs/07) — 구현은 Phase 3 */
export interface LoginInput {
  email: string;
  password: string;
}

export function useLogin(): {
  mutateAsync: (input: LoginInput) => Promise<unknown>;
  isPending: boolean;
  error: Error | null;
} {
  throw new Error('NOT_IMPLEMENTED');
}
