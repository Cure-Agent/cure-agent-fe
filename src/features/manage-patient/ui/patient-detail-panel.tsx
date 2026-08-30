'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { RequestGuidanceButton } from '@/features/request-clinical-guidance/ui/request-guidance-button';
import { ApiError } from '@/shared/api/api-error';
import {
  type UpdatePatientInput,
  useArchivePatient,
  useDeletePatient,
  usePatient,
  useUnarchivePatient,
  useUpdatePatient,
} from '../api/patient.api';
import { formatList, parseList } from '../lib/clinical-list';
import { formatMessage, messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';

export interface PatientDetailPanelProps {
  patientId: string;
}

// 보관 상태에서는 이 칸들이 유일한 열람 경로라, 비활성 글자색을 읽을 수 있는 명도로 둔다
const FIELD =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none disabled:bg-gray-100 disabled:text-gray-600';

const EMPTY_FORM = {
  heightCm: '',
  weightKg: '',
  diagnoses: '',
  medications: '',
  allergies: '',
  clinicalNotes: '',
};

export function PatientDetailPanel({ patientId }: PatientDetailPanelProps): React.ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const router = useRouter();
  const patient = usePatient(patientId);
  const updatePatient = useUpdatePatient(patientId);
  const archivePatient = useArchivePatient(patientId);
  const unarchivePatient = useUnarchivePatient(patientId);
  const deletePatient = useDeletePatient(patientId);

  const [form, setForm] = useState(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 서버에 restore가 없다(spec 34) — 되돌리기가 아니라 사전 확인으로 막는다
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  const set = (key: keyof typeof form, value: string): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // 로드된 상세로 폼 초기화 (version은 detail에서 직접 사용 — §6 낙관적 잠금)
  useEffect(() => {
    if (patient.data) {
      setForm({
        heightCm: patient.data.heightCm !== undefined ? String(patient.data.heightCm) : '',
        weightKg: patient.data.weightKg !== undefined ? String(patient.data.weightKg) : '',
        diagnoses: formatList(patient.data.diagnoses),
        medications: formatList(patient.data.medications),
        allergies: formatList(patient.data.allergies),
        clinicalNotes: patient.data.clinicalNotes ?? '',
      });
    }
  }, [patient.data]);

  // 삭제 뒤 상세 조회는 404다 — 이동이 끝나기 전에 실패 화면을 그리지 않는다
  if (isDeleted) return <p className="text-sm text-gray-400">{t.patientDeleted}</p>;
  if (patient.isPending) return <p className="text-sm text-gray-400">{t.loading}</p>;
  if (patient.isError || !patient.data) {
    return <p className="text-sm text-red-500">{t.patientLoadFailed}</p>;
  }

  const detail = patient.data;
  const isArchived = detail.status === 'ARCHIVED';

  const handleSave = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    const body: UpdatePatientInput = {
      version: detail.version,
      ...(form.heightCm ? { heightCm: Number(form.heightCm) } : {}),
      ...(form.weightKg ? { weightKg: Number(form.weightKg) } : {}),
      diagnoses: parseList(form.diagnoses),
      medications: parseList(form.medications),
      allergies: parseList(form.allergies),
      clinicalNotes: form.clinicalNotes,
    };

    try {
      await updatePatient.mutateAsync(body);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PATIENT_VERSION_CONFLICT') {
        setErrorMessage(error.message); // 서버 message 그대로 (§10.1)
        void patient.refetch();
      } else {
        setErrorMessage(error instanceof Error ? error.message : t.saveFailed);
      }
    }
  };

  const handleDelete = (): void => {
    deletePatient.mutate(undefined, {
      onSuccess: () => {
        setIsDeleted(true);
        // 지워진 상세로 뒤로가기가 되면 안 되므로 replace다
        router.replace('/patients');
      },
    });
  };

  const handleToggleArchive = async (): Promise<void> => {
    setErrorMessage(null);
    try {
      if (isArchived) await unarchivePatient.mutateAsync();
      else await archivePatient.mutateAsync();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t.requestFailed);
    }
  };

  return (
    <section>
      <header className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{detail.caseLabel}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {detail.age !== undefined && formatMessage(t.ageYears, { age: detail.age })}
            {detail.sex && ` · ${detail.sex}`}
            {detail.bmi !== undefined && ` · BMI ${detail.bmi}`}
            {` · v${detail.version}`}
            {isArchived && t.archivedSeparator}
          </p>
        </div>
        <div className="flex items-start gap-2">
          {!isArchived && (
            <RequestGuidanceButton patientId={patientId} caseLabel={detail.caseLabel} />
          )}
          <button
            type="button"
            onClick={handleToggleArchive}
            disabled={archivePatient.isPending || unarchivePatient.isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            {isArchived ? t.unarchive : t.archive}
          </button>
          {/* 확인 배너의 '삭제'와 접근성 이름이 겹치지 않게 진입점은 '환자 삭제'다 */}
          <button
            type="button"
            onClick={() => setIsConfirmingDelete(true)}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            {t.deletePatient}
          </button>
        </div>
      </header>

      {isConfirmingDelete && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50/60 p-4">
          <p className="font-medium text-gray-900">
                      {formatMessage(t.deleteWithLabel, { label: detail.caseLabel })}
                    </p>
          <p className="mt-1 text-sm text-red-700">
            {t.deletePatientWarning}
          </p>
          {deletePatient.isError && (
            <p role="alert" className="mt-1 text-sm text-red-600">
              {t.deleteFailed}
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(false)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletePatient.isPending}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {t.delete}
            </button>
          </div>
        </div>
      )}

      {/* 프로필 값은 이 폼이 유일한 표시 경로다 — 보관 상태에서는 비활성 칸으로 열람만 된다 */}
      <form onSubmit={handleSave} className="mt-6 grid grid-cols-2 gap-3">
        <h2 className="col-span-2 text-sm font-semibold text-gray-900">{t.editProfile}</h2>
        <div className="flex flex-col gap-1">
          <label htmlFor="pd-height" className="text-sm font-medium text-gray-700">
            {t.heightCm}
          </label>
          <input
            id="pd-height"
            type="number"
            step="0.1"
            value={form.heightCm}
            onChange={(e) => set('heightCm', e.target.value)}
            disabled={isArchived}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pd-weight" className="text-sm font-medium text-gray-700">
            {t.weightKg}
          </label>
          <input
            id="pd-weight"
            type="number"
            step="0.1"
            value={form.weightKg}
            onChange={(e) => set('weightKg', e.target.value)}
            disabled={isArchived}
            className={FIELD}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <label htmlFor="pd-diagnoses" className="text-sm font-medium text-gray-700">
            {t.diagnosesCommaSeparated}
          </label>
          <input
            id="pd-diagnoses"
            value={form.diagnoses}
            onChange={(e) => set('diagnoses', e.target.value)}
            placeholder={t.diagnosesPlaceholder}
            disabled={isArchived}
            className={FIELD}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <label htmlFor="pd-medications" className="text-sm font-medium text-gray-700">
            {t.medicationsCommaSeparated}
          </label>
          <input
            id="pd-medications"
            value={form.medications}
            onChange={(e) => set('medications', e.target.value)}
            disabled={isArchived}
            className={FIELD}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <label htmlFor="pd-allergies" className="text-sm font-medium text-gray-700">
            {t.allergiesCommaSeparated}
          </label>
          <input
            id="pd-allergies"
            value={form.allergies}
            onChange={(e) => set('allergies', e.target.value)}
            disabled={isArchived}
            className={FIELD}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <label htmlFor="pd-notes" className="text-sm font-medium text-gray-700">
            {t.clinicalNote}
          </label>
          <textarea
            id="pd-notes"
            rows={3}
            value={form.clinicalNotes}
            onChange={(e) => set('clinicalNotes', e.target.value)}
            disabled={isArchived}
            className={FIELD}
          />
        </div>
        {errorMessage && (
          <p role="alert" className="col-span-2 text-sm text-red-600">
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
          className="col-span-2 rounded-lg bg-emerald-700 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {t.save}
        </button>
      </form>
    </section>
  );
}
