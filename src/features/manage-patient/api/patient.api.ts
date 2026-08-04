'use client';

/** 환자 관리 훅 (docs/specs/09 기준 10~13) */
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
// 환자 삭제가 그 환자의 대화까지 끄므로(spec 34) 대화 목록 키를 여기서도 무효화한다
import { CONVERSATIONS_KEY } from '@/features/manage-conversation/api/conversation.api';
import { api } from '@/shared/api/api-client';
import { unwrap, unwrapPage } from '@/shared/api/api-error';
import type { components } from '@/shared/api/generated/schema';

export type PatientSummary = components['schemas']['PatientSummaryResponseDto'];
export type PatientDetail = components['schemas']['PatientDetailResponseDto'];
export type CreatePatientInput = components['schemas']['CreatePatientRequestDto'];
export type UpdatePatientInput = components['schemas']['UpdatePatientRequestDto'];

export interface PageInfo {
  size: number;
  hasNext: boolean;
  nextCursor: string | null;
}

export const PATIENTS_KEY = ['patients'] as const;
export const patientKey = (patientId: string) => ['patients', patientId] as const;

type PatientPage = { items: PatientSummary[]; page: PageInfo };

/** 커서 페이지 누적 — 목록 패널의 더보기 버튼이 fetchNextPage를 호출한다 */
export function usePatients(params: {
  query?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
}): UseInfiniteQueryResult<InfiniteData<PatientPage>> {
  return useInfiniteQuery({
    queryKey: [...PATIENTS_KEY, { query: params.query ?? null, status: params.status ?? null }],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const query: Record<string, string> = {};
      if (params.query) query.query = params.query;
      if (params.status) query.status = params.status;
      if (pageParam) query.cursor = pageParam;
      const result = await api.GET('/api/v1/patients', { params: { query } });
      const { items, page } = unwrapPage<PatientSummary>(result);
      return { items, page };
    },
    getNextPageParam: (lastPage) => (lastPage.page.hasNext ? lastPage.page.nextCursor : undefined),
  });
}

export function usePatient(patientId: string): UseQueryResult<PatientDetail> {
  return useQuery({
    queryKey: patientKey(patientId),
    queryFn: async () =>
      unwrap<PatientDetail>(
        await api.GET('/api/v1/patients/{patientId}', { params: { path: { patientId } } }),
      ),
  });
}

export function useCreatePatient(): UseMutationResult<PatientDetail, Error, CreatePatientInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePatientInput) =>
      unwrap<PatientDetail>(await api.POST('/api/v1/patients', { body: input })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PATIENTS_KEY });
    },
  });
}

export function useUpdatePatient(
  patientId: string,
): UseMutationResult<PatientDetail, Error, UpdatePatientInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePatientInput) =>
      unwrap<PatientDetail>(
        await api.PATCH('/api/v1/patients/{patientId}', {
          params: { path: { patientId } },
          body: input,
        }),
      ),
    onSuccess: (detail) => {
      queryClient.setQueryData(patientKey(patientId), detail);
      void queryClient.invalidateQueries({ queryKey: PATIENTS_KEY });
    },
  });
}

function useStatusMutation(
  patientId: string,
  path: '/api/v1/patients/{patientId}/archive' | '/api/v1/patients/{patientId}/unarchive',
): UseMutationResult<null, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap<null>(await api.POST(path, { params: { path: { patientId } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientKey(patientId) });
      void queryClient.invalidateQueries({ queryKey: PATIENTS_KEY });
    },
  });
}

/**
 * 환자 삭제 (BE spec 34). 서버가 같은 트랜잭션에서 그 환자의 대화까지 함께 끄므로
 * 대화 목록 캐시도 낡는다. restore가 없어 되돌리기 경로는 두지 않는다.
 */
export function useDeletePatient(patientId: string): UseMutationResult<null, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap<null>(
        await api.DELETE('/api/v1/patients/{patientId}', { params: { path: { patientId } } }),
      ),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: patientKey(patientId) });
      void queryClient.invalidateQueries({ queryKey: PATIENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

export function useArchivePatient(patientId: string): UseMutationResult<null, Error, void> {
  return useStatusMutation(patientId, '/api/v1/patients/{patientId}/archive');
}

export function useUnarchivePatient(patientId: string): UseMutationResult<null, Error, void> {
  return useStatusMutation(patientId, '/api/v1/patients/{patientId}/unarchive');
}
