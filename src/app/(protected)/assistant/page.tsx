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
import { messagesFor } from '@/shared/i18n/messages';
import { type UiLang, useUiLang } from '@/shared/i18n/ui-lang';
import {
  type EvidenceItem,
  EvidenceInspector,
} from '@/widgets/evidence-inspector/evidence-inspector';

// 3단 화면의 조립만 담당한다 (§5.3: 대화 목록 | 질문·스트리밍 답변 | 인용 근거 패널)
function AssistantScreen(): React.ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const searchParams = useSearchParams();
  // 환자 상세의 "환자 맞춤 대화 시작"이 /assistant?conversation={id}로 진입한다 (spec 10 기준 9)
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get('conversation'),
  );
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [activeMarker, setActiveMarker] = useState<number | null>(null);
  /**
   * 근거 패널이 딛고 설 **콘텐츠 언어** — 이 스텝이 표시 언어의 원천을 바꾸는 자리다
   * (BE docs/specs/44). 지금 담긴 근거를 넘겨준 메시지의 `responseLang`이며, 아직 아무
   * 메시지도 고르지 않았으면 없다(패널이 UI 토글로 떨어진다).
   */
  const [evidenceLang, setEvidenceLang] = useState<UiLang | undefined>(undefined);

  const handleEvidenceChange = useCallback((items: EvidenceDetail[], lang: UiLang) => {
    setEvidence(items);
    setEvidenceLang(lang);
    setActiveMarker(null);
  }, []);

  // 과거 저장 메시지의 인용 마커 클릭 — 그 메시지의 인용 목록으로 근거 패널을 복원한다
  const handleShowCitations = useCallback(
    (citations: AnswerCitation[], marker: number, lang: UiLang) => {
      setEvidence(
        citations.map((citation) => ({
          id: citation.evidenceId,
          marker: citation.marker,
          guidelineTitle: citation.guidelineTitle,
          version: citation.guidelineVersion,
          sectionPath: citation.sectionPath,
          excerpt: citation.quote,
          // 저장된 인용의 번역은 quote 쪽에 실려 온다 — 근거 카드는 스트림 경로의
          // excerptTranslated와 같은 자리로 본다 (BE docs/specs/42)
          excerptTranslated: citation.quoteTranslated,
          titleTranslated: citation.titleTranslated,
          // 헤더가 `제목 · v… · 섹션경로` 한 줄이라 셋이 같은 축에 서야 한다 (§44)
          sectionPathTranslated: citation.sectionPathTranslated,
          // 정본 도달 경로 — 「한국어 원문 보기」 토글을 대신한다 (§44)
          sourceUrl: citation.sourceUrl,
        })),
      );
      setEvidenceLang(lang);
      setActiveMarker(marker);
    },
    [],
  );

  const handleSelectConversation = useCallback((conversation: ConversationSummary) => {
    setSelectedId(conversation.id);
    setEvidence([]);
    setEvidenceLang(undefined);
    setActiveMarker(null);
  }, []);

  // 열려 있던 대화가 지워지면 채팅·근거 패널이 없는 대화를 붙들고 있게 된다
  const handleDeleteConversation = useCallback(() => {
    setSelectedId(null);
    setEvidence([]);
    setEvidenceLang(undefined);
    setActiveMarker(null);
  }, []);

  return (
    // h-full(고정 뷰포트) — 각 pane은 min-h-0로 줄어들 수 있어야 내부 스크롤이 생긴다
    <div className="grid h-full min-h-0 grid-cols-[16rem_1fr_20rem] gap-4">
      <div className="min-h-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-3">
        <ConversationList
          selectedId={selectedId}
          onSelect={handleSelectConversation}
          onDeleted={handleDeleteConversation}
        />
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
          {t.pickConversationOrStart}
        </div>
      )}

      <EvidenceInspector
        evidence={evidence}
        activeMarker={activeMarker}
        onSelectMarker={setActiveMarker}
        lang={evidenceLang}
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
