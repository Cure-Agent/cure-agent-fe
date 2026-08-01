import Link from 'next/link';
import { PatientDetailPanel } from '@/features/manage-patient/ui/patient-detail-panel';

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}): Promise<React.ReactElement> {
  const { patientId } = await params;
  return (
    <section className="mx-auto -mt-8 max-w-3xl">
      {/* 세로는 사이드바 헤더 아이콘 기준선(h-18 중앙), 가로는 콘텐츠 컬럼 왼쪽 정렬.
          -ml-2가 호버 패딩(p-2)을 상쇄해 텍스트가 컬럼 왼쪽 끝에 맞는다 */}
      <div className="flex h-18 items-center">
        <Link
          href="/patients"
          className="-ml-2 inline-flex items-center gap-1 rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <span aria-hidden>←</span> 환자 목록
        </Link>
      </div>
      <PatientDetailPanel patientId={patientId} />
    </section>
  );
}
