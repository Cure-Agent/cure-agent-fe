'use client';

import type { PatientSummary } from '../api/patient.api';

export interface PatientListPanelProps {
  onSelect: (patient: PatientSummary) => void;
}

/** 검색 폼(input aria-label='환자 검색', 버튼 name='검색') + 환자 항목 버튼(aria-label=caseLabel) */
export function PatientListPanel(_props: PatientListPanelProps): React.ReactElement {
  throw new Error('NOT_IMPLEMENTED');
}
