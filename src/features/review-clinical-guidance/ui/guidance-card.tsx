'use client';

/**
 * 임상 가이던스 카드 + 의료인 검토 폼 (docs/specs/10 기준 10~12).
 * summary·considerations·safetyAlerts·missingInformation·reviewStatus 배지와
 * 검토(ACCEPTED/MODIFIED/REJECTED + note) 제출, 409 안내를 담당한다.
 */
import type { ReactElement } from 'react';
import type { ClinicalGuidance } from '../api/review-clinical-guidance';

export interface GuidanceCardProps {
  guidance: ClinicalGuidance;
}

export function GuidanceCard(_props: GuidanceCardProps): ReactElement {
  throw new Error('NOT_IMPLEMENTED');
}
