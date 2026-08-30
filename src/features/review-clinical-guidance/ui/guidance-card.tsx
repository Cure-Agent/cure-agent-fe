'use client';

/**
 * 임상 가이던스 카드 + 의료인 검토 폼 (docs/specs/10 기준 10~12).
 * "처방 확정"이 아닌 근거 기반 참고안 — DRAFT에서만 검토를 받고 1회로 종결한다 (§5.6).
 */
import { FormEvent, useState, type ReactElement } from 'react';
import { EvidenceFullText } from '@/features/filter-guidelines/ui/evidence-full-text';
import { ApiError } from '@/shared/api/api-error';
import { type MessageKey, messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';
import {
  type ClinicalGuidance,
  type ReviewDecision,
  useReviewClinicalGuidance,
} from '../api/review-clinical-guidance';

type GuidanceCitation = ClinicalGuidance['considerations'][number]['citations'][number];

export interface GuidanceCardProps {
  guidance: ClinicalGuidance;
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

/** 인용 근거 칩 [n] — 클릭 시 해당 근거의 전문을 펼친다 (지침 상세와 동일 구성) */
function CitationList({ citations }: { citations: GuidanceCitation[] }): ReactElement | null {
  const [openMarker, setOpenMarker] = useState<number | null>(null);
  if (citations.length === 0) return null;

  const open = citations.find((citation) => citation.marker === openMarker) ?? null;
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
            {open.guidelineTitle} · v{open.guidelineVersion} · {open.sectionPath.join(' > ')}
          </p>
          <div className="mt-2">
            <EvidenceFullText evidenceId={open.evidenceId} />
          </div>
        </div>
      )}
    </div>
  );
}

export function GuidanceCard({ guidance }: GuidanceCardProps): ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
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
          setErrorMessage(
            error instanceof ApiError ? error.message : t.guidanceReviewFailed,
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
                        {factor}
                      </span>
                    ))}
                  </div>
                )}
                <CitationList citations={consideration.citations} />
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
                  <CitationList citations={alert.citations} />
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
              <li key={item}>{item}</li>
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
            <legend className="mb-1.5 text-xs font-semibold text-gray-500">{t.guidanceClinicianReview}</legend>
            {DECISIONS.map(({ value, labelKey }) => (
              <label key={value} className="flex items-center gap-1.5 text-gray-800">
                <input
                  type="radio"
                  name="review-decision"
                  aria-label={value}
                  checked={decision === value}
                  onChange={() => setDecision(value)}
                />
                {t[labelKey]}
              </label>
            ))}
          </fieldset>
          <div className="mt-2 flex flex-col gap-2">
            <label htmlFor="guidance-review-note" className="text-xs font-semibold text-gray-500">
              {t.guidanceReviewComment}
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
              {t.guidanceReviewSubmit}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
