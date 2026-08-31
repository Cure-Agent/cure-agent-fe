'use client';

import { useState } from 'react';
import { messagesFor } from '@/shared/i18n/messages';
import { type UiLang, useUiLang } from '@/shared/i18n/ui-lang';
import { useEvidenceDetail } from '../api/guideline.api';

export interface EvidenceFullTextProps {
  /** EvidenceChunk id — GET /evidence/{id} */
  evidenceId: string;
  /**
   * 이 근거가 딛고 선 **콘텐츠 언어** (BE docs/specs/44).
   * 채팅 안에서는 그 메시지의 `responseLang`, 지침 탐색기에서는 대화 맥락이 없으므로 생략한다 —
   * 없으면 `useUiLang()`으로 떨어진다.
   */
  lang?: UiLang;
}

/**
 * 근거 청크 전문 — 권고문 원문·본문 발췌·원문 페이지.
 * 지침 상세·인용 근거 패널·임상 참고안이 같은 구성을 공유한다.
 * 마운트 시점에 조회하므로 펼침(expanded) 상태에서만 렌더할 것.
 *
 * **번역 축은 영문 화면에만 있다** (BE docs/specs/42) — 인용 카드와 같은 규칙이다.
 * 표시 언어를 prop이 아니라 훅으로 읽는 이유는 그것이 화면이 아니라 **사람의 설정**이기
 * 때문이다. prop으로 내리면 같은 컴포넌트가 어느 화면에 박혔느냐에 따라 다른 언어로
 * 말하게 되고, 나머지 화면이 i18n되는 순간 그 배관은 죽는다.
 */
export function EvidenceFullText({ evidenceId }: EvidenceFullTextProps): React.ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const detail = useEvidenceDetail(evidenceId, lang);
  const [originalShown, setOriginalShown] = useState(false);

  if (detail.isPending) return <p className="text-sm text-gray-400">{t.fullTextLoading}</p>;
  if (detail.isError || !detail.data) {
    return <p className="text-sm text-red-500">{t.fullTextError}</p>;
  }

  const data = detail.data;
  const translated = lang === 'en' && Boolean(data.excerptTranslated);
  const excerptUntranslated = lang === 'en' && !data.excerptTranslated;

  return (
    <div className="space-y-3">
      {data.recommendationText && (
        <div>
          <h3 className="text-xs font-semibold text-gray-900">
            {t.recommendationHeading}
            {/*
              권고문은 계약에 번역이 **없다** — `EvidenceDetailResponseDto`가 싣는 번역은
              발췌·제목뿐이다. 영문 화면에서는 언제나 한국어이므로, 영어 제목 아래 한국어를
              말없이 두지 않고 배지로 밝힌다. 이 기능이 파는 것이 「무엇을 읽을 수 있는지」다.
            */}
            {lang === 'en' && <UntranslatedBadge label={t.citationNotTranslated} />}
          </h3>
          <p className="mt-1 whitespace-pre-line text-sm text-gray-800">
            {data.recommendationText}
          </p>
        </div>
      )}
      <div>
        <h3 className="text-xs font-semibold text-gray-900">
          {t.excerptHeading}
          {excerptUntranslated && <UntranslatedBadge label={t.citationNotTranslated} />}
        </h3>
        <p className="mt-1 whitespace-pre-line text-sm text-gray-800">
          {translated ? data.excerptTranslated : data.excerpt}
        </p>
        {/* 정본은 원문이다 — 번역을 앞에 두되 원문을 지우지 않는다 (인용 카드와 같은 규칙) */}
        {translated && (
          <>
            <button
              type="button"
              aria-expanded={originalShown}
              onClick={() => setOriginalShown((prev) => !prev)}
              className="mt-1 text-left text-xs font-medium text-emerald-700 hover:underline"
            >
              {originalShown ? t.hideKoreanOriginal : t.showKoreanOriginal}
            </button>
            {originalShown && (
              <p className="mt-1 whitespace-pre-line border-l-2 border-gray-200 pl-2 text-sm text-gray-600">
                {data.excerpt}
              </p>
            )}
          </>
        )}
      </div>
      <p className="text-xs text-gray-500">
        {data.pageStart !== undefined && (
          <>
            <span>
              {t.sourcePagePrefix}
              {data.pageStart}
              {data.pageEnd !== undefined &&
                data.pageEnd !== data.pageStart &&
                `–${data.pageEnd}`}
            </span>
            {' · '}
          </>
        )}
        <a
          href={data.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-emerald-700 hover:underline"
        >
          {t.viewSource}
        </a>
      </p>
    </div>
  );
}

function UntranslatedBadge({ label }: { label: string }): React.ReactElement {
  return (
    <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
      {label}
    </span>
  );
}
