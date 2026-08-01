'use client';

import { useState } from 'react';
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

  if (guideline.isPending) return <p className="text-sm text-gray-400">불러오는 중…</p>;
  if (guideline.isError || !guideline.data) {
    return <p className="text-sm text-red-500">지침을 불러오지 못했습니다</p>;
  }

  const detail = guideline.data;
  return (
    <section>
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
        {(evidence.data?.pages ?? [])
          .flatMap((page) => page.items)
          .map((item) => (
            <EvidenceListItem key={item.id} item={item} />
          ))}
      </ul>

      {evidence.hasNextPage && (
        <button
          type="button"
          onClick={() => void evidence.fetchNextPage()}
          disabled={evidence.isFetchingNextPage}
          className="mt-3 w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
        >
          {evidence.isFetchingNextPage ? '불러오는 중…' : '더 보기'}
        </button>
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
