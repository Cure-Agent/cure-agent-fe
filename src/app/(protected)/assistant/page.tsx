'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import type {
  AnswerCitation,
  EvidenceDetail,
} from '@/features/ask-guideline/model/stream-state.model';
import { ChatPanel } from '@/features/ask-guideline/ui/chat-panel';
import type { ConversationSummary } from '@/features/manage-conversation/api/conversation.api';
import { ConversationList } from '@/features/manage-conversation/ui/conversation-list';
import {
  type EvidenceItem,
  EvidenceInspector,
} from '@/widgets/evidence-inspector/evidence-inspector';

// 3단 화면의 조립만 담당한다 (§5.3: 대화 목록 | 질문·스트리밍 답변 | 인용 근거 패널)
function AssistantScreen(): React.ReactElement {
  const searchParams = useSearchParams();
  // 환자 상세의 "환자 맞춤 대화 시작"이 /assistant?conversation={id}로 진입한다 (spec 10 기준 9)
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get('conversation'),
  );
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [activeMarker, setActiveMarker] = useState<number | null>(null);

  const handleEvidenceChange = useCallback((items: EvidenceDetail[]) => {
    setEvidence(items);
    setActiveMarker(null);
  }, []);

  // 과거 저장 메시지의 인용 마커 클릭 — 그 메시지의 인용 목록으로 근거 패널을 복원한다
  const handleShowCitations = useCallback(
    (citations: AnswerCitation[], marker: number) => {
      setEvidence(
        citations.map((citation) => ({
          id: citation.evidenceId,
          marker: citation.marker,
          guidelineTitle: citation.guidelineTitle,
          version: citation.guidelineVersion,
          sectionPath: citation.sectionPath,
          excerpt: citation.quote,
        })),
      );
      setActiveMarker(marker);
    },
    [],
  );

  const handleSelectConversation = useCallback((conversation: ConversationSummary) => {
    setSelectedId(conversation.id);
    setEvidence([]);
    setActiveMarker(null);
  }, []);

  return (
    // h-full(고정 뷰포트) — 각 pane은 min-h-0로 줄어들 수 있어야 내부 스크롤이 생긴다
    <div className="grid h-full min-h-0 grid-cols-[16rem_1fr_20rem] gap-4">
      <div className="min-h-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-3">
        <ConversationList selectedId={selectedId} onSelect={handleSelectConversation} />
      </div>

      {selectedId ? (
        <ChatPanel
          conversationId={selectedId}
          onEvidenceChange={handleEvidenceChange}
          onSelectMarker={setActiveMarker}
          onShowCitations={handleShowCitations}
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

export default function AssistantPage(): React.ReactElement {
  // useSearchParams는 prerender 경계에서 Suspense가 필요하다 (Next.js 규약)
  return (
    <Suspense fallback={null}>
      <AssistantScreen />
    </Suspense>
  );
}
