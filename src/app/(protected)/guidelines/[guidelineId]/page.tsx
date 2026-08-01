import Link from 'next/link';
import { GuidelineDetailPanel } from '@/features/filter-guidelines/ui/guideline-detail-panel';

export default async function GuidelineDetailPage({
  params,
}: {
  params: Promise<{ guidelineId: string }>;
}): Promise<React.ReactElement> {
  const { guidelineId } = await params;
  return (
    <section className="mx-auto -mt-8 max-w-3xl">
      {/* 세로는 사이드바 헤더 아이콘 기준선(h-18 중앙), 가로는 콘텐츠 컬럼 왼쪽 정렬.
          -ml-2가 호버 패딩(p-2)을 상쇄해 텍스트가 컬럼 왼쪽 끝에 맞는다 */}
      <div className="flex h-18 items-center">
        <Link
          href="/guidelines"
          className="-ml-2 inline-flex items-center gap-1 rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <span aria-hidden>←</span> 지침 목록
        </Link>
      </div>
      <GuidelineDetailPanel guidelineId={guidelineId} />
    </section>
  );
}
