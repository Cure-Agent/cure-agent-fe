'use client';

import { FormEvent, useEffect, useState } from 'react';
import { RequestGuidanceButton } from '@/features/request-clinical-guidance/ui/request-guidance-button';
import { ApiError } from '@/shared/api/api-error';
import {
  useArchivePatient,
  usePatient,
  useUnarchivePatient,
  useUpdatePatient,
} from '../api/patient.api';

export interface PatientDetailPanelProps {
  patientId: string;
}

const FIELD =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none';

export function PatientDetailPanel({ patientId }: PatientDetailPanelProps): React.ReactElement {
  const patient = usePatient(patientId);
  const updatePatient = useUpdatePatient(patientId);
  const archivePatient = useArchivePatient(patientId);
  const unarchivePatient = useUnarchivePatient(patientId);

  const [weightKg, setWeightKg] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 로드된 상세로 폼 초기화 (version은 detail에서 직접 사용 — §6 낙관적 잠금)
  useEffect(() => {
    if (patient.data) {
      setWeightKg(patient.data.weightKg !== undefined ? String(patient.data.weightKg) : '');
      setClinicalNotes(patient.data.clinicalNotes ?? '');
    }
  }, [patient.data]);

  if (patient.isPending) return <p className="text-sm text-gray-400">불러오는 중…</p>;
  if (patient.isError || !patient.data) {
    return <p className="text-sm text-red-500">환자 정보를 불러오지 못했습니다</p>;
  }

  const detail = patient.data;
  const isArchived = detail.status === 'ARCHIVED';

  const handleSave = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      await updatePatient.mutateAsync({
        version: detail.version,
        ...(weightKg ? { weightKg: Number(weightKg) } : {}),
        clinicalNotes,
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PATIENT_VERSION_CONFLICT') {
        setErrorMessage(error.message); // 서버 message 그대로 (§10.1)
        void patient.refetch();
      } else {
        setErrorMessage(error instanceof Error ? error.message : '저장에 실패했습니다.');
      }
    }
  };

  const handleToggleArchive = async (): Promise<void> => {
    setErrorMessage(null);
    try {
      if (isArchived) await unarchivePatient.mutateAsync();
      else await archivePatient.mutateAsync();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '요청에 실패했습니다.');
    }
  };

  return (
    <section>
      <header className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{detail.caseLabel}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {detail.age !== undefined && `${detail.age}세`}
            {detail.sex && ` · ${detail.sex}`}
            {detail.bmi !== undefined && ` · BMI ${detail.bmi}`}
            {` · v${detail.version}`}
            {isArchived && ' · 보관됨'}
          </p>
        </div>
        <div className="flex items-start gap-2">
          {!isArchived && <RequestGuidanceButton patientId={patientId} />}
          <button
            type="button"
            onClick={handleToggleArchive}
            disabled={archivePatient.isPending || unarchivePatient.isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            {isArchived ? '보관 해제' : '보관'}
          </button>
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-gray-500">진단</dt>
          <dd className="text-gray-900">{detail.diagnoses.join(', ') || '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">복용약</dt>
          <dd className="text-gray-900">{detail.medications.join(', ') || '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">알레르기</dt>
          <dd className="text-gray-900">{detail.allergies.join(', ') || '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">신장</dt>
          <dd className="text-gray-900">{detail.heightCm ? `${detail.heightCm}cm` : '—'}</dd>
        </div>
      </dl>

      <form onSubmit={handleSave} className="mt-6 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-900">프로필 수정</h2>
        <div className="flex flex-col gap-1">
          <label htmlFor="pd-weight" className="text-sm font-medium text-gray-700">
            체중(kg)
          </label>
          <input
            id="pd-weight"
            type="number"
            step="0.1"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pd-notes" className="text-sm font-medium text-gray-700">
            임상 메모
          </label>
          <textarea
            id="pd-notes"
            rows={3}
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            className={FIELD}
          />
        </div>
        {errorMessage && (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage}
          </p>
        )}
        <button
          type="submit"
          // happy-dom은 submit 버튼 클릭의 implicit form submission이 이 구조에서 미발화 —
          // onClick 경유 단일 발화로 환경 비의존화 (preventDefault로 native submit 중복 차단)
          onClick={(event) => {
            event.preventDefault();
            void handleSave(event);
          }}
          disabled={updatePatient.isPending || isArchived}
          className="rounded-lg bg-emerald-700 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          저장
        </button>
      </form>
    </section>
  );
}
