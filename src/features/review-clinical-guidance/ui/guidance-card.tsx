'use client';

/**
 * 임상 가이던스 카드 + 의료인 검토 폼 (docs/specs/10 기준 10~12).
 * "처방 확정"이 아닌 근거 기반 참고안 — DRAFT에서만 검토를 받고 1회로 종결한다 (§5.6).
 */
import { FormEvent, useState, type ReactElement } from 'react';
import { ApiError } from '@/shared/api/api-error';
import {
  type ClinicalGuidance,
  type ReviewDecision,
  useReviewClinicalGuidance,
} from '../api/review-clinical-guidance';

export interface GuidanceCardProps {
  guidance: ClinicalGuidance;
}

const STATUS_LABELS: Record<ClinicalGuidance['reviewStatus'], string> = {
  DRAFT: '검토 대기',
  ACCEPTED: '승인됨',
  MODIFIED: '수정 반영',
  REJECTED: '반려됨',
};

const DECISIONS: { value: ReviewDecision; label: string }[] = [
  { value: 'ACCEPTED', label: '승인' },
  { value: 'MODIFIED', label: '수정' },
  { value: 'REJECTED', label: '반려' },
];

const SEVERITY_STYLES: Record<string, string> = {
  INFO: 'bg-sky-100 text-sky-800',
  WARNING: 'bg-amber-100 text-amber-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

export function GuidanceCard({ guidance }: GuidanceCardProps): ReactElement {
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
            error instanceof ApiError ? error.message : '검토 처리에 실패했습니다.',
          );
        },
      },
    );
  };

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-emerald-900">임상 참고안</h3>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-300">
          {STATUS_LABELS[current.reviewStatus]}
        </span>
      </div>

      <p className="whitespace-pre-wrap text-gray-800">{current.summary}</p>

      {current.considerations.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold text-gray-500">검토 항목</h4>
          <ul className="mt-1 space-y-2">
            {current.considerations.map((consideration, index) => (
              <li key={index} className="rounded-lg bg-white p-2.5 ring-1 ring-gray-200">
                <p className="font-medium text-gray-900">{consideration.title}</p>
                <p className="mt-0.5 text-gray-600">{consideration.rationale}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {current.safetyAlerts.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold text-gray-500">안전 경고</h4>
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
                <span className="text-gray-800">{alert.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {current.missingInformation.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold text-gray-500">누락 정보</h4>
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
            <legend className="mb-1.5 text-xs font-semibold text-gray-500">의료인 검토</legend>
            {DECISIONS.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-1.5 text-gray-800">
                <input
                  type="radio"
                  name="review-decision"
                  aria-label={value}
                  checked={decision === value}
                  onChange={() => setDecision(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="mt-2 flex flex-col gap-2">
            <label htmlFor="guidance-review-note" className="text-xs font-semibold text-gray-500">
              검토 의견
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
              검토 확정
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
