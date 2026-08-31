'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useInfiniteListScroll } from '@/shared/lib/use-infinite-list-scroll';
import { type GuidelineSummary, useGuidelines } from '../api/guideline.api';
import { formatMessage, messagesFor } from '@/shared/i18n/messages';
import { type UiLang, useUiLang } from '@/shared/i18n/ui-lang';

export interface GuidelineListPanelProps {
  onSelect: (guideline: GuidelineSummary) => void;
}

/** 번역이 없는 지침은 키가 아예 빠진다 — 오류가 아니라 범위이므로 원문으로 닫는다 (§44) */
function displayTitle(guideline: GuidelineSummary, lang: UiLang): string {
  return lang === 'en' && guideline.titleTranslated ? guideline.titleTranslated : guideline.title;
}

export function GuidelineListPanel({ onSelect }: GuidelineListPanelProps): React.ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const [input, setInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState<string | undefined>(undefined);
  // 지침 탐색기에는 대화 맥락이 없다 — 목록 제목의 언어는 UI 토글이 정한다 (§44 기준 30)
  const guidelines = useGuidelines({ query: submittedQuery, lang });

  const items = useMemo(
    () => (guidelines.data?.pages ?? []).flatMap((page) => page.items),
    [guidelines.data],
  );
  const listScroll = useInfiniteListScroll({
    hasNext: guidelines.hasNextPage ?? false,
    isFetching: guidelines.isFetchingNextPage,
    fetchNext: () => void guidelines.fetchNextPage(),
    itemCount: items.length,
  });

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    setSubmittedQuery(input.trim() || undefined);
  };

  return (
    <div className="flex h-full flex-col">
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          aria-label={t.searchGuidelines}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.searchGuidelinesPlaceholder}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          {t.search}
        </button>
      </form>

      {guidelines.isPending && <p className="text-sm text-gray-400">{t.loading}</p>}
      {guidelines.isError && <p className="text-sm text-red-500">{t.loadFailed}</p>}

      <div
        ref={listScroll.containerRef}
        onScroll={listScroll.handleScroll}
        className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto"
      >
        <ul className="space-y-2">
          {items.map((guideline) => (
            <li key={guideline.id}>
              {/*
                목록 제목은 UI 토글의 언어로 선다 — 이 화면에는 대화 맥락이 없다 (§44 기준 30).
                청크 번역이 없는 지침은 키 부재로 닫혀 원문 제목이 그대로 보인다.
              */}
              <button
                type="button"
                aria-label={displayTitle(guideline, lang)}
                onClick={() => onSelect(guideline)}
                className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-emerald-300"
              >
                <p className="font-medium text-gray-900">{displayTitle(guideline, lang)}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {guideline.publisher} · v{guideline.currentVersion} · {guideline.status}
                </p>
              </button>
            </li>
          ))}
        </ul>
        {/* 하단 sentinel — 보이면 다음 페이지를 당긴다 (무한 스크롤) */}
        <div ref={listScroll.bottomSentinelRef} aria-hidden="true" />
        {guidelines.isFetchingNextPage && (
          <p className="py-2 text-center text-xs text-gray-400">{t.loading}</p>
        )}
      </div>
    </div>
  );
}
