'use client';

import { useGuideline, useGuidelineEvidence } from '../api/guideline.api';

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
        <h1 className="text-xl font-bold text-gray-900">{detail.title}</h1>
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
        {(evidence.data?.items ?? []).map((item) => (
          <li key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{item.sectionPath.join(' > ')}</p>
            <p className="mt-1 text-sm text-gray-800">{item.excerpt}</p>
            <p className="mt-1 text-xs text-gray-500">
              {item.recommendationNumber && `권고 ${item.recommendationNumber}`}
              {item.recommendationGrade &&
                ` · 등급 ${item.recommendationGrade.code} (${item.recommendationGrade.label})`}
              {item.evidenceLevel && ` · 근거수준 ${item.evidenceLevel.code}`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
