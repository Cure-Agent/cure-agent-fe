'use client';

import { useState } from 'react';
import { EvidenceFullText } from '@/features/filter-guidelines/ui/evidence-full-text';
import type { components } from '@/shared/api/generated/schema';

/**
 * 근거 카드 한 장. 스트림 근거(EvidenceDetailResponseDto)와 저장된 메시지의
 * 인용(AnswerCitationResponseDto 변환) 양쪽이 이 부분집합으로 들어온다 —
 * EvidenceDetailResponseDto 는 구조적으로 그대로 대입된다.
 */
export interface EvidenceItem {
  /** EvidenceChunk id — 전문 조회 키 (GET /evidence/{id}) */
  id: string;
  guidelineTitle: string;
  version: string;
  sectionPath: string[];
  excerpt: string;
  recommendationGrade?: components['schemas']['RatingResponseDto'];
  /** 명시 마커 — 저장된 인용 경로가 넘긴다. 없으면 배열 순서(index + 1)가 마커다 (§8) */
  marker?: number;
  /**
   * 근거 번역 (BE docs/specs/42) — **배치 산출물이라 없을 수 있다.**
   * 1차 대상이 6주제 655청크뿐이고, 원문이 개정되면 stale로 판정돼 BE가 키를 아예 싣지 않는다.
   * 스트림 근거는 `excerptTranslated`, 저장된 인용은 `quoteTranslated`가 여기로 들어온다 —
   * 둘 다 같은 자리(발췌)의 번역이라 카드에서는 하나로 본다.
   */
  excerptTranslated?: string;
  titleTranslated?: string;
  /** 이하 EvidenceDetailResponseDto 통과 필드 — 리터럴 대입 호환용, 렌더에는 쓰지 않는다 */
  guidelineId?: string;
  guidelineVersionId?: string;
  recommendationNumber?: string;
  recommendationText?: string;
  evidenceLevel?: components['schemas']['RatingResponseDto'];
  pageStart?: number;
  pageEnd?: number;
  sourceUrl?: string;
  /** 번역을 만든 모델 — provenance. 렌더에는 쓰지 않는다 */
  translationModel?: string;
}

export interface EvidenceInspectorProps {
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
          const marker = item.marker ?? index + 1;
          return (
            <EvidenceCard
              key={`${marker}-${item.id}`}
              item={item}
              marker={marker}
              active={activeMarker === marker}
              onSelect={() => onSelectMarker(marker)}
            />
          );
        })}
      </ul>
    </aside>
  );
}

/** 근거 카드 — 클릭 시 마커 선택, 전문 보기로 원문을 펼친다 (지침 상세와 동일 구성) */
function EvidenceCard({
  item,
  marker,
  active,
  onSelect,
}: {
  item: EvidenceItem;
  marker: number;
  active: boolean;
  onSelect: () => void;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <li
      aria-current={active ? 'true' : undefined}
      className={`rounded-lg border ${
        active ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full p-3 text-left text-sm">
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
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full px-3 pb-2.5 text-left text-xs font-medium text-emerald-700 hover:underline"
      >
        {expanded ? '접기' : '전문 보기'}
      </button>
      {expanded && (
        <div className="border-t border-gray-100 p-3">
          <EvidenceFullText evidenceId={item.id} />
        </div>
      )}
    </li>
  );
}
