'use client';

import { FormEvent, useState } from 'react';
import {
  type CreatePatientInput,
  type PatientDetail,
  useCreatePatient,
} from '../api/patient.api';
import { parseList } from '../lib/clinical-list';
import { formatMessage, messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';

export interface PatientCreateFormProps {
  onCreated: (patient: PatientDetail) => void;
}

const FIELD =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none';

export function PatientCreateForm({ onCreated }: PatientCreateFormProps): React.ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
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
      setErrorMessage(error instanceof Error ? error.message : t.registerFailed);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
      <div className="col-span-2 flex flex-col gap-1">
        <label htmlFor="p-case" className="text-sm font-medium text-gray-700">
          {t.caseLabel}
        </label>
        <input
          id="p-case"
          value={form.caseLabel}
          onChange={(e) => set('caseLabel', e.target.value)}
          required
          placeholder={t.caseLabelPlaceholder}
          className={FIELD}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="p-birth" className="text-sm font-medium text-gray-700">
          {t.birthYear}
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
          {t.sex}
        </label>
        <select
          id="p-sex"
          value={form.sex}
          onChange={(e) => set('sex', e.target.value)}
          className={FIELD}
        >
          <option value="">{t.sexUnset}</option>
          <option value="MALE">{t.sexMale}</option>
          <option value="FEMALE">{t.sexFemale}</option>
          <option value="OTHER">{t.sexOther}</option>
          <option value="UNKNOWN">{t.sexUnknown}</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="p-height" className="text-sm font-medium text-gray-700">
          {t.heightCm}
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
          {t.weightKg}
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
          {t.diagnosesCommaSeparated}
        </label>
        <input
          id="p-diagnoses"
          value={form.diagnoses}
          onChange={(e) => set('diagnoses', e.target.value)}
          placeholder={t.diagnosesPlaceholder}
          className={FIELD}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1">
        <label htmlFor="p-medications" className="text-sm font-medium text-gray-700">
          {t.medicationsCommaSeparated}
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
          {t.allergiesCommaSeparated}
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
          {t.clinicalNote}
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
        {t.register}
      </button>
    </form>
  );
}
