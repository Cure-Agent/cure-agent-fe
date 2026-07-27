import { EVIDENCE_DETAILS, EvidenceInspector } from 'cure-agent-fe';

/**
 * 폭만 고정하는 레이아웃 글루. 높이는 주지 않는다 — 패널의 h-full 이
 * 높이가 불확정한 부모 안에서는 auto 로 풀려 내용에 맞게 늘어난다.
 * (고정 높이를 주면 목록이 잘린 채로 카드에 박힌다.)
 */
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="w-[380px]">{children}</div>
);

/** 답변에 인용된 근거 3건 — 첫 번째 마커가 선택된 기본 상태. */
export const WithActiveMarker = () => (
  <Frame>
    <EvidenceInspector
      evidence={EVIDENCE_DETAILS}
      activeMarker={1}
      onSelectMarker={() => undefined}
    />
  </Frame>
);

/** 근거는 있으나 아직 마커를 고르지 않은 상태 — 강조 테두리가 없다. */
export const NoSelection = () => (
  <Frame>
    <EvidenceInspector
      evidence={EVIDENCE_DETAILS}
      activeMarker={null}
      onSelectMarker={() => undefined}
    />
  </Frame>
);

/** 질문 전 빈 상태 — 안내 문구만 보인다. */
export const Empty = () => (
  <Frame>
    <EvidenceInspector evidence={[]} activeMarker={null} onSelectMarker={() => undefined} />
  </Frame>
);
