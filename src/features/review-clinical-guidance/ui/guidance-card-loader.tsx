'use client';

/**
 * 저장된 메시지의 guidanceId로 임상 참고안을 조회해 카드 복원 — 새로고침 후에도 표시.
 *
 * **틀이 먼저 선다** (BE docs/specs/57). `guidanceId`가 있다는 사실만으로 그 답변은 참고안이다.
 * 그래서 조회를 기다리지 않고 카드 틀 안에 답변부터 세우고, 조회 상태(대기·실패·데이터)는 같은
 * 카드에 넘긴다. 틀을 조회 결과에 따라 갈아 끼우면 첫 열기마다 화면이 바뀌고, 「이 답변은
 * 참고안이다」가 조회 성공에 달린다 — 실패하면 답변이 참고안의 틀을 잃는다.
 */
import type { ReactElement, ReactNode } from 'react';
import { useClinicalGuidance } from '../api/review-clinical-guidance';
import { GuidanceCard } from './guidance-card';
import type { UiLang } from '@/shared/i18n/ui-lang';

export interface GuidanceCardLoaderProps {
  guidanceId: string;
  /** 이 참고안을 낳은 메시지의 `responseLang` — 카드 내용물의 언어 (BE docs/specs/44) */
  lang?: UiLang;
  /**
   * 이 참고안을 낳은 답변 — 조회 전에도 카드 틀 안에 먼저 선다 (BE docs/specs/57).
   * 본문·인용 칩은 대화 화면이 그려 넘긴다.
   */
  answer?: ReactNode;
}

export function GuidanceCardLoader({
  guidanceId,
  lang,
  answer,
}: GuidanceCardLoaderProps): ReactElement {
  const guidance = useClinicalGuidance(guidanceId);

  // key를 조회 결과로 바꾸지 않는다 — 참고안이 도착해도 **같은 카드**가 채워져야 한다
  return (
    <GuidanceCard
      guidance={guidance.data}
      loadFailed={guidance.isError}
      answer={answer}
      lang={lang}
    />
  );
}
