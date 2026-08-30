'use client';

import { useRouter } from 'next/navigation';
import { GuidelineListPanel } from '@/features/filter-guidelines/ui/guideline-list-panel';
import { messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';

export default function GuidelinesPage(): React.ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const router = useRouter();
  return (
    <section className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <h1 className="mb-4 shrink-0 text-2xl font-bold text-gray-900">{t.guidelinesHeading}</h1>
      <div className="min-h-0 flex-1">
        <GuidelineListPanel onSelect={(guideline) => router.push(`/guidelines/${guideline.id}`)} />
      </div>
    </section>
  );
}
