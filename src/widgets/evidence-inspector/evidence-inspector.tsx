'use client';

import type { components } from '@/shared/api/generated/schema';

export type EvidenceItem = components['schemas']['EvidenceDetailResponseDto'];

export interface EvidenceInspectorProps {
  /** retrieval 순서 = marker 순서 (index + 1 = marker, §8) */
  evidence: EvidenceItem[];
  activeMarker: number | null;
  onSelectMarker: (marker: number) => void;
}

/**
 * 근거 패널 (assistant·guidelines 공용 widget).
 * 각 항목: [n] 마커 + guidelineTitle + excerpt. 활성 항목은 aria-current="true".
 */
export function EvidenceInspector(_props: EvidenceInspectorProps): React.ReactElement {
  throw new Error('NOT_IMPLEMENTED');
}
