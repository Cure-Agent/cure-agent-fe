import Link from 'next/link';
import { PatientDetailPanel } from '@/features/manage-patient/ui/patient-detail-panel';

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}): Promise<React.ReactElement> {
  const { patientId } = await params;
  return (
    <section className="-mt-8">
      {/* h-18 + 좌측 18px: 사이드바 헤더 아이콘(열림·접힘 레일 공통 기준선)과 위치를 맞춘다 */}
      <div className="-mx-8 flex h-18 items-center px-2.5">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1 rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <span aria-hidden>←</span> 환자 목록
        </Link>
      </div>
      <div className="mx-auto max-w-3xl">
        <PatientDetailPanel patientId={patientId} />
      </div>
    </section>
  );
}
