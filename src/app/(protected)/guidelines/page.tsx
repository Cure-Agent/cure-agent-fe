'use client';

import { useRouter } from 'next/navigation';
import { GuidelineListPanel } from '@/features/filter-guidelines/ui/guideline-list-panel';

export default function GuidelinesPage(): React.ReactElement {
  const router = useRouter();
  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">지침 탐색</h1>
      <GuidelineListPanel onSelect={(guideline) => router.push(`/guidelines/${guideline.id}`)} />
    </section>
  );
}
