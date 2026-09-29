import Link from 'next/link';
import { GuidelineDetailPanel } from '@/features/filter-guidelines/ui/guideline-detail-panel';
import { Message } from '@/shared/i18n/message';

export default async function GuidelineDetailPage({
  params,
}: {
  params: Promise<{ guidelineId: string }>;
}): Promise<React.ReactElement> {
  const { guidelineId } = await params;
  return (
    // main 위쪽 패딩만큼 끌어올린 만큼 높이를 보태야(100%+패딩) 아래 여백이 main 패딩과 같아진다.
    // 패딩은 AppShell main을 따른다 — 좁은 화면 1rem, 넓은 화면 2rem
    <section className="mx-auto -mt-4 flex h-[calc(100%+1rem)] w-full max-w-3xl flex-col lg:-mt-8 lg:h-[calc(100%+2rem)]">
      {/* 세로는 사이드바 헤더 아이콘 기준선(h-18 중앙), 가로는 콘텐츠 컬럼 왼쪽 정렬.
          -ml-2가 호버 패딩(p-2)을 상쇄해 텍스트가 컬럼 왼쪽 끝에 맞는다.
          좁은 화면에는 맞출 사이드바가 없다 — 낮은 줄(h-12)로 세로를 아낀다 */}
      <div className="flex h-12 shrink-0 items-center lg:h-18">
        <Link
          href="/guidelines"
          className="-ml-2 inline-flex items-center gap-1 rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <span aria-hidden>←</span> <Message k="guidelineListBack" />
        </Link>
      </div>
      {/* 스크롤 컨테이너는 패널이 소유한다 — 권고문 무한 스크롤 sentinel이 그 안에 붙는다 */}
      <div className="min-h-0 flex-1">
        <GuidelineDetailPanel guidelineId={guidelineId} />
      </div>
    </section>
  );
}
