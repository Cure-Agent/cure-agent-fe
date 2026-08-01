'use client';

import { useRouter } from 'next/navigation';
import { GuidelineListPanel } from '@/features/filter-guidelines/ui/guideline-list-panel';

export default function GuidelinesPage(): React.ReactElement {
  const router = useRouter();
  return (
    <section className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <h1 className="mb-4 shrink-0 text-2xl font-bold text-gray-900">지침 탐색</h1>
      <div className="min-h-0 flex-1">
        <GuidelineListPanel onSelect={(guideline) => router.push(`/guidelines/${guideline.id}`)} />
      </div>
    </section>
  );
}
