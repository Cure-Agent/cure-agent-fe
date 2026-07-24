'use client';

import type { components } from '@/shared/api/generated/schema';

export type EvidenceItem = components['schemas']['EvidenceDetailResponseDto'];

export interface EvidenceInspectorProps {
  /** retrieval 순서 = marker 순서 (index + 1 = marker, §8) */
  evidence: EvidenceItem[];
  activeMarker: number | null;
  onSelectMarker: (marker: number) => void;
}

/** 근거 패널 (assistant·guidelines 공용 widget) */
export function EvidenceInspector({
  evidence,
  activeMarker,
  onSelectMarker,
}: EvidenceInspectorProps): React.ReactElement {
  if (evidence.length === 0) {
    return (
      <aside className="h-full rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">인용 근거</h2>
        <p className="mt-3 text-sm text-gray-400">
          질문하면 답변에 인용된 지침 근거가 여기에 표시됩니다.
        </p>
      </aside>
    );
  }

  return (
    <aside className="h-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">인용 근거</h2>
      <ul className="mt-3 space-y-2">
        {evidence.map((item, index) => {
          const marker = index + 1;
          const active = activeMarker === marker;
          return (
            <li key={item.id} aria-current={active ? 'true' : undefined}>
              <button
                type="button"
                onClick={() => onSelectMarker(marker)}
                className={`w-full rounded-lg border p-3 text-left text-sm ${
                  active
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="font-mono text-xs font-bold text-emerald-700">[{marker}]</span>
                <p className="mt-1 font-medium text-gray-900">{item.guidelineTitle}</p>
                <p className="text-xs text-gray-500">
                  v{item.version} · {item.sectionPath.join(' > ')}
                </p>
                <p className="mt-1 line-clamp-3 text-gray-600">{item.excerpt}</p>
                {item.recommendationGrade && (
                  <p className="mt-1 text-xs text-gray-500">
                    권고등급 {item.recommendationGrade.code} ({item.recommendationGrade.label})
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
