import { CLINICAL_GUIDANCE, GuidanceCard } from 'cure-agent-fe';

/** 카드가 대화 스트림 안에서 차지하는 폭에 맞춘 레이아웃 글루. */
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="w-[640px] max-w-full">{children}</div>
);

/**
 * 카드가 품는 답변 (spec 57) — 헤더 아래·검토 항목 위, summary 가 서던 자리에 선다.
 * 앱에서는 대화 화면이 본문과 인용 칩을 그려 넘긴다. 여기서는 본문만 둔다.
 */
const ANSWER = (
  <p className="whitespace-pre-wrap">
    만성 요통에는 침 치료를 우선 고려할 수 있습니다 [1]. 신허요통 변증이 확인되면 한약 병행을
    검토하되, 와파린 복용 중이므로 자침 전에 출혈 위험부터 평가해야 합니다 [2].
  </p>
);

/** 검토 대기(DRAFT) — 의료인 검토 폼이 함께 렌더되는 유일한 상태다. 답변이 카드 안에 선다. */
export const Draft = () => (
  <Frame>
    <GuidanceCard guidance={CLINICAL_GUIDANCE} answer={ANSWER} />
  </Frame>
);

/** 새로고침 직후 — 참고안을 불러오는 동안에도 카드 틀 안에 답변이 먼저 선다 (spec 57). */
export const Pending = () => (
  <Frame>
    <GuidanceCard answer={ANSWER} />
  </Frame>
);

/** 참고안 조회 실패 — 틀과 답변은 그대로 두고 안내 문구만 바뀐다. */
export const LoadFailed = () => (
  <Frame>
    <GuidanceCard answer={ANSWER} loadFailed />
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
