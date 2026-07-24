'use client';

import { FormEvent, useState } from 'react';
import {
  type CreatePatientInput,
  type PatientDetail,
  useCreatePatient,
} from '../api/patient.api';

export interface PatientCreateFormProps {
  onCreated: (patient: PatientDetail) => void;
}

const FIELD =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none';

/** 쉼표 구분 문자열 → trim된 배열 (빈 입력은 빈 배열) */
function parseList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function PatientCreateForm({ onCreated }: PatientCreateFormProps): React.ReactElement {
  const createPatient = useCreatePatient();
  const [form, setForm] = useState({
    caseLabel: '',
    birthYear: '',
    sex: '',
    heightCm: '',
    weightKg: '',
    diagnoses: '',
    medications: '',
    allergies: '',
    clinicalNotes: '',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const set = (key: keyof typeof form, value: string): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);

    const body: CreatePatientInput = {
      caseLabel: form.caseLabel.trim(),
      ...(form.birthYear ? { birthYear: Number(form.birthYear) } : {}),
      ...(form.sex ? { sex: form.sex as CreatePatientInput['sex'] } : {}),
      ...(form.heightCm ? { heightCm: Number(form.heightCm) } : {}),
      ...(form.weightKg ? { weightKg: Number(form.weightKg) } : {}),
      diagnoses: parseList(form.diagnoses),
      medications: parseList(form.medications),
      allergies: parseList(form.allergies),
      ...(form.clinicalNotes.trim() ? { clinicalNotes: form.clinicalNotes.trim() } : {}),
    };

    try {
      const created = await createPatient.mutateAsync(body);
      onCreated(created);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '등록에 실패했습니다.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
      <div className="col-span-2 flex flex-col gap-1">
        <label htmlFor="p-case" className="text-sm font-medium text-gray-700">
          케이스 라벨
        </label>
        <input
          id="p-case"
          value={form.caseLabel}
          onChange={(e) => set('caseLabel', e.target.value)}
          required
          placeholder="CASE-001 (비식별 라벨)"
          className={FIELD}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="p-birth" className="text-sm font-medium text-gray-700">
          출생연도
        </label>
        <input
          id="p-birth"
          type="number"
          value={form.birthYear}
          onChange={(e) => set('birthYear', e.target.value)}
          className={FIELD}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="p-sex" className="text-sm font-medium text-gray-700">
          성별
        </label>
        <select
          id="p-sex"
          value={form.sex}
          onChange={(e) => set('sex', e.target.value)}
          className={FIELD}
        >
          <option value="">선택 안 함</option>
          <option value="MALE">남</option>
          <option value="FEMALE">여</option>
          <option value="OTHER">기타</option>
          <option value="UNKNOWN">미상</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="p-height" className="text-sm font-medium text-gray-700">
          신장(cm)
        </label>
        <input
          id="p-height"
          type="number"
          step="0.1"
          value={form.heightCm}
          onChange={(e) => set('heightCm', e.target.value)}
          className={FIELD}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="p-weight" className="text-sm font-medium text-gray-700">
          체중(kg)
        </label>
        <input
          id="p-weight"
          type="number"
          step="0.1"
          value={form.weightKg}
          onChange={(e) => set('weightKg', e.target.value)}
          className={FIELD}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1">
        <label htmlFor="p-diagnoses" className="text-sm font-medium text-gray-700">
          진단(쉼표 구분)
        </label>
        <input
          id="p-diagnoses"
          value={form.diagnoses}
          onChange={(e) => set('diagnoses', e.target.value)}
          placeholder="만성 요통, 고혈압"
          className={FIELD}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1">
        <label htmlFor="p-medications" className="text-sm font-medium text-gray-700">
          복용약(쉼표 구분)
        </label>
        <input
          id="p-medications"
          value={form.medications}
          onChange={(e) => set('medications', e.target.value)}
          className={FIELD}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1">
        <label htmlFor="p-allergies" className="text-sm font-medium text-gray-700">
          알레르기(쉼표 구분)
        </label>
        <input
          id="p-allergies"
          value={form.allergies}
          onChange={(e) => set('allergies', e.target.value)}
          className={FIELD}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1">
        <label htmlFor="p-notes" className="text-sm font-medium text-gray-700">
          임상 메모
        </label>
        <textarea
          id="p-notes"
          rows={3}
          value={form.clinicalNotes}
          onChange={(e) => set('clinicalNotes', e.target.value)}
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
        disabled={createPatient.isPending}
        className="col-span-2 rounded-lg bg-emerald-700 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        등록
      </button>
    </form>
  );
}
