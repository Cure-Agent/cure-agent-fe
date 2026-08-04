'use client';

/**
 * 클리닉 구성원·초대·개설자 이양 (BE docs/specs/35·36).
 *
 * 권한이 경로마다 갈린다 — 구성원 목록은 전원, 초대 발급·목록·취소와 이양은 개설자 전용이다.
 * 개설자 여부를 알려주는 별도 API는 없고 구성원 목록의 `isOwner`가 유일한 근거이므로,
 * 개설자 전용 쿼리는 그 값이 확정된 뒤에만 켠다 — 그러지 않으면 일반 구성원이 403을 맞는다.
 */
import {
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type UseQueryResult,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/shared/api/api-client';
import { unwrap, unwrapPage } from '@/shared/api/api-error';
import type { components } from '@/shared/api/generated/schema';

export type ClinicMember = components['schemas']['ClinicMemberResponseDto'];
export type ClinicInvitation = components['schemas']['ClinicInvitationResponseDto'];
export type IssuedInvitation = components['schemas']['ClinicInvitationIssuedResponseDto'];
export type InvitationPreview = components['schemas']['ClinicInvitationPreviewResponseDto'];
export type InvitationStatus = ClinicInvitation['status'];

export interface PageInfo {
  size: number;
  hasNext: boolean;
  nextCursor: string | null;
}

type InvitationPage = { items: ClinicInvitation[]; page: PageInfo };

export const CLINIC_MEMBERS_KEY = ['clinic', 'members'] as const;
export const CLINIC_INVITATIONS_KEY = ['clinic', 'invitations'] as const;
export const invitationPreviewKey = (token: string) => ['invitations', 'preview', token] as const;

/**
 * BE Swagger가 nullable 필드에 타입을 주지 않아 생성 타입이 `Record<string, never> | null`이다
 * (`acceptedAt`·`acceptedByDisplayName`). 실제 값은 ISO 문자열과 표시 이름이므로
 * 계약이 고쳐질 때까지 소비 계층에서 런타임 값으로 좁힌다 — generated는 건드리지 않는다.
 */
export function asText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** 구성원 목록 — 전원에게 열려 있다. 개설자 판별과 이양 대상 선택이 모두 이 목록을 쓴다 */
export function useClinicMembers(): UseQueryResult<ClinicMember[]> {
  return useQuery({
    queryKey: CLINIC_MEMBERS_KEY,
    queryFn: async () => unwrap<ClinicMember[]>(await api.GET('/api/v1/clinic/members')),
    staleTime: 60_000,
  });
}

/** 초대 목록 — 개설자 전용이라 `enabled`로 게이트한다 */
export function useClinicInvitations(
  enabled: boolean,
): UseInfiniteQueryResult<InfiniteData<InvitationPage>> {
  return useInfiniteQuery({
    queryKey: CLINIC_INVITATIONS_KEY,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const query: Record<string, string> = {};
      if (pageParam) query.cursor = pageParam;
      const { items, page } = unwrapPage<ClinicInvitation>(
        await api.GET('/api/v1/clinic/invitations', { params: { query } }),
      );
      return { items, page };
    },
    getNextPageParam: (lastPage) => (lastPage.page.hasNext ? lastPage.page.nextCursor : undefined),
  });
}

/**
 * 초대 발급. **응답의 `token`이 링크를 볼 수 있는 유일한 기회다** — BE는 해시만 저장하므로
 * 목록에는 실리지 않고 재열람도 없다(spec 35). 화면이 이 값을 즉시 보여줘야 한다.
 */
export function useIssueInvitation(): UseMutationResult<IssuedInvitation, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap<IssuedInvitation>(await api.POST('/api/v1/clinic/invitations')),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLINIC_INVITATIONS_KEY });
    },
  });
}

export function useRevokeInvitation(): UseMutationResult<null, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) =>
      unwrap<null>(
        await api.DELETE('/api/v1/clinic/invitations/{invitationId}', {
          params: { path: { invitationId } },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLINIC_INVITATIONS_KEY });
    },
  });
}

/**
 * 개설자 권한 이양. 성공하면 초대 권한이 실제로 떠나므로(spec 36 기준 6·7)
 * 구성원 목록과 초대 목록 캐시가 함께 낡는다.
 */
export function useTransferOwner(): UseMutationResult<null, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (toClinicianId: string) =>
      unwrap<null>(
        await api.POST('/api/v1/clinic/owner/transfer', { body: { toClinicianId } }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLINIC_MEMBERS_KEY });
      void queryClient.invalidateQueries({ queryKey: CLINIC_INVITATIONS_KEY });
    },
  });
}

/**
 * 초대 프리뷰 — 비인증 경로다(spec 35). 아직 계정이 없는 사람이 링크를 여는 자리이므로
 * 재시도하지 않는다: 만료·사용됨·취소됨·없음이 전부 404 `INVITATION_INVALID` 하나로 온다.
 *
 * `token`이 null이면 조회하지 않는다 — 초대 없이 들어온 온보딩에서도 이 훅이 걸리므로
 * 빈 토큰으로 요청이 새어 나가면 안 된다.
 */
export function useInvitationPreview(token: string | null): UseQueryResult<InvitationPreview> {
  return useQuery({
    queryKey: invitationPreviewKey(token ?? ''),
    enabled: token !== null && token.length > 0,
    queryFn: async () =>
      unwrap<InvitationPreview>(
        await api.GET('/api/v1/invitations/{token}', {
          params: { path: { token: token ?? '' } },
        }),
      ),
    retry: false,
    staleTime: Infinity,
  });
}
