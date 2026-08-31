'use client';

import { useState } from 'react';
import { EvidenceFullText } from '@/features/filter-guidelines/ui/evidence-full-text';
import type { components } from '@/shared/api/generated/schema';
import { type MessageKey, formatMessage, messagesFor } from '@/shared/i18n/messages';
import { ratingLabel } from '@/shared/i18n/rating-label';
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
  /**
   * 섹션 경로의 번역 (BE docs/specs/44) — 펼침 헤더가 `제목 · v… · 섹션경로`라, 앞 둘만
   * 영어가 되면 **한 줄 안에서 언어가 갈린다**. 원문과 같은 길이의 배열로 온다.
   */
  sectionPathTranslated?: string[];
  /** 이하 EvidenceDetailResponseDto 통과 필드 — 리터럴 대입 호환용, 렌더에는 쓰지 않는다 */
  guidelineId?: string;
  guidelineVersionId?: string;
  recommendationNumber?: string;
  recommendationText?: string;
  recommendationTextTranslated?: string;
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
  /**
   * 이 근거들이 딛고 선 **콘텐츠 언어** — 클릭한 메시지의 `responseLang`이다 (BE docs/specs/44).
   * 패널 제목 같은 앱 크롬은 이 값이 아니라 `useUiLang()`을 따른다.
   * 아직 아무 메시지도 고르지 않았으면 없다.
   */
  lang?: UiLang;
}

/**
 * 근거 패널 (assistant 화면 widget).
 *
 * **패널 제목은 앱 크롬이고 카드 안은 내용물이다** (BE docs/specs/44 판단표). 두 축이 한 화면에
 * 동시에 서는 자리라, 한국어 UI 사용자가 영문 질의를 하면 「인용 근거」 제목 아래 영문 카드가
 * 선다 — 설계된 동작이다. 버튼까지 영어가 되는 것은 과하다는 것이 그 판단의 반대편이다.
 */
export function EvidenceInspector({
  evidence,
  activeMarker,
  onSelectMarker,
  lang: contentLang,
}: EvidenceInspectorProps): React.ReactElement {
  const uiLang = useUiLang();
  const tUi = messagesFor(uiLang);
  // 아직 아무 메시지도 고르지 않았으면 딛을 응답 언어가 없다 — 그때만 UI 토글로 떨어진다
  const lang = contentLang ?? uiLang;
  const t = messagesFor(lang);

  if (evidence.length === 0) {
    return (
      <aside className="h-full rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">{tUi.evidencePanelHeading}</h2>
        <p className="mt-3 text-sm text-gray-400">{tUi.evidencePanelEmpty}</p>
      </aside>
    );
  }

  return (
    <aside className="h-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">{tUi.evidencePanelHeading}</h2>
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
 * **`lang`은 이 근거가 딛고 선 답변의 언어다** (BE docs/specs/44). 한국어 답변의 근거는
 * 한국어로 서고, 그 사실은 UI 토글과 무관하다 — 스펙이 「한국어 경로는 한 바이트도 바뀌지
 * 않는다」로 못박은 축이고, BE도 한국어 응답에는 번역 키를 아예 싣지 않는다.
 *
 * 영문 콘텐츠에서 갈리는 것은 둘이다:
 * - 번역이 있으면 번역을 앞에 둔다. 정본은 여전히 한국어 원문이고, **원문 링크**가 그 도달
 *   경로다 — §42의 인라인 토글을 §44가 링크로 옮겼다. 카드마다 상태와 문구를 하나씩 늘리는
 *   대신, 이미 계약에 있는 `sourceUrl`을 쓴다.
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

  // 번역 유무의 기준은 발췌다 — 카드가 파는 대조의 대상이 그것이고, 제목만 번역된 근거를
  // 「번역됨」으로 칠하면 배지가 가리키는 경계가 흐려진다
  const translated = lang === 'en' && Boolean(item.excerptTranslated);
  const untranslated = lang === 'en' && !item.excerptTranslated;

  const title = translated && item.titleTranslated ? item.titleTranslated : item.guidelineTitle;
  const excerpt = translated ? (item.excerptTranslated as string) : item.excerpt;
  /*
    헤더는 `v버전 · 섹션경로` 한 줄이다 — 제목만 영어가 되고 경로가 한국어로 남으면 **한 줄
    안에서 언어가 갈린다**. 번역이 없는 청크는 키가 아예 빠지므로 원문 경로로 닫힌다.
  */
  const sectionPath =
    lang === 'en' && item.sectionPathTranslated ? item.sectionPathTranslated : item.sectionPath;

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
          v{item.version} · {sectionPath.join(' > ')}
        </p>
        <p className="mt-1 line-clamp-3 text-gray-600">{excerpt}</p>
        {item.recommendationGrade && (
          <p className="mt-1 text-xs text-gray-500">
            {formatMessage(t.recommendationGradeLine, {
              code: item.recommendationGrade.code,
              label: ratingLabel(item.recommendationGrade.label, lang),
            })}
          </p>
        )}
      </button>

      {/* 정본 도달 경로 — 펼치지 않고도 한국어 원문에 닿는다 (§44가 인라인 토글을 대신한 자리) */}
      {item.sourceUrl && (
        <p className="px-3 pb-1 text-xs">
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 hover:underline"
          >
            {t.viewSource}
          </a>
        </p>
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
          <EvidenceFullText evidenceId={item.id} lang={lang} />
        </div>
      )}
    </li>
  );
}
