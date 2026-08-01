'use client';

import { useMemo, useState } from 'react';
import { useInfiniteListScroll } from '@/shared/lib/use-infinite-list-scroll';
import {
  type EvidenceSummary,
  useGuideline,
  useGuidelineEvidence,
} from '../api/guideline.api';
import { EvidenceFullText } from './evidence-full-text';

export interface GuidelineDetailPanelProps {
  guidelineId: string;
}

export function GuidelineDetailPanel({
  guidelineId,
}: GuidelineDetailPanelProps): React.ReactElement {
  const guideline = useGuideline(guidelineId);
  const evidence = useGuidelineEvidence(guidelineId);

  const evidenceItems = useMemo(
    () => (evidence.data?.pages ?? []).flatMap((page) => page.items),
    [evidence.data],
  );
  const listScroll = useInfiniteListScroll<HTMLElement>({
    hasNext: evidence.hasNextPage ?? false,
    isFetching: evidence.isFetchingNextPage,
    fetchNext: () => void evidence.fetchNextPage(),
    itemCount: evidenceItems.length,
  });

  if (guideline.isPending) return <p className="text-sm text-gray-400">불러오는 중…</p>;
  if (guideline.isError || !guideline.data) {
    return <p className="text-sm text-red-500">지침을 불러오지 못했습니다</p>;
  }

  const detail = guideline.data;
  return (
    // 헤더·권고문이 한 흐름으로 스크롤된다 — 컨테이너는 패널이 소유해야 sentinel IO가 붙는다
    <section
      ref={listScroll.containerRef}
      onScroll={listScroll.handleScroll}
      className="scrollbar-hidden h-full min-h-0 overflow-y-auto"
    >
      <header className="border-b border-gray-200 pb-4">
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          {detail.title}
          {detail.status === 'SUPERSEDED' && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              구판 — 최신 버전 아님
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {detail.publisher} · v{detail.currentVersion} ·{' '}
          {new Date(detail.publishedAt).toLocaleDateString('ko-KR')}
        </p>
        <a
          href={detail.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-sm text-emerald-700 hover:underline"
        >
          원문 보기 (NCKM)
        </a>
      </header>

      <h2 className="mt-6 text-sm font-semibold text-gray-900">섹션·권고문</h2>
      {evidence.isPending && <p className="mt-2 text-sm text-gray-400">불러오는 중…</p>}
      <ul className="mt-2 space-y-2">
        {evidenceItems.map((item) => (
          <EvidenceListItem key={item.id} item={item} />
        ))}
      </ul>

      {/* 하단 sentinel — 보이면 다음 페이지를 당긴다 (무한 스크롤) */}
      <div ref={listScroll.bottomSentinelRef} aria-hidden="true" />
      {evidence.isFetchingNextPage && (
        <p className="py-2 text-center text-xs text-gray-400">불러오는 중…</p>
      )}
    </section>
  );
}

/** 권고문 카드 — 클릭 시 전문(권고문 원문·발췌 전문·페이지)을 펼친다 */
function EvidenceListItem({ item }: { item: EvidenceSummary }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full p-4 text-left hover:bg-gray-50"
      >
        <p className="text-xs text-gray-500">{item.sectionPath.join(' > ')}</p>
        <p className="mt-1 text-sm text-gray-800">{item.excerpt}</p>
        <p className="mt-1 text-xs text-gray-500">
          {item.recommendationNumber && `권고 ${item.recommendationNumber}`}
          {item.recommendationGrade &&
            ` · 등급 ${item.recommendationGrade.code} (${item.recommendationGrade.label})`}
          {item.evidenceLevel && ` · 근거수준 ${item.evidenceLevel.code}`}
        </p>
        <p className="mt-2 text-xs font-medium text-emerald-700">
          {expanded ? '접기' : '전문 보기'}
        </p>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4">
          <EvidenceFullText evidenceId={item.id} />
        </div>
      )}
    </li>
  );
}
