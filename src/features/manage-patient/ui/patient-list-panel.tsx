'use client';

import { FormEvent, useState } from 'react';
import { type PatientSummary, usePatients } from '../api/patient.api';

export interface PatientListPanelProps {
  onSelect: (patient: PatientSummary) => void;
}

export function PatientListPanel({ onSelect }: PatientListPanelProps): React.ReactElement {
  const [input, setInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState<string | undefined>(undefined);
  const patients = usePatients({ query: submittedQuery });

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    setSubmittedQuery(input.trim() || undefined);
  };

  return (
    <div className="flex h-full flex-col">
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          aria-label="환자 검색"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="케이스 라벨 검색 (예: CASE-001)"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          검색
        </button>
      </form>

      {patients.isPending && <p className="text-sm text-gray-400">불러오는 중…</p>}
      {patients.isError && <p className="text-sm text-red-500">목록을 불러오지 못했습니다</p>}

      <ul className="flex-1 space-y-2 overflow-y-auto">
        {(patients.data?.items ?? []).map((patient) => (
          <li key={patient.id}>
            <button
              type="button"
              aria-label={patient.caseLabel}
              onClick={() => onSelect(patient)}
              className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-emerald-300"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900">{patient.caseLabel}</p>
                {patient.status === 'ARCHIVED' && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    보관됨
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {patient.age !== undefined && `${patient.age}세`}
                {patient.sex && ` · ${patient.sex}`}
                {patient.bmi !== undefined && ` · BMI ${patient.bmi}`}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
