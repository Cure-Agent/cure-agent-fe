// @vitest-environment happy-dom
// spec 44 — 메시지별 콘텐츠 언어와 UI 표시 언어의 경계를 동결한다.
import { useState } from 'react';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UI_LANG_STORAGE_KEY, type UiLang } from '@/shared/i18n/ui-lang';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import {
  EvidenceInspector,
  type EvidenceItem,
} from '@/widgets/evidence-inspector/evidence-inspector';
import { ChatPanel } from './chat-panel';

useMswServer();

const PAGE = { size: 50, hasNext: false, nextCursor: null };

const KO_TITLE = '골다공증 한의표준임상진료지침';
const EN_TITLE = 'Korean Medicine Clinical Practice Guideline for Osteoporosis';
const KO_QUOTE = '성인 골다공증 환자에게 침 치료를 고려할 수 있다.';
const EN_QUOTE = 'Acupuncture may be considered for adults with osteoporosis.';
const KO_FULL_EXCERPT = '침 치료는 통증과 기능 개선을 위해 고려할 수 있는 치료 선택지이다.';
const EN_FULL_EXCERPT =
  'Acupuncture is a treatment option that may be considered to improve pain and function.';
const KO_SECTION = ['Ⅳ. 권고사항', '1. 침'];
const EN_SECTION = ['IV. Recommendations', '1. Acupuncture'];
const SOURCE_URL = 'https://example.test/nckm/osteoporosis#page=41';

const KO_ANSWER = '한국어 답변: 침 치료를 고려할 수 있습니다 [1].';
const EN_ANSWER = 'English answer: acupuncture may be considered [2].';

const koCitation = {
  marker: 1,
  evidenceId: 'ev-ko',
  guidelineTitle: KO_TITLE,
  guidelineVersion: '1.0',
  sectionPath: KO_SECTION,
  quote: KO_QUOTE,
  sourceUrl: SOURCE_URL,
  quoteTranslated: EN_QUOTE,
  titleTranslated: EN_TITLE,
  sectionPathTranslated: EN_SECTION,
};

const enCitation = {
  marker: 2,
  evidenceId: 'ev-en',
  guidelineTitle: KO_TITLE,
  guidelineVersion: '1.0',
  sectionPath: KO_SECTION,
  quote: KO_QUOTE,
  sourceUrl: SOURCE_URL,
  quoteTranslated: EN_QUOTE,
  titleTranslated: EN_TITLE,
  sectionPathTranslated: EN_SECTION,
};

const koMessage = {
  id: 'assistant-ko',
  role: 'ASSISTANT' as const,
  content: KO_ANSWER,
  status: 'COMPLETED' as const,
  answerKind: 'GUIDELINE_ANSWER' as const,
  citations: [koCitation],
  responseLang: 'ko' as const,
  createdAt: '2026-08-30T09:00:00.000Z',
};

const enMessage = {
  id: 'assistant-en',
  role: 'ASSISTANT' as const,
  content: EN_ANSWER,
  status: 'COMPLETED' as const,
  answerKind: 'GUIDELINE_ANSWER' as const,
  citations: [enCitation],
  responseLang: 'en' as const,
  createdAt: '2026-08-30T09:01:00.000Z',
};

const GENERAL_KO =
  '성인 만성 비특이적 요통 환자에게 침 치료를 할 때, 모든 환자에게 같은 혈자리를 쓰는 표준 처방과 환자별로 달리하는 개별 처방 중 어느 쪽이 권고되나요?';

function setUiLang(lang: UiLang): void {
  stubNavigatorLanguage(lang === 'ko' ? 'ko-KR' : 'en-US');
  stubStoredUiLang(UI_LANG_STORAGE_KEY, lang);
}

function mockConversation(conversationId: string, messages: unknown[]): void {
  server.use(
    http.get(`/api/v1/conversations/${conversationId}`, () =>
      HttpResponse.json(
        envelope({
          id: conversationId,
          title: '언어 경계 대화',
          type: 'GUIDELINE_QA',
          status: 'ACTIVE',
          lastMessageAt: '2026-08-30T09:01:00.000Z',
          createdAt: '2026-08-30T09:00:00.000Z',
        }),
      ),
    ),
    http.get(`/api/v1/conversations/${conversationId}/messages`, () =>
      HttpResponse.json(envelope(messages, PAGE)),
    ),
  );
}

function mockEnglishEvidenceDetail(): void {
  server.use(
    http.get('/api/v1/evidence/ev-en', () =>
      HttpResponse.json(
        envelope({
          id: 'ev-en',
          guidelineId: 'guideline-osteoporosis',
          guidelineVersionId: 'guideline-osteoporosis-v1',
          guidelineTitle: KO_TITLE,
          titleTranslated: EN_TITLE,
          version: '1.0',
          sectionPath: KO_SECTION,
          sectionPathTranslated: EN_SECTION,
          excerpt: KO_FULL_EXCERPT,
          excerptTranslated: EN_FULL_EXCERPT,
          sourceUrl: SOURCE_URL,
        }),
      ),
    ),
  );
}

type ShownEvidence = {
  evidence: EvidenceItem[];
  marker: number;
  lang: UiLang;
};

function ConversationWithInspector({ conversationId }: { conversationId: string }) {
  const [shown, setShown] = useState<ShownEvidence | null>(null);

  return (
    <>
      <ChatPanel
        conversationId={conversationId}
        onShowCitations={(citations, marker, lang) => {
          const evidence: EvidenceItem[] = citations.map((citation) => ({
            id: citation.evidenceId,
            marker: citation.marker,
            guidelineTitle: citation.guidelineTitle,
            titleTranslated: citation.titleTranslated,
            version: citation.guidelineVersion,
            sectionPath: citation.sectionPath,
            sectionPathTranslated: citation.sectionPathTranslated,
            excerpt: citation.quote,
            excerptTranslated: citation.quoteTranslated,
            sourceUrl: citation.sourceUrl,
          }));
          setShown({ evidence, marker, lang });
        }}
      />
      {shown ? (
        <EvidenceInspector
          evidence={shown.evidence}
          activeMarker={shown.marker}
          onSelectMarker={vi.fn()}
          lang={shown.lang}
        />
      ) : null}
    </>
  );
}

function directEnglishEvidence(): EvidenceItem {
  return {
    id: 'ev-example-boundary',
    marker: 9,
    guidelineTitle: KO_TITLE,
    titleTranslated: EN_TITLE,
    version: '1.0',
    sectionPath: KO_SECTION,
    sectionPathTranslated: EN_SECTION,
    excerpt: KO_QUOTE,
    excerptTranslated: EN_QUOTE,
    sourceUrl: SOURCE_URL,
  };
}

beforeEach(() => {
  setUiLang('ko');
});

afterEach(() => {
  cleanup();
});

describe('ChatPanel 메시지별 콘텐츠 언어 (spec 44)', () => {
  it('기준 25-a·25-b·25-c: 한국어 UI에서도 영문 답변에서 연 인용 카드와 전문까지 영문이다', async () => {
    mockConversation('conversation-25', [enMessage]);
    mockEnglishEvidenceDetail();
    const user = userEvent.setup();

    renderWithProviders(<ConversationWithInspector conversationId="conversation-25" />);

    const marker = await screen.findByRole('button', { name: '[2]' });
    expect(document.body).toHaveTextContent('English answer: acupuncture may be considered');

    await user.click(marker);
    expect(screen.getByText(EN_TITLE)).toBeTruthy();
    expect(screen.getByText(EN_QUOTE)).toBeTruthy();
    expect(screen.queryByText(KO_TITLE)).toBeNull();
    expect(screen.queryByText(KO_QUOTE)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Show full text' }));
    expect(await screen.findByText(EN_FULL_EXCERPT)).toBeTruthy();
    expect(screen.queryByText(KO_FULL_EXCERPT)).toBeNull();
  });

  it('기준 26-a·26-b·대칭: 같은 메시지는 UI 토글을 바꿔도 자기 responseLang의 내용을 유지한다', async () => {
    mockConversation('conversation-26-en', [enMessage]);
    const user = userEvent.setup();

    setUiLang('ko');
    renderWithProviders(<ConversationWithInspector conversationId="conversation-26-en" />);
    await user.click(await screen.findByRole('button', { name: '[2]' }));
    expect(screen.getByText(EN_TITLE)).toBeTruthy();
    expect(screen.getByText(EN_QUOTE)).toBeTruthy();

    cleanup();
    setUiLang('en');
    renderWithProviders(<ConversationWithInspector conversationId="conversation-26-en" />);
    await user.click(await screen.findByRole('button', { name: '[2]' }));
    expect(screen.getByText(EN_TITLE)).toHaveTextContent(EN_TITLE);
    expect(screen.getByText(EN_QUOTE)).toHaveTextContent(EN_QUOTE);

    cleanup();
    mockConversation('conversation-26-ko', [koMessage]);
    setUiLang('en');
    renderWithProviders(<ConversationWithInspector conversationId="conversation-26-ko" />);
    await user.click(await screen.findByRole('button', { name: '[1]' }));
    expect(screen.getByText(KO_TITLE)).toBeTruthy();
    expect(screen.getByText(KO_QUOTE)).toBeTruthy();
    expect(screen.queryByText(EN_TITLE)).toBeNull();
    expect(screen.queryByText(EN_QUOTE)).toBeNull();
  });

  it('기준 27-a·27-b: 한 대화의 ko·en 블록은 각 인용을 자기 언어로 열고 서로의 언어를 누출하지 않는다', async () => {
    mockConversation('conversation-27', [koMessage, enMessage]);
    const user = userEvent.setup();

    renderWithProviders(<ConversationWithInspector conversationId="conversation-27" />);

    await user.click(await screen.findByRole('button', { name: '[1]' }));
    expect(screen.getByText(KO_TITLE)).toBeTruthy();
    expect(screen.getByText(KO_QUOTE)).toBeTruthy();
    expect(screen.queryByText(EN_QUOTE)).toBeNull();

    await user.click(screen.getByRole('button', { name: '[2]' }));
    expect(await screen.findByText(EN_TITLE)).toBeTruthy();
    expect(screen.getByText(EN_QUOTE)).toBeTruthy();
    expect(screen.queryByText(KO_TITLE)).toBeNull();
    expect(screen.queryByText(KO_QUOTE)).toBeNull();
  });

  it('기준 29-c: 질문 입력 라벨·전송 버튼은 한국어 UI를 따르면서 옆 인용 내용은 영문 메시지를 따른다', async () => {
    mockConversation('conversation-29-c', [enMessage]);
    const user = userEvent.setup();

    renderWithProviders(<ConversationWithInspector conversationId="conversation-29-c" />);
    await user.click(await screen.findByRole('button', { name: '[2]' }));

    expect(screen.getByLabelText('질문 입력')).toBeTruthy();
    expect(screen.getByRole('button', { name: '전송' })).toBeTruthy();
    expect(screen.getByText(EN_TITLE)).toBeTruthy();
    expect(screen.getByText(EN_QUOTE)).toBeTruthy();
    expect(screen.queryByText(KO_QUOTE)).toBeNull();
  });

  it('기준 29-d: 예시 질의문은 한국어 UI를 따르면서 같은 화면의 영문 콘텐츠 카드는 영문을 유지한다', async () => {
    mockConversation('conversation-29-d', []);

    renderWithProviders(
      <>
        <ChatPanel conversationId="conversation-29-d" />
        <EvidenceInspector
          evidence={[directEnglishEvidence()]}
          activeMarker={null}
          onSelectMarker={vi.fn()}
          lang="en"
        />
      </>,
    );

    const examples = await screen.findByRole('list', { name: '예시 질의문' });
    expect(within(examples).getByRole('button', { name: GENERAL_KO })).toBeTruthy();
    expect(screen.getByText(EN_TITLE)).toBeTruthy();
    expect(screen.getByText(EN_QUOTE)).toBeTruthy();
    expect(screen.queryByText(KO_QUOTE)).toBeNull();
  });
});
