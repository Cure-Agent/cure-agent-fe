'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PatientCreateForm } from '@/features/manage-patient/ui/patient-create-form';
import { PatientListPanel } from '@/features/manage-patient/ui/patient-list-panel';

export default function PatientsPage(): React.ReactElement {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">환자</h1>
        <button
          type="button"
          onClick={() => setShowCreate((prev) => !prev)}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          {showCreate ? '목록으로' : '새 환자 등록'}
        </button>
      </div>

      {showCreate ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <PatientCreateForm
            onCreated={(patient) => router.push(`/patients/${patient.id}`)}
          />
        </div>
      ) : (
        <PatientListPanel onSelect={(patient) => router.push(`/patients/${patient.id}`)} />
      )}
    </section>
  );
}
