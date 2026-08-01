import Link from 'next/link';
import { GuidelineDetailPanel } from '@/features/filter-guidelines/ui/guideline-detail-panel';

export default async function GuidelineDetailPage({
  params,
}: {
  params: Promise<{ guidelineId: string }>;
}): Promise<React.ReactElement> {
  const { guidelineId } = await params;
  return (
    <section className="mx-auto max-w-3xl">
      <Link
        href="/guidelines"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <span aria-hidden>←</span> 지침 목록
      </Link>
      <GuidelineDetailPanel guidelineId={guidelineId} />
    </section>
  );
}
