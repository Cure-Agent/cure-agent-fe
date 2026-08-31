'use client';

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
 * **표시 언어의 축이 화면에서 콘텐츠로 바뀌었다** (BE docs/specs/44 — §42의 FE 판단을 뒤집는다).
 * 이 카드가 파는 것은 **대조 가능성**인데, 근거가 딛고 선 답변과 다른 언어로 서면 그 대조가
 * 깨진다. 그래서 언어는 「사람의 설정」이 아니라 「이 근거가 어느 맥락에 있는가」가 정한다.
 * 대화 맥락이 없는 지침 탐색기만 UI 토글로 떨어진다.
 *
 * 이 컴포넌트의 문구는 **전부 콘텐츠 언어를 따른다** — 제목·페이지 표기·원문 링크까지
 * 번역된 본문과 같은 카드 안에서 그 본문을 설명하는 자리이기 때문이다.
 */
export function EvidenceFullText({
  evidenceId,
  lang: contentLang,
}: EvidenceFullTextProps): React.ReactElement {
  const uiLang = useUiLang();
  const lang = contentLang ?? uiLang;
  const t = messagesFor(lang);
  const detail = useEvidenceDetail(evidenceId, lang);

  if (detail.isPending) return <p className="text-sm text-gray-400">{t.fullTextLoading}</p>;
  if (detail.isError || !detail.data) {
    return <p className="text-sm text-red-500">{t.fullTextError}</p>;
  }

  const data = detail.data;
  // 번역은 배치 산출물이라 항목마다 따로 없을 수 있다 — 경계를 **항목 단위로** 밝힌다
  const excerptUntranslated = lang === 'en' && !data.excerptTranslated;
  const recommendationUntranslated = lang === 'en' && !data.recommendationTextTranslated;
  const excerpt = lang === 'en' && data.excerptTranslated ? data.excerptTranslated : data.excerpt;
  const recommendationText =
    lang === 'en' && data.recommendationTextTranslated
      ? data.recommendationTextTranslated
      : data.recommendationText;

  return (
    <div className="space-y-3">
      {data.recommendationText && (
        <div>
          <h3 className="text-xs font-semibold text-gray-900">
            {t.recommendationHeading}
            {recommendationUntranslated && <UntranslatedBadge label={t.citationNotTranslated} />}
          </h3>
          <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{recommendationText}</p>
        </div>
      )}
      <div>
        <h3 className="text-xs font-semibold text-gray-900">
          {t.excerptHeading}
          {excerptUntranslated && <UntranslatedBadge label={t.citationNotTranslated} />}
        </h3>
        <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{excerpt}</p>
      </div>
      {/*
        정본은 여전히 한국어 원문이고, 그 도달 경로는 이제 **원문 링크**다 (§44 판단표).
        인라인 「한국어 원문 보기」 토글을 없앤 자리를 이 링크가 잇는다 — 계약이 이미 `sourceUrl`과
        `pageStart`·`pageEnd`를 싣고 있어 정본에 더 정확히 닿는다.
      */}
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
