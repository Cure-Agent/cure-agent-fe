import { GUIDELINE_SUMMARIES, GuidelineDetailPanel } from 'cure-agent-fe';

/**
 * 지침 상세 — 서지 정보와 NCKM 원문 링크, 그 아래 섹션·권고문 목록.
 * PDF 원문은 재배포하지 않고 항상 출처 링크로 보낸다.
 */
export const Default = () => (
  <div className="w-[760px] max-w-full">
    <GuidelineDetailPanel guidelineId={GUIDELINE_SUMMARIES[0].id} />
  </div>
);
