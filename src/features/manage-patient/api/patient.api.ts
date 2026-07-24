'use client';

/** 환자 관리 훅 (docs/specs/09 기준 10~13) — 구현은 Phase 3 */
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
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

export function usePatients(_params: {
  query?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  cursor?: string;
}): UseQueryResult<{ items: PatientSummary[]; page: PageInfo }> {
  throw new Error('NOT_IMPLEMENTED');
}

export function usePatient(_patientId: string): UseQueryResult<PatientDetail> {
  throw new Error('NOT_IMPLEMENTED');
}

export function useCreatePatient(): UseMutationResult<PatientDetail, Error, CreatePatientInput> {
  throw new Error('NOT_IMPLEMENTED');
}

export function useUpdatePatient(
  _patientId: string,
): UseMutationResult<PatientDetail, Error, UpdatePatientInput> {
  throw new Error('NOT_IMPLEMENTED');
}

export function useArchivePatient(_patientId: string): UseMutationResult<null, Error, void> {
  throw new Error('NOT_IMPLEMENTED');
}

export function useUnarchivePatient(_patientId: string): UseMutationResult<null, Error, void> {
  throw new Error('NOT_IMPLEMENTED');
}
