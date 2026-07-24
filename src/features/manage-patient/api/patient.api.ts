'use client';

/** 환자 관리 훅 (docs/specs/09 기준 10~13) */
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
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

export function usePatients(params: {
  query?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  cursor?: string;
}): UseQueryResult<{ items: PatientSummary[]; page: PageInfo }> {
  return useQuery({
    queryKey: [...PATIENTS_KEY, { ...params }],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (params.query) query.query = params.query;
      if (params.status) query.status = params.status;
      if (params.cursor) query.cursor = params.cursor;
      const result = await api.GET('/api/v1/patients', { params: { query } });
      const { items, page } = unwrapPage<PatientSummary>(result);
      return { items, page };
    },
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

export function useArchivePatient(patientId: string): UseMutationResult<null, Error, void> {
  return useStatusMutation(patientId, '/api/v1/patients/{patientId}/archive');
}

export function useUnarchivePatient(patientId: string): UseMutationResult<null, Error, void> {
  return useStatusMutation(patientId, '/api/v1/patients/{patientId}/unarchive');
}
