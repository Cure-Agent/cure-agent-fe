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
import { DESKTOP_MEDIA_QUERY, useMediaQuery } from '@/shared/lib/use-media-query';
import {
  type EvidenceItem,
  EvidenceInspector,
} from '@/widgets/evidence-inspector/evidence-inspector';
import { ChatRoomHeader } from './_components/chat-room-header';
import { EvidenceSheet } from './_components/evidence-sheet';

const LIST_URL = '/assistant';

/**
 * 목록에서 채팅방을 열며 쌓은 기록이라는 표시. `대화 목록으로`가 이 표시를 보고 기록을
 * 되감을지(목록이 바로 뒤에 있다) 목록으로 바꿔 쓸지(딥링크·새로고침이라 뒤가 목록이 아니다)
 * 고른다. Next는 `pushState`에 넘긴 객체에 자기 상태를 덧붙여 보존한다.
 */
const OPENED_FROM_LIST = 'cureOpenedFromList';

function conversationUrl(conversationId: string): string {
  return `${LIST_URL}?conversation=${encodeURIComponent(conversationId)}`;
}

/**
 * 대화 목록 | 질문·스트리밍 답변 | 인용 근거 패널의 조립 (§5.3).
 *
 * 넓은 화면은 셋을 나란히 세우고, 좁은 화면은 목록과 채팅방을 한 화면씩 번갈아 세운다 —
 * 채팅방은 목록을 덮는 전체 화면이고 근거는 인용을 누를 때 올라오는 시트다.
 */
function AssistantScreen(): React.ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  /**
   * 열린 대화의 원천은 URL이다(`?conversation=`). 환자 상세의 「환자 맞춤 대화 시작」도 이
   * 주소로 들어온다(spec 10 기준 9). 좁은 화면에서는 채팅방을 여는 것이 곧 화면 이동이라
   * 기기의 뒤로가기가 목록으로 돌아와야 하고, 그러려면 선택이 기록에 실려야 한다.
   */
  const selectedId = useSearchParams().get('conversation');
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [activeMarker, setActiveMarker] = useState<number | null>(null);
  /**
   * 근거 패널이 딛고 설 **콘텐츠 언어** — 이 스텝이 표시 언어의 원천을 바꾸는 자리다
   * (BE docs/specs/44). 지금 담긴 근거를 넘겨준 메시지의 `responseLang`이며, 아직 아무
   * 메시지도 고르지 않았으면 없다(패널이 UI 토글로 떨어진다).
   */
  const [evidenceLang, setEvidenceLang] = useState<UiLang | undefined>(undefined);
  const [evidenceSheetOpen, setEvidenceSheetOpen] = useState(false);
  /**
   * 좁은 화면에서 목록으로 돌아왔을 때 선택 표시로 남길 대화. 이름 변경·보관·삭제는 선택된
   * 행에만 붙는데, 좁은 화면에서는 대화를 여는 순간 채팅방이 목록을 덮으므로 이것이 없으면
   * 그 세 동작에 닿을 길이 없다.
   */
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(selectedId);

  /**
   * 열린 대화가 바뀌면 근거를 비운다 — 목록을 누른 경우뿐 아니라 기기의 뒤로·앞으로가기도
   * 같다. 렌더 중에 맞추는 이유는 순서다: 새 대화의 `ChatPanel`이 마운트하며 자기 근거를
   * 올려 보내는데(`onEvidenceChange`), effect에서 비우면 그 뒤에 와서 방금 받은 근거를 지운다.
   */
  const [shownId, setShownId] = useState(selectedId);
  if (shownId !== selectedId) {
    setShownId(selectedId);
    if (selectedId) setLastOpenedId(selectedId);
    setEvidence([]);
    setEvidenceLang(undefined);
    setActiveMarker(null);
    setEvidenceSheetOpen(false);
  }

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
      // 넓은 화면은 오른쪽 칸이 이미 보여 준다 — 시트는 그 칸이 없는 화면에서만 띄운다
      if (!isDesktop) setEvidenceSheetOpen(true);
    },
    [isDesktop],
  );

  /**
   * 넓은 화면은 **기록을 쌓지 않는다**(replace) — 목록이 늘 옆에 있어 대화를 고르는 것은 화면
   * 이동이 아니고, 쌓으면 브라우저 뒤로가기가 지나온 대화를 하나씩 되짚게 된다. 주소만
   * 지금 대화로 맞춰 새로고침해도 같은 대화가 열리게 한다.
   *
   * `router.push` 대신 `history`를 직접 쓰는 이유: 주소의 쿼리만 바뀌는 이동이라 서버에서
   * 받아 올 것이 없는데, 라우터 이동은 그래도 왕복을 기다린 뒤에야 화면을 바꾼다. Next는
   * `pushState`·`replaceState`를 가로채 `useSearchParams`를 곧바로 맞춰 준다.
   */
  const handleSelectConversation = useCallback(
    (conversation: ConversationSummary) => {
      const url = conversationUrl(conversation.id);
      if (isDesktop) window.history.replaceState(null, '', url);
      else window.history.pushState({ [OPENED_FROM_LIST]: true }, '', url);
    },
    [isDesktop],
  );

  const handleBackToList = useCallback(() => {
    const state: unknown = window.history.state;
    const openedFromList =
      typeof state === 'object' && state !== null && OPENED_FROM_LIST in state;
    // 목록에서 연 채팅방이면 되감는다 — 새로 쌓으면 기기 뒤로가기가 방금 닫은 채팅방을 다시 연다
    if (openedFromList) window.history.back();
    else window.history.replaceState(null, '', LIST_URL);
  }, []);

  // 목록이 선택으로 들고 있던 대화가 지워졌다 — 열려 있었든(넓은 화면) 방금 닫았든(좁은 화면) 놓는다
  const handleDeleteConversation = useCallback(() => {
    setLastOpenedId(null);
    if (selectedId) window.history.replaceState(null, '', LIST_URL);
  }, [selectedId]);

  const openEvidenceSheet = useCallback(() => setEvidenceSheetOpen(true), []);
  const closeEvidenceSheet = useCallback(() => setEvidenceSheetOpen(false), []);

  const inspector = (
    <EvidenceInspector
      evidence={evidence}
      activeMarker={activeMarker}
      onSelectMarker={setActiveMarker}
      lang={evidenceLang}
    />
  );

  return (
    // h-full(고정 뷰포트) — 각 pane은 min-h-0로 줄어들 수 있어야 내부 스크롤이 생긴다
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr_20rem]">
      {/* 좁은 화면에서 채팅방이 열려 있는 동안 목록은 **보이지만 않게** 둔다(visibility).
          빼 버리면 돌아왔을 때 스크롤이 맨 위로 튄다 — 자리를 지키고 있어야 보던 곳이 남는다 */}
      <div
        className={`min-h-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-3 ${
          selectedId ? 'max-lg:invisible' : ''
        }`}
      >
        <ConversationList
          selectedId={selectedId ?? (isDesktop ? null : lastOpenedId)}
          onSelect={handleSelectConversation}
          onDeleted={handleDeleteConversation}
        />
      </div>

      {selectedId ? (
        // 좁은 화면의 채팅방은 셸의 상단바까지 덮는 전체 화면이다 — 머리가 두 줄로 쌓이지 않게
        <section className="flex min-h-0 flex-col max-lg:fixed max-lg:inset-0 max-lg:z-30 max-lg:bg-white">
          <ChatRoomHeader
            conversationId={selectedId}
            evidenceCount={evidence.length}
            onBack={handleBackToList}
            onShowEvidence={openEvidenceSheet}
          />
          {/* 채팅 패널의 카드 테두리·모서리는 칸일 때의 것이다 — 화면 전체가 된 채팅방에서는 걷는다 */}
          <div className="min-h-0 flex-1 max-lg:*:rounded-none max-lg:*:border-0">
            <ChatPanel
              conversationId={selectedId}
              onEvidenceChange={handleEvidenceChange}
              onSelectMarker={setActiveMarker}
              onShowCitations={handleShowCitations}
            />
          </div>
        </section>
      ) : (
        <div className="hidden items-center justify-center rounded-xl border border-dashed border-gray-300 text-sm text-gray-400 lg:flex">
          {t.pickConversationOrStart}
        </div>
      )}

      {isDesktop
        ? inspector
        : selectedId &&
          evidenceSheetOpen && <EvidenceSheet onClose={closeEvidenceSheet}>{inspector}</EvidenceSheet>}
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
