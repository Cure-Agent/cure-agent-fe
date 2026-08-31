'use client';

/**
 * 임상 가이던스 카드 + 의료인 검토 폼 (docs/specs/10 기준 10~12).
 * "처방 확정"이 아닌 근거 기반 참고안 — DRAFT에서만 검토를 받고 1회로 종결한다 (§5.6).
 */
import { FormEvent, useState, type ReactElement } from 'react';
import { EvidenceFullText } from '@/features/filter-guidelines/ui/evidence-full-text';
import { ApiError } from '@/shared/api/api-error';
import { type MessageKey, messagesFor } from '@/shared/i18n/messages';
import { type UiLang, useUiLang } from '@/shared/i18n/ui-lang';
import {
  type ClinicalGuidance,
  type ReviewDecision,
  useReviewClinicalGuidance,
} from '../api/review-clinical-guidance';

type GuidanceCitation = ClinicalGuidance['considerations'][number]['citations'][number];

export interface GuidanceCardProps {
  guidance: ClinicalGuidance;
  /**
   * 이 참고안이 **생성된 언어** — 그 메시지의 `responseLang`이다 (BE docs/specs/44).
   * 본문·인용·필드 라벨이 이 값을 따르고, 검토 폼은 앱 크롬이라 `useUiLang()`을 따른다.
   */
  lang?: UiLang;
}

const STATUS_LABELS: Record<ClinicalGuidance['reviewStatus'], MessageKey> = {
  DRAFT: 'guidanceStatusDraft',
  ACCEPTED: 'guidanceStatusAccepted',
  MODIFIED: 'guidanceStatusModified',
  REJECTED: 'guidanceStatusRejected',
};

const DECISIONS: { value: ReviewDecision; labelKey: MessageKey }[] = [
  { value: 'ACCEPTED', labelKey: 'guidanceDecisionAccept' },
  { value: 'MODIFIED', labelKey: 'guidanceDecisionModify' },
  { value: 'REJECTED', labelKey: 'guidanceDecisionReject' },
];

const SEVERITY_STYLES: Record<string, string> = {
  INFO: 'bg-sky-100 text-sky-800',
  WARNING: 'bg-amber-100 text-amber-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

/**
 * 적용 판단 — 근거의 조건·금기가 이 환자의 값과 만나는지 (BE docs/specs/33).
 * 구조화 경로에서만 실린다. 결정적 폴백으로 조립된 참고안에는 이 필드가 없다.
 */
const APPLICABILITY_LABELS: Record<string, MessageKey> = {
  APPLICABLE: 'applicabilityApplicable',
  CAUTION: 'applicabilityCaution',
  NOT_APPLICABLE: 'applicabilityNotApplicable',
};

const APPLICABILITY_STYLES: Record<string, string> = {
  APPLICABLE: 'bg-emerald-100 text-emerald-800',
  CAUTION: 'bg-amber-100 text-amber-800',
  NOT_APPLICABLE: 'bg-gray-100 text-gray-600',
};

/**
 * 환자 프로필 필드명 — `patientFactors`와 `missingInformation`이 함께 쓰는 **닫힌 어휘**다
 * (BE `guidance-profile-fields.ts`의 9개). 값이 있는 쪽과 없는 쪽이 같은 목록의 여집합이라,
 * 한쪽만 번역하면 「무엇을 딛었는가」와 「무엇이 빠졌는가」가 다른 언어로 갈려 나란히 읽히지 않는다.
 *
 * BE 문구인데도 FE가 번역하는 이유는 이것이 **문장이 아니라 어휘**이기 때문이다 — 자유 문구인
 * 기권 사유·오류 메시지와 달리 값이 유한하고, BE 검증기가 이 목록 밖의 값을 폐기한다.
 */
const PROFILE_FIELD_LABELS: Record<string, MessageKey> = {
  출생연도: 'profileFieldBirthYear',
  성별: 'profileFieldSex',
  신장: 'profileFieldHeight',
  체중: 'profileFieldWeight',
  허리둘레: 'profileFieldWaist',
  진단명: 'profileFieldDiagnoses',
  '투약 목록': 'profileFieldMedications',
  '알레르기 이력': 'profileFieldAllergies',
  '임상 메모': 'profileFieldClinicalNotes',
};

/** 어휘가 넓어지면 모르는 값이 온다 — 지우지 않고 원문으로 남긴다 (배지 자리가 비면 안 된다) */
function profileFieldLabel(field: string, t: Record<MessageKey, string>): string {
  const key = PROFILE_FIELD_LABELS[field];
  return key ? t[key] : field;
}

/**
 * 인용 근거 칩 [n] — 클릭 시 해당 근거의 전문을 펼친다 (지침 상세와 동일 구성).
 *
 * 펼침 헤더가 `제목 · v버전 · 섹션경로` 한 줄이라, 앞 둘만 영어가 되면 **한 줄 안에서 언어가
 * 갈린다** (§44). 셋을 같은 축으로 묶는다.
 */
function CitationList({
  citations,
  lang,
}: {
  citations: GuidanceCitation[];
  lang: UiLang;
}): ReactElement | null {
  const [openMarker, setOpenMarker] = useState<number | null>(null);
  if (citations.length === 0) return null;

  const open = citations.find((citation) => citation.marker === openMarker) ?? null;
  const openTitle =
    open && lang === 'en' && open.titleTranslated ? open.titleTranslated : open?.guidelineTitle;
  const openSectionPath =
    open && lang === 'en' && open.sectionPathTranslated
      ? open.sectionPathTranslated
      : open?.sectionPath;
  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap gap-1">
        {citations.map((citation) => (
          <button
            key={citation.marker}
            type="button"
            aria-expanded={openMarker === citation.marker}
            title={citation.guidelineTitle}
            onClick={() =>
              setOpenMarker((prev) => (prev === citation.marker ? null : citation.marker))
            }
            className={`rounded border px-1.5 py-0.5 font-mono text-xs ${
              openMarker === citation.marker
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                : 'border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            [{citation.marker}]
          </button>
        ))}
      </div>
      {open && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-500">
            {openTitle} · v{open.guidelineVersion} · {openSectionPath?.join(' > ')}
          </p>
          <div className="mt-2">
            <EvidenceFullText evidenceId={open.evidenceId} lang={lang} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * **한 카드 안에 두 축이 선다** (BE docs/specs/44 판단표).
 *
 * 참고안의 내용물 — 본문·검토 항목·인용·환자 근거 라벨·누락 정보 — 은 그것이 **생성된 언어**
 * (그 메시지의 `responseLang`)를 따른다. 참고안은 화면 전체가 판단물이라, 영문 질의에 한국어
 * 카드가 서면 「검토」 자체가 성립하지 않는다.
 *
 * 반면 **검토 폼은 앱 크롬**이라 UI 토글을 따른다 — 한국어 UI 사용자가 영문 질의 한 번에
 * 자기가 누를 버튼까지 영어가 되는 것은 과하다.
 */
export function GuidanceCard({ guidance, lang: contentLang }: GuidanceCardProps): ReactElement {
  const uiLang = useUiLang();
  // 참고안 단건 화면 등 대화 맥락 없이 열리는 자리는 UI 토글로 떨어진다
  const lang = contentLang ?? uiLang;
  const t = messagesFor(lang);
  const tUi = messagesFor(uiLang);
  const review = useReviewClinicalGuidance(guidance.id);
  const [current, setCurrent] = useState(guidance);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [note, setNote] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDraft = current.reviewStatus === 'DRAFT';

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    if (!decision || review.isPending) return;
    setErrorMessage(null);
    review.mutate(
      { decision, ...(note ? { note } : {}) },
      {
        onSuccess: (updated) => setCurrent(updated),
        onError: (error) => {
          // 폼이 낸 오류는 폼과 같은 축에 선다 — 검토 폼은 UI 토글을 따른다
          setErrorMessage(
            error instanceof ApiError ? error.message : tUi.guidanceReviewFailed,
          );
        },
      },
    );
  };

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-emerald-900">{t.guidanceHeading}</h3>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-300">
          {t[STATUS_LABELS[current.reviewStatus]]}
        </span>
      </div>

      <p className="whitespace-pre-wrap text-gray-800">{current.summary}</p>

      {current.considerations.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold text-gray-500">{t.guidanceReviewItems}</h4>
          <ul className="mt-1 space-y-2">
            {current.considerations.map((consideration, index) => (
              <li key={index} className="rounded-lg bg-white p-2.5 ring-1 ring-gray-200">
                <div className="flex items-start gap-2">
                  {consideration.applicability && (
                    // 세로 오프셋을 주지 않는다 — 배지(text-xs 16px + py-0.5 4px)와 제목(text-sm
                    // 20px)의 줄상자가 똑같이 20px라 items-start 만으로 글자 중심까지 맞는다
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${
                        APPLICABILITY_STYLES[consideration.applicability] ??
                        'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {APPLICABILITY_LABELS[consideration.applicability]
                        ? t[APPLICABILITY_LABELS[consideration.applicability]]
                        : consideration.applicability}
                    </span>
                  )}
                  <p className="font-medium text-gray-900">{consideration.title}</p>
                </div>
                <p className="mt-0.5 text-gray-600">{consideration.rationale}</p>
                {consideration.patientFactors && consideration.patientFactors.length > 0 && (
                  // 지침 근거([n] 칩)와 나란히 두 다리를 보여준다 — 이 판단이 환자의 어느 값을
                  // 딛고 섰는지가 카드에서 바로 읽혀야 「적용 판단」이 검증 가능해진다
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="text-xs text-gray-500">{t.guidancePatientEvidence}</span>
                    {consideration.patientFactors.map((factor) => (
                      <span
                        key={factor}
                        className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-700"
                      >
                        {profileFieldLabel(factor, t)}
                      </span>
                    ))}
                  </div>
                )}
                <CitationList citations={consideration.citations} lang={lang} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {current.safetyAlerts.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold text-gray-500">{t.guidanceSafetyWarnings}</h4>
          <ul className="mt-1 space-y-1.5">
            {current.safetyAlerts.map((alert, index) => (
              <li key={index} className="flex items-start gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                    SEVERITY_STYLES[alert.severity] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {alert.severity}
                </span>
                <div className="flex-1">
                  <span className="text-gray-800">{alert.description}</span>
                  <CitationList citations={alert.citations} lang={lang} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {current.missingInformation.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold text-gray-500">{t.guidanceMissingInformation}</h4>
          <ul className="mt-1 list-inside list-disc text-gray-600">
            {current.missingInformation.map((item) => (
              <li key={item}>{profileFieldLabel(item, t)}</li>
            ))}
          </ul>
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-red-700">
          {errorMessage}
        </p>
      )}

      {isDraft && (
        <form onSubmit={handleSubmit} className="mt-4 border-t border-emerald-200 pt-3">
          <fieldset className="flex items-center gap-4">
            <legend className="mb-1.5 text-xs font-semibold text-gray-500">{tUi.guidanceClinicianReview}</legend>
            {DECISIONS.map(({ value, labelKey }) => (
              <label key={value} className="flex items-center gap-1.5 text-gray-800">
                {/*
                  `aria-label`은 **결정 코드**다 — 언어와 무관한 고정 식별자로, 보이는 라벨이
                  번역돼도 이 핸들은 움직이지 않는다. 사람이 읽는 문구는 아래 `tUi[labelKey]`다.
                */}
                <input
                  type="radio"
                  name="review-decision"
                  aria-label={value}
                  checked={decision === value}
                  onChange={() => setDecision(value)}
                />
                {tUi[labelKey]}
              </label>
            ))}
          </fieldset>
          <div className="mt-2 flex flex-col gap-2">
            <label htmlFor="guidance-review-note" className="text-xs font-semibold text-gray-500">
              {tUi.guidanceReviewComment}
            </label>
            <textarea
              id="guidance-review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!decision || review.isPending}
              className="self-end rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {tUi.guidanceReviewSubmit}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
