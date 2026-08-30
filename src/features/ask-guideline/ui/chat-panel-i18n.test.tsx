// @vitest-environment happy-dom
// spec 42 다국어 대화 경로 — 표시된 예시와 실제 전송 언어 계약을 함께 동결한다
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '../api/send-message';
import { UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';

const sendMessageStreamMock = vi.hoisted(() =>
  vi.fn<(args: SendMessageArgs) => Promise<void>>(),
);

vi.mock('../api/send-message', () => ({
  sendMessageStream: sendMessageStreamMock,
}));

import { ChatPanel } from './chat-panel';

useMswServer();

const PAGE = { size: 50, hasNext: false, nextCursor: null };

const GENERAL_KO = [
  '성인 만성 비특이적 요통 환자에게 침 치료를 할 때, 모든 환자에게 같은 혈자리를 쓰는 표준 처방과 환자별로 달리하는 개별 처방 중 어느 쪽이 권고되나요?',
  '성인 원발성 불면 환자에서 불면 증상 개선을 위해 고려할 수 있는 한약 처방은 무엇인가요?',
  '편두통 환자에서 전침치료를 고려할 때, 일반적인 양약치료보다 증상 호전이나 두통 강도 완화에 도움이 될 수 있는가?',
] as const;

const GENERAL_EN = [
  'For adult patients with chronic nonspecific low back pain, when providing acupuncture treatment, is a standardized prescription using the same acupoints for all patients or an individualized prescription tailored to each patient recommended?',
  'What herbal medicine prescription can be considered to improve insomnia symptoms in adult patients with primary insomnia?',
  'In patients with migraine, when considering electroacupuncture treatment, can it help improve symptoms or relieve headache intensity compared with conventional medication treatment?',
] as const;

function setLanguageInputs(navigatorLanguage: string, stored: string | null): void {
  stubNavigatorLanguage(navigatorLanguage);
  stubStoredUiLang(UI_LANG_STORAGE_KEY, stored);
}

function mockEmptyGuidelineConversation(): void {
  server.use(
    http.get('/api/v1/conversations/conversation-1', () =>
      HttpResponse.json(
        envelope({
          id: 'conversation-1',
          title: '새 대화',
          type: 'GUIDELINE_QA',
          status: 'ACTIVE',
          lastMessageAt: '2026-08-28T10:00:00.000Z',
          createdAt: '2026-08-28T10:00:00.000Z',
        }),
      ),
    ),
    http.get('/api/v1/conversations/conversation-1/messages', () =>
      HttpResponse.json(envelope([], PAGE)),
    ),
  );
}

beforeEach(() => {
  sendMessageStreamMock.mockReset();
  sendMessageStreamMock.mockResolvedValue(undefined);
  setLanguageInputs('ko-KR', null);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ChatPanel 다국어 예시 질의문 (수용 기준 30-d·e, 31)', () => {
  it('기준 30-d·e: 예시 목록은 한국어 경로를 유지하고 영문 UI에서는 같은 자리의 영문을 표시한다', async () => {
    mockEmptyGuidelineConversation();
    setLanguageInputs('ko-KR', null);
    renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    const koreanList = await screen.findByRole('list', { name: '예시 질의문' });
    expect(within(koreanList).getAllByRole('button').map((item) => item.textContent)).toEqual(
      GENERAL_KO,
    );

    cleanup();
    setLanguageInputs('en-US', null);
    renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    const englishList = await screen.findByRole('list', { name: 'Example questions' });
    expect(within(englishList).getAllByRole('button').map((item) => item.textContent)).toEqual(
      GENERAL_EN,
    );
  });

  it('기준 31: 영문 예시를 누르면 보이는 영문 그대로 채우고 한국어로 바꾸거나 즉시 전송하지 않는다', async () => {
    mockEmptyGuidelineConversation();
    setLanguageInputs('en-US', null);
    const user = userEvent.setup();
    renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    await user.click(await screen.findByRole('button', { name: GENERAL_EN[0] }));

    const input = screen.getByLabelText('Question');
    expect(input).toHaveValue(GENERAL_EN[0]);
    expect(input).not.toHaveValue(GENERAL_KO[0]);
    expect(sendMessageStreamMock).not.toHaveBeenCalled();
  });
});

describe('ChatPanel 답변 언어 전송 (수용 기준 32-e~g)', () => {
  it('기준 32-e: 한국어 UI에서 영문 질문을 보내도 responseLang은 en이다', async () => {
    mockEmptyGuidelineConversation();
    setLanguageInputs('ko-KR', null);
    const user = userEvent.setup();
    renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    const question = 'Can acupuncture help adults with chronic low back pain?';
    await user.type(await screen.findByLabelText('질문 입력'), question);
    await user.click(screen.getByRole('button', { name: '전송' }));

    await waitFor(() => expect(sendMessageStreamMock).toHaveBeenCalledTimes(1));
    expect(sendMessageStreamMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({ content: question, responseLang: 'en' }),
    );
  });

  it('기준 32-f: 영문 UI에서 한국어 질문을 보내면 responseLang은 ko다', async () => {
    mockEmptyGuidelineConversation();
    setLanguageInputs('en-US', null);
    const user = userEvent.setup();
    renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    const question = '만성 요통에 침 치료가 도움이 되나요?';
    await user.type(await screen.findByLabelText('Question'), question);
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sendMessageStreamMock).toHaveBeenCalledTimes(1));
    expect(sendMessageStreamMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({ content: question, responseLang: 'ko' }),
    );
  });

  it('기준 32-g: 전송 계층은 받은 responseLang만 실제 JSON 본문에 조건부로 싣는다', async () => {
    setLanguageInputs('ja-JP', 'en');
    const requestBodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        // 본문 없는 Response는 stream-client가 `스트림 본문이 없습니다`로 먼저 던져
        // 단언에 닿지 못한다 — 이벤트를 만들지 않는 주석 프레임 하나로 스트림을 연다
        return new Response(': ping\n\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }),
    );
    // 이 항목은 ChatPanel용 모듈 mock을 우회해 실제 전송 함수를 검증한다.
    const actual = await vi.importActual<typeof import('../api/send-message')>(
      '../api/send-message',
    );

    await actual.sendMessageStream({
      conversationId: 'conversation-1',
      content: 'English question',
      clientRequestId: 'request-en',
      responseLang: 'en',
      onEvent: vi.fn(),
    });
    await actual.sendMessageStream({
      conversationId: 'conversation-1',
      content: '기존 클라이언트 질문',
      clientRequestId: 'request-default',
      onEvent: vi.fn(),
    });

    expect(requestBodies).toHaveLength(2);
    expect(Object.prototype.hasOwnProperty.call(requestBodies[1], 'responseLang')).toBe(false);
    expect(requestBodies[0]).toEqual({
      content: 'English question',
      clientRequestId: 'request-en',
      responseLang: 'en',
    });
  });
});
