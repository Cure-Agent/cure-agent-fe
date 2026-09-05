// @vitest-environment happy-dom
// wait-elapsed-seconds 작업 2-a 수용 기준 1~8 동결 테스트. 구현 중 수정 금지.
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '../api/send-message';
import type { StreamEvent } from '@/shared/api/stream-client';
import { resetAllStreams } from '../model/stream-store';
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
const QUESTION = '만성 요통에 침 치료가 효과적인가요?';
const NEXT_QUESTION = '허리 통증 운동도 알려 주세요.';
const RETRIEVING_KO = '지침 근거를 검색하는 중…';
const RETRIEVING_EN = 'Searching the guidelines for evidence…';
const KO_ELAPSED = /^\(\d+초\)$/;

type LiveStream = {
  assistantMessageId: string;
  emit: (event: StreamEvent) => void;
  finishRequest: () => void;
};

function setLanguageInputs(navigatorLanguage: string, stored: string | null): void {
  stubNavigatorLanguage(navigatorLanguage);
  stubStoredUiLang(UI_LANG_STORAGE_KEY, stored);
}

function mockEmptyMessages(conversationId: string): void {
  server.use(
    http.get(`/api/v1/conversations/${conversationId}/messages`, () =>
      HttpResponse.json(envelope([], PAGE)),
    ),
  );
}

function holdStreamAtRetrieval(conversationId: string): LiveStream {
  let emit: ((event: StreamEvent) => void) | null = null;
  let resolveRequest: (() => void) | null = null;
  const assistantMessageId = `${conversationId}-assistant`;

  sendMessageStreamMock.mockImplementation((args) => {
    emit = args.onEvent;
    args.onEvent({
      eventType: 'message.accepted',
      requestId: `${conversationId}-request`,
      userMessageId: `${conversationId}-user`,
      assistantMessageId,
    });
    args.onEvent({ eventType: 'retrieval.started' });
    return new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
  });

  return {
    assistantMessageId,
    emit(event) {
      if (!emit) throw new Error('질문 전송 전에 스트림 이벤트를 주입할 수 없습니다.');
      emit(event);
    },
    finishRequest() {
      if (!resolveRequest) throw new Error('질문 전송 전에 스트림을 종결할 수 없습니다.');
      resolveRequest();
      resolveRequest = null;
    },
  };
}

function makeEvidence(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `evidence-${index + 1}`,
    guidelineId: `guideline-${index + 1}`,
    guidelineVersionId: `guideline-version-${index + 1}`,
    guidelineTitle: `요통 진료지침 ${index + 1}`,
    version: '1.0',
    sectionPath: ['치료', `권고 ${index + 1}`],
    excerpt: `근거 문장 ${index + 1}`,
    sourceUrl: `https://example.com/guidelines/${index + 1}`,
  }));
}

function completedEvent(conversationId: string, assistantMessageId: string): StreamEvent {
  return {
    eventType: 'answer.completed',
    message: {
      id: assistantMessageId,
      conversationId,
      role: 'ASSISTANT',
      content: '첫 답변입니다.',
      status: 'COMPLETED',
      citations: [],
      createdAt: new Date().toISOString(),
    },
  } as unknown as StreamEvent;
}

function setupUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

async function advanceElapsed(milliseconds: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

async function sendQuestion(
  conversationId: string,
  controls: { input: string; send: string; retrieving: string } = {
    input: '질문 입력',
    send: '전송',
    retrieving: RETRIEVING_KO,
  },
): Promise<LiveStream> {
  mockEmptyMessages(conversationId);
  const stream = holdStreamAtRetrieval(conversationId);
  const user = setupUser();

  renderWithProviders(<ChatPanel conversationId={conversationId} />);
  await user.type(await screen.findByLabelText(controls.input), QUESTION);
  await user.click(screen.getByRole('button', { name: controls.send }));
  await screen.findByText(controls.retrieving);

  return stream;
}

/**
 * testing-library의 `waitFor`(= `findBy*`)는 가짜 타이머를 **`jest` 전역으로만 감지한다**
 * (`@testing-library/dom/helpers.js`의 `jestFakeTimersAreEnabled`). vitest에는 그 전역이 없어
 * 감지에 실패하고, 폴링에 쓰는 `setInterval`이 이미 얼어붙어 있어 `findBy*`가 영원히 대기한다 —
 * 실제로 8개 테스트가 전부 5초 타임아웃으로 죽었다.
 *
 * `shouldAdvanceTime: true`는 이것을 풀지만 가짜 시계가 **실시간을 따라 흘러**, 기준 1의 999ms
 * 경계가 구현 후 무작위로 넘어간다. 그래서 시계는 완전히 결정적으로 두고, 감지에 필요한
 * 최소 셰임만 세운다.
 */
beforeEach(() => {
  (globalThis as unknown as { jest?: unknown }).jest = {
    advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
  };
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-05T00:00:00.000Z'));
  sendMessageStreamMock.mockReset();
  resetAllStreams();
  setLanguageInputs('ko-KR', null);
});

afterEach(() => {
  cleanup();
  delete (globalThis as unknown as { jest?: unknown }).jest;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ChatPanel 답변 대기 경과 시간 (작업 2-a 수용 기준 1~8)', () => {
  it('기준 1: 1초 미만에는 경과를 표시하지 않고 1초부터 표시한다', async () => {
    await sendQuestion('wait-elapsed-1');

    expect(screen.getByText(RETRIEVING_KO)).toBeTruthy();
    expect(screen.queryByText(KO_ELAPSED)).toBeNull();

    await advanceElapsed(999);

    expect(screen.getByText(RETRIEVING_KO)).toBeTruthy();
    expect(screen.queryByText(KO_ELAPSED)).toBeNull();

    // 1초 경계의 양쪽을 함께 관측해, 스텁에서도 통과하는 공허한 부재 테스트가 되지 않게 한다.
    await advanceElapsed(1);
    expect(screen.getByText('(1초)')).toBeTruthy();
  });

  it('기준 2: 3초 뒤 검색 단계 문구와 경과 시간을 함께 표시한다', async () => {
    await sendQuestion('wait-elapsed-2');

    await advanceElapsed(3_000);

    expect(screen.getByText(RETRIEVING_KO)).toBeTruthy();
    expect(screen.getByText('(3초)')).toBeTruthy();
  });

  it('기준 3: 다음 1초가 지나면 경과 시간을 3초에서 4초로 갱신한다', async () => {
    await sendQuestion('wait-elapsed-3');
    await advanceElapsed(3_000);
    expect(screen.getByText('(3초)')).toBeTruthy();

    await advanceElapsed(1_000);

    expect(screen.getByText('(4초)')).toBeTruthy();
    expect(screen.queryByText('(3초)')).toBeNull();
  });

  it('기준 4: 근거가 도착해 작성 단계로 바뀌어도 3초 경과를 이어 간다', async () => {
    const stream = await sendQuestion('wait-elapsed-4');
    await advanceElapsed(3_000);
    expect(screen.getByText('(3초)')).toBeTruthy();

    act(() => {
      stream.emit({ eventType: 'retrieval.completed', evidence: makeEvidence(2) });
    });

    expect(
      screen.getByText('지침 근거 2건을 바탕으로 답변을 작성하는 중…'),
    ).toBeTruthy();
    expect(screen.getByText('(3초)')).toBeTruthy();
    expect(screen.queryByText('(0초)')).toBeNull();
  });

  it('기준 5: answer.delta가 도착하면 단계와 경과를 숨기고 델타 본문을 표시한다', async () => {
    const stream = await sendQuestion('wait-elapsed-5');
    await advanceElapsed(3_000);

    // delta 직전에 경과 표시가 실제로 있었음을 보장해 사라짐 단언이 공허해지지 않게 한다.
    expect(screen.getByText(RETRIEVING_KO)).toBeTruthy();
    expect(screen.getByText('(3초)')).toBeTruthy();

    act(() => {
      stream.emit({
        eventType: 'answer.delta',
        messageId: stream.assistantMessageId,
        seq: 0,
        delta: '침 치료를 고려할 수 있습니다.',
      });
    });

    expect(screen.queryByText(RETRIEVING_KO)).toBeNull();
    expect(screen.queryByText(KO_ELAPSED)).toBeNull();
    expect(screen.getByText('침 치료를 고려할 수 있습니다.')).toBeTruthy();
  });

  it('기준 6: 경과 시간은 검색 단계 aria-live 영역 밖에서만 표시한다', async () => {
    await sendQuestion('wait-elapsed-6');
    await advanceElapsed(3_000);

    const elapsed = screen.getByText('(3초)');
    const liveRegion = screen
      .getByText(RETRIEVING_KO)
      .closest<HTMLElement>('[aria-live="polite"]');

    expect(liveRegion).not.toBeNull();
    expect(liveRegion).toHaveTextContent(RETRIEVING_KO);
    expect(liveRegion).not.toHaveTextContent(KO_ELAPSED);
    expect(liveRegion).not.toContainElement(elapsed);
    expect(elapsed.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('기준 7: 표시 언어가 en이면 검색 단계와 3초 경과를 영어로 표시한다', async () => {
    setLanguageInputs('ko-KR', 'en');
    await sendQuestion('wait-elapsed-7', {
      input: 'Question',
      send: 'Send',
      retrieving: RETRIEVING_EN,
    });

    await advanceElapsed(3_000);

    expect(screen.getByText(RETRIEVING_EN)).toBeTruthy();
    expect(screen.getByText('(3s)')).toBeTruthy();
  });

  it('기준 8: 스트림 종결 뒤 새 질문을 보내면 경과 시간을 0부터 다시 센다', async () => {
    const conversationId = 'wait-elapsed-8';
    const stream = await sendQuestion(conversationId);
    await advanceElapsed(3_000);
    expect(screen.getByText('(3초)')).toBeTruthy();

    await act(async () => {
      stream.emit(completedEvent(conversationId, stream.assistantMessageId));
      stream.finishRequest();
      await Promise.resolve();
    });

    const user = setupUser();
    await user.type(screen.getByLabelText('질문 입력'), NEXT_QUESTION);
    await user.click(screen.getByRole('button', { name: '전송' }));
    await screen.findByText(RETRIEVING_KO);

    expect(sendMessageStreamMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('(3초)')).toBeNull();
    expect(screen.queryByText(KO_ELAPSED)).toBeNull();
  });
});
