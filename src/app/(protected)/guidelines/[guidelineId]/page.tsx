import { GuidelineDetailPanel } from '@/features/filter-guidelines/ui/guideline-detail-panel';

export default async function GuidelineDetailPage({
  params,
}: {
  params: Promise<{ guidelineId: string }>;
}): Promise<React.ReactElement> {
  const { guidelineId } = await params;
  return (
    <section className="mx-auto max-w-3xl">
      <GuidelineDetailPanel guidelineId={guidelineId} />
    </section>
  );
}
