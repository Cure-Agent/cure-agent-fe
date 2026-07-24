'use client';

import { useCallback, useState } from 'react';
import { sendMessageStream } from '@/features/ask-guideline/api/send-message';
import type { EvidenceDetail } from '@/features/ask-guideline/model/stream-state.model';
import { ChatPanel } from '@/features/ask-guideline/ui/chat-panel';
import type { ConversationSummary } from '@/features/manage-conversation/api/conversation.api';
import { ConversationList } from '@/features/manage-conversation/ui/conversation-list';
import { EvidenceInspector } from '@/widgets/evidence-inspector/evidence-inspector';

// sendMessageStream은 ChatPanel 내부에서 사용되지만, 트리셰이킹 경고 방지용 참조가 아니라
// 3단 화면의 조립만 담당한다 (§5.3: 대화 목록 | 질문·스트리밍 답변 | 인용 근거 패널)
void sendMessageStream;

export default function AssistantPage(): React.ReactElement {
  const [selected, setSelected] = useState<ConversationSummary | null>(null);
  const [evidence, setEvidence] = useState<EvidenceDetail[]>([]);
  const [activeMarker, setActiveMarker] = useState<number | null>(null);

  const handleEvidenceChange = useCallback((items: EvidenceDetail[]) => {
    setEvidence(items);
    setActiveMarker(null);
  }, []);

  const handleSelectConversation = useCallback((conversation: ConversationSummary) => {
    setSelected(conversation);
    setEvidence([]);
    setActiveMarker(null);
  }, []);

  return (
    <div className="grid h-[calc(100vh-4rem)] grid-cols-[16rem_1fr_20rem] gap-4">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-3">
        <ConversationList selectedId={selected?.id ?? null} onSelect={handleSelectConversation} />
      </div>

      {selected ? (
        <ChatPanel
          conversationId={selected.id}
          onEvidenceChange={handleEvidenceChange}
          onSelectMarker={setActiveMarker}
        />
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 text-sm text-gray-400">
          왼쪽에서 대화를 선택하거나 새 대화를 시작하세요
        </div>
      )}

      <EvidenceInspector
        evidence={evidence}
        activeMarker={activeMarker}
        onSelectMarker={setActiveMarker}
      />
    </div>
  );
}
