import Link from 'next/link';
import { PatientDetailPanel } from '@/features/manage-patient/ui/patient-detail-panel';

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}): Promise<React.ReactElement> {
  const { patientId } = await params;
  return (
    <section className="mx-auto max-w-3xl">
      <Link
        href="/patients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <span aria-hidden>←</span> 환자 목록
      </Link>
      <PatientDetailPanel patientId={patientId} />
    </section>
  );
}
