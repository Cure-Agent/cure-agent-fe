'use client';

import { useState } from 'react';
import { EvidenceFullText } from '@/features/filter-guidelines/ui/evidence-full-text';
import type { components } from '@/shared/api/generated/schema';
import { type MessageKey, formatMessage, messagesFor } from '@/shared/i18n/messages';
import { type UiLang, useUiLang } from '@/shared/i18n/ui-lang';

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
  const lang = useUiLang();
  const t = messagesFor(lang);

  if (evidence.length === 0) {
    return (
      <aside className="h-full rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">{t.evidencePanelHeading}</h2>
        <p className="mt-3 text-sm text-gray-400">{t.evidencePanelEmpty}</p>
      </aside>
    );
  }

  return (
    <aside className="h-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">{t.evidencePanelHeading}</h2>
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
              lang={lang}
              t={t}
            />
          );
        })}
      </ul>
    </aside>
  );
}

/**
 * 근거 카드 — 클릭 시 마커 선택, 전문 보기로 원문을 펼친다 (지침 상세와 동일 구성).
 *
 * **번역 축은 영문 화면에만 있다** (BE docs/specs/42). 한국어 화면에서는 오늘 보이던 것만
 * 보인다 — 스펙이 「한국어 경로는 한 바이트도 바뀌지 않는다」로 못박은 축이고, BE도 한국어
 * 응답에는 번역 키를 아예 싣지 않는다.
 *
 * 영문 화면에서 갈리는 것은 둘뿐이다:
 * - 번역이 있으면 번역을 앞에 두고, **한국어 원문을 펼칠 수 있게** 한다. 정본은 원문이고,
 *   이 제품이 파는 것은 근거가 답을 지지하는지 **대조**할 수 있다는 성질이라 원문을 지우고
 *   번역만 남기면 안 된다 — 그래서 토글은 교체가 아니라 병렬이다.
 * - 번역이 없으면 한국어 원문이 그대로 보이고 **미번역 배지**가 붙는다. 1차 번역 대상이
 *   6주제 655청크뿐이라, 배지는 그 경계를 **근거 단위로** 드러내 고장이 아니라 범위로 읽히게
 *   한다. 답변 상단에 한 번 안내해서는 어느 근거가 해당하는지 알려주지 못한다.
 */
function EvidenceCard({
  item,
  marker,
  active,
  onSelect,
  lang,
  t,
}: {
  item: EvidenceItem;
  marker: number;
  active: boolean;
  onSelect: () => void;
  lang: UiLang;
  t: Record<MessageKey, string>;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [originalShown, setOriginalShown] = useState(false);

  // 번역 유무의 기준은 발췌다 — 카드가 파는 대조의 대상이 그것이고, 제목만 번역된 근거를
  // 「번역됨」으로 칠하면 배지가 가리키는 경계가 흐려진다
  const translated = lang === 'en' && Boolean(item.excerptTranslated);
  const untranslated = lang === 'en' && !item.excerptTranslated;

  const title = translated && item.titleTranslated ? item.titleTranslated : item.guidelineTitle;
  const excerpt = translated ? (item.excerptTranslated as string) : item.excerpt;

  return (
    <li
      aria-current={active ? 'true' : undefined}
      className={`rounded-lg border ${
        active ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full p-3 text-left text-sm">
        <span className="font-mono text-xs font-bold text-emerald-700">[{marker}]</span>
        {untranslated && (
          <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            {t.citationNotTranslated}
          </span>
        )}
        <p className="mt-1 font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">
          v{item.version} · {item.sectionPath.join(' > ')}
        </p>
        <p className="mt-1 line-clamp-3 text-gray-600">{excerpt}</p>
        {item.recommendationGrade && (
          <p className="mt-1 text-xs text-gray-500">
            {formatMessage(t.recommendationGradeLine, {
              code: item.recommendationGrade.code,
              label: item.recommendationGrade.label,
            })}
          </p>
        )}
      </button>

      {translated && (
        <div className="px-3 pb-1">
          <button
            type="button"
            aria-expanded={originalShown}
            onClick={() => setOriginalShown((prev) => !prev)}
            className="text-left text-xs font-medium text-emerald-700 hover:underline"
          >
            {originalShown ? t.hideKoreanOriginal : t.showKoreanOriginal}
          </button>
          {originalShown && (
            <p className="mt-1 border-l-2 border-gray-200 pl-2 text-xs leading-relaxed text-gray-600">
              {item.excerpt}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full px-3 pb-2.5 text-left text-xs font-medium text-emerald-700 hover:underline"
      >
        {expanded ? t.hideFullText : t.showFullText}
      </button>
      {expanded && (
        <div className="border-t border-gray-100 p-3">
          <EvidenceFullText evidenceId={item.id} />
        </div>
      )}
    </li>
  );
}
