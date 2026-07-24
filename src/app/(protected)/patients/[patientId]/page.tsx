import { PatientDetailPanel } from '@/features/manage-patient/ui/patient-detail-panel';

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}): Promise<React.ReactElement> {
  const { patientId } = await params;
  return (
    <section className="mx-auto max-w-3xl">
      <PatientDetailPanel patientId={patientId} />
    </section>
  );
}
