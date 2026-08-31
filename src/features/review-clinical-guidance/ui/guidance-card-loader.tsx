'use client';

/** 저장된 메시지의 guidanceId로 임상 참고안을 조회해 카드 복원 — 새로고침 후에도 표시 */
import type { ReactElement } from 'react';
import { useClinicalGuidance } from '../api/review-clinical-guidance';
import { GuidanceCard } from './guidance-card';
import { formatMessage, messagesFor } from '@/shared/i18n/messages';
import { type UiLang, useUiLang } from '@/shared/i18n/ui-lang';

export interface GuidanceCardLoaderProps {
  guidanceId: string;
  /** 이 참고안을 낳은 메시지의 `responseLang` — 카드 내용물의 언어 (BE docs/specs/44) */
  lang?: UiLang;
}

export function GuidanceCardLoader({ guidanceId }: GuidanceCardLoaderProps): ReactElement | null {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const guidance = useClinicalGuidance(guidanceId);

  if (guidance.isPending) {
    return <p className="text-sm text-gray-400">{t.guidanceLoading}</p>;
  }
  if (guidance.isError || !guidance.data) {
    return <p className="text-sm text-red-500">{t.guidanceLoadFailed}</p>;
  }
  return <GuidanceCard key={guidance.data.id} guidance={guidance.data} />;
}
