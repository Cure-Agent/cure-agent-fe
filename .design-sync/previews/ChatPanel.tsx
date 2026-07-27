import { ChatPanel, CONVERSATIONS, EVIDENCE_DETAILS, EvidenceInspector } from 'cure-agent-fe';

/**
 * 질문·스트리밍 답변 패널. 스트리밍/보류/오류 상태는 실제 SSE 진행 중에만 나타나므로
 * 정적 카드로는 담지 않는다 — 여기 담긴 것은 종결된 대화의 모습이다.
 */

/** 인용 마커가 달린 종결 답변. */
export const Conversation = () => (
  <div className="w-[720px] max-w-full">
    <ChatPanel conversationId={CONVERSATIONS[0].id} onSelectMarker={() => undefined} />
  </div>
);

/** 근거 패널과 나란히 둔 실제 배치 — 마커 [n] 클릭이 오른쪽 패널을 강조한다. */
export const WithEvidencePanel = () => (
  <div className="grid w-[1040px] max-w-full grid-cols-[1fr_20rem] gap-4">
    <ChatPanel conversationId={CONVERSATIONS[0].id} onSelectMarker={() => undefined} />
    <EvidenceInspector
      evidence={EVIDENCE_DETAILS}
      activeMarker={1}
      onSelectMarker={() => undefined}
    />
  </div>
);
