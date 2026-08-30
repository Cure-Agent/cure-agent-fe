'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PatientCreateForm } from '@/features/manage-patient/ui/patient-create-form';
import { PatientListPanel } from '@/features/manage-patient/ui/patient-list-panel';
import { messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';

export default function PatientsPage(): React.ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <section className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t.patientsHeading}</h1>
        <button
          type="button"
          onClick={() => setShowCreate((prev) => !prev)}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          {showCreate ? t.backToList : t.newPatient}
        </button>
      </div>

      {showCreate ? (
        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <PatientCreateForm
              onCreated={(patient) => router.push(`/patients/${patient.id}`)}
            />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <PatientListPanel onSelect={(patient) => router.push(`/patients/${patient.id}`)} />
        </div>
      )}
    </section>
  );
}
