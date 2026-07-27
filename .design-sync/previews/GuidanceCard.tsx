import { CLINICAL_GUIDANCE, GuidanceCard } from 'cure-agent-fe';

/** 카드가 대화 스트림 안에서 차지하는 폭에 맞춘 레이아웃 글루. */
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="w-[640px] max-w-full">{children}</div>
);

/** 검토 대기(DRAFT) — 의료인 검토 폼이 함께 렌더되는 유일한 상태다. */
export const Draft = () => (
  <Frame>
    <GuidanceCard guidance={CLINICAL_GUIDANCE} />
  </Frame>
);

/** 승인 종결 — 검토는 1회로 끝나므로 폼이 사라지고 상태 배지만 남는다. */
export const Accepted = () => (
  <Frame>
    <GuidanceCard guidance={{ ...CLINICAL_GUIDANCE, reviewStatus: 'ACCEPTED' }} />
  </Frame>
);

/** 반려 종결. */
export const Rejected = () => (
  <Frame>
    <GuidanceCard guidance={{ ...CLINICAL_GUIDANCE, reviewStatus: 'REJECTED' }} />
  </Frame>
);

/** 안전 경고·누락 정보가 없는 최소 참고안 — 섹션이 통째로 빠진 모습. */
export const MinimalDraft = () => (
  <Frame>
    <GuidanceCard
      guidance={{
        ...CLINICAL_GUIDANCE,
        considerations: [CLINICAL_GUIDANCE.considerations[0]],
        safetyAlerts: [],
        missingInformation: [],
      }}
    />
  </Frame>
);
