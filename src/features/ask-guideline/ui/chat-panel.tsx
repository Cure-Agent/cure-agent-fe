'use client';

import type { EvidenceDetail } from '../model/stream-state.model';

export interface ChatPanelProps {
  conversationId: string;
  /** retrieval.completed 시 근거 패널(evidence-inspector)로 전달 */
  onEvidenceChange?: (evidence: EvidenceDetail[]) => void;
  /** answer.completed의 citation marker 선택 시 */
  onSelectMarker?: (marker: number) => void;
}

/**
 * 질문 입력(textarea aria-label='질문 입력', 제출 버튼 name='전송') + 메시지 타임라인
 * + 스트리밍 버블 + abstain 안내 + 오류 시 재시도 버튼(name='다시 시도', 새 clientRequestId)
 */
export function ChatPanel(_props: ChatPanelProps): React.ReactElement {
  throw new Error('NOT_IMPLEMENTED');
}
