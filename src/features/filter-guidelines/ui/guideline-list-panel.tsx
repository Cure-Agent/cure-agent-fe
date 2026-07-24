'use client';

import type { GuidelineSummary } from '../api/guideline.api';

export interface GuidelineListPanelProps {
  onSelect: (guideline: GuidelineSummary) => void;
}

/** 검색 폼(input aria-label='지침 검색', 제출 버튼 name='검색') + 지침 항목 버튼 목록 */
export function GuidelineListPanel(_props: GuidelineListPanelProps): React.ReactElement {
  throw new Error('NOT_IMPLEMENTED');
}
