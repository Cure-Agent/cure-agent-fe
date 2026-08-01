'use client';

/** 저장된 메시지의 guidanceId로 임상 참고안을 조회해 카드 복원 — 새로고침 후에도 표시 */
import type { ReactElement } from 'react';
import { useClinicalGuidance } from '../api/review-clinical-guidance';
import { GuidanceCard } from './guidance-card';

export interface GuidanceCardLoaderProps {
  guidanceId: string;
}

export function GuidanceCardLoader({ guidanceId }: GuidanceCardLoaderProps): ReactElement | null {
  const guidance = useClinicalGuidance(guidanceId);

  if (guidance.isPending) {
    return <p className="text-sm text-gray-400">임상 참고안 불러오는 중…</p>;
  }
  if (guidance.isError || !guidance.data) {
    return <p className="text-sm text-red-500">임상 참고안을 불러오지 못했습니다</p>;
  }
  return <GuidanceCard key={guidance.data.id} guidance={guidance.data} />;
}
