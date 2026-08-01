import Link from 'next/link';
import { PatientDetailPanel } from '@/features/manage-patient/ui/patient-detail-panel';

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}): Promise<React.ReactElement> {
  const { patientId } = await params;
  return (
    // -mt-8로 2rem 끌어올린 만큼 높이를 보태야(100%+2rem) 아래 여백이 main 패딩과 같아진다
    <section className="mx-auto -mt-8 flex h-[calc(100%+2rem)] w-full max-w-3xl flex-col">
      {/* 세로는 사이드바 헤더 아이콘 기준선(h-18 중앙), 가로는 콘텐츠 컬럼 왼쪽 정렬.
          -ml-2가 호버 패딩(p-2)을 상쇄해 텍스트가 컬럼 왼쪽 끝에 맞는다 */}
      <div className="flex h-18 shrink-0 items-center">
        <Link
          href="/patients"
          className="-ml-2 inline-flex items-center gap-1 rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <span aria-hidden>←</span> 환자 목록
        </Link>
      </div>
      <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto">
        <PatientDetailPanel patientId={patientId} />
      </div>
    </section>
  );
}
