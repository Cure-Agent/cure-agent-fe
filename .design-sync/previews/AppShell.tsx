import {
  AppShell,
  CLINICIAN,
  ChatPanel,
  ConversationList,
  CONVERSATIONS,
  DsPreviewProvider,
  EVIDENCE_DETAILS,
  EvidenceInspector,
  GuidelineListPanel,
} from 'cure-agent-fe';

/**
 * 앱 전체 크롬 — src/app/(protected)/layout.tsx 가 AppShell 로 페이지를 감싸는 구조 그대로다.
 * 활성 내비 항목은 usePathname 으로 결정되므로, 탭을 바꾸려면 pathname 을 준 프로바이더로 다시 감싼다.
 */

/** 어시스턴트 3단 화면 (대화 목록 | 질문·답변 | 인용 근거) — assistant/page.tsx 조립. */
export const AssistantWorkspace = () => (
  <AppShell me={CLINICIAN}>
    <div className="grid h-[calc(100vh-8rem)] grid-cols-[16rem_1fr_20rem] gap-4">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-3">
        <ConversationList
          selectedId={CONVERSATIONS[0].id}
          onSelect={() => undefined}
          onDeleted={() => undefined}
        />
      </div>
      <ChatPanel conversationId={CONVERSATIONS[0].id} onSelectMarker={() => undefined} />
      <EvidenceInspector
        evidence={EVIDENCE_DETAILS}
        activeMarker={1}
        onSelectMarker={() => undefined}
      />
    </div>
  </AppShell>
);

/** 지침 탭이 활성인 상태 — 사이드바 강조가 경로에 따라 옮겨간다. */
export const GuidelinesTab = () => (
  <DsPreviewProvider pathname="/guidelines">
    <AppShell me={CLINICIAN}>
      <section className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">지침 탐색</h1>
        <GuidelineListPanel onSelect={() => undefined} />
      </section>
    </AppShell>
  </DsPreviewProvider>
);
