// @vitest-environment happy-dom
// spec 46 FE 수용 기준 23~30 동결 테스트. 구현 중 수정 금지.
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
const DELTA_TEXT = '침 치료를 고려할 수 있습니다.';

const ANALYZING_KO = '질문을 분석하는 중…';
const EMBEDDED_KO = '지침을 검색하는 중…';
const SEARCHED_42_KO = '후보 42건에서 근거를 고르는 중…';
const SEARCHED_7_KO = '후보 7건에서 근거를 고르는 중…';
const RERANKED_KO = '근거를 정리하는 중…';
const GENERATING_2_KO = '지침 근거 2건을 바탕으로 답변을 작성하는 중…';

const ANALYZING_EN = 'Analyzing your question…';
const EMBEDDED_EN = 'Searching the guidelines…';
const SEARCHED_42_EN = 'Selecting evidence from 42 candidates…';
const RERANKED_EN = 'Organizing the evidence…';
const GENERATING_2_EN = 'Drafting the answer from 2 guideline sources…';

const EN_CONTROLS = {
  input: 'Question',
  send: 'Send',
  waiting: ANALYZING_EN,
};

type LiveStream = {
  assistantMessageId: string;
  emit: (event: StreamEvent) => void;
};

function setLanguageInputs(navigatorLanguage: string, stored: string | null): void {
  stubNavigatorLanguage(navigatorLanguage);
  stubStoredUiLang(UI_LANG_STORAGE_KEY, stored);
}

function mockEmptyMessages(conversationId: string): void {
  server.use(
    http.get('/api/v1/conversations/' + conversationId + '/messages', () =>
      HttpResponse.json(envelope([], PAGE)),
    ),
  );
}

function holdStreamAtRetrieval(conversationId: string): LiveStream {
  let emit: ((event: StreamEvent) => void) | null = null;
  const assistantMessageId = conversationId + '-assistant';

  sendMessageStreamMock.mockImplementation((args) => {
    emit = args.onEvent;
    args.onEvent({
      eventType: 'message.accepted',
      requestId: conversationId + '-request',
      userMessageId: conversationId + '-user',
      assistantMessageId,
    });
    args.onEvent({ eventType: 'retrieval.started' });

    // 스트림이 살아 있는 동안 단계 이벤트를 직접 주입할 수 있도록 영원히 pending으로 둔다.
    return new Promise<void>(() => {});
  });

  return {
    assistantMessageId,
    emit(event) {
      if (!emit) throw new Error('질문 전송 전에 스트림 이벤트를 주입할 수 없습니다.');
      emit(event);
    },
  };
}

function makeEvidence(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: 'evidence-' + (index + 1),
    guidelineId: 'guideline-' + (index + 1),
    guidelineVersionId: 'guideline-version-' + (index + 1),
    guidelineTitle: '요통 진료지침 ' + (index + 1),
    version: '1.0',
    sectionPath: ['치료', '권고 ' + (index + 1)],
    excerpt: '근거 문장 ' + (index + 1),
    sourceUrl: 'https://example.com/guidelines/' + (index + 1),
  }));
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
  controls: { input: string; send: string; waiting: string } = {
    input: '질문 입력',
    send: '전송',
    waiting: ANALYZING_KO,
  },
): Promise<LiveStream> {
  mockEmptyMessages(conversationId);
  const stream = holdStreamAtRetrieval(conversationId);
  const user = setupUser();

  renderWithProviders(<ChatPanel conversationId={conversationId} />);
  await user.type(await screen.findByLabelText(controls.input), QUESTION);
  await user.click(screen.getByRole('button', { name: controls.send }));
  await screen.findByText(controls.waiting);

  return stream;
}

async function assertGeneratingCount(
  conversationId: string,
  count: number,
  expected: string,
): Promise<void> {
  const stream = await sendQuestion(conversationId);

  act(() => {
    stream.emit({ eventType: 'retrieval.progress', stage: 'reranked' });
  });
  expect(screen.getByText(RERANKED_KO)).toBeTruthy();

  act(() => {
    stream.emit({ eventType: 'retrieval.completed', evidence: makeEvidence(count) });
  });

  // retrieval.completed만으로 stage 문구를 건너뛰지 않아야 answer.started의 경계가 관측된다.
  expect(screen.getByText(RERANKED_KO)).toBeTruthy();
  expect(screen.queryByText(expected)).toBeNull();

  act(() => {
    stream.emit({ eventType: 'answer.started' });
  });

  expect(screen.getByText(expected)).toBeTruthy();
  expect(screen.queryByText(RERANKED_KO)).toBeNull();
}

/**
 * testing-library의 findBy 계열은 가짜 타이머를 jest 전역으로 감지한다.
 * 시계는 결정적으로 멈춘 채 유지하고, 감지와 user-event 진행에 필요한 최소 셰임만 둔다.
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

describe('ChatPanel spec 46 스트림 진행 단계 (FE 수용 기준 23~30)', () => {
  it('기준 23-a: embedded가 오면 검색 문구를 바꾸고 직전 문구를 제거한다', async () => {
    const stream = await sendQuestion('spec-46-stage-23-a');
    expect(screen.getByText(ANALYZING_KO)).toBeTruthy();

    act(() => {
      stream.emit({ eventType: 'retrieval.progress', stage: 'embedded' });
    });

    expect(screen.getByText(EMBEDDED_KO)).toBeTruthy();
    expect(screen.queryByText(ANALYZING_KO)).toBeNull();
  });

  it('기준 23-b: searched는 실제 candidates 수를 표시하고 직전 단계 문구를 제거한다', async () => {
    const stream = await sendQuestion('spec-46-stage-23-b');

    act(() => {
      stream.emit({ eventType: 'retrieval.progress', stage: 'embedded' });
    });
    expect(screen.getByText(EMBEDDED_KO)).toBeTruthy();

    act(() => {
      stream.emit({
        eventType: 'retrieval.progress',
        stage: 'searched',
        candidates: 42,
      });
    });

    expect(screen.getByText(SEARCHED_42_KO)).toBeTruthy();
    expect(screen.queryByText(EMBEDDED_KO)).toBeNull();

    act(() => {
      stream.emit({
        eventType: 'retrieval.progress',
        stage: 'searched',
        candidates: 7,
      });
    });

    expect(screen.getByText(SEARCHED_7_KO)).toBeTruthy();
    expect(screen.queryByText(SEARCHED_42_KO)).toBeNull();
  });

  it('기준 23-c: reranked가 오면 근거 정리 문구를 표시하고 searched 문구를 제거한다', async () => {
    const stream = await sendQuestion('spec-46-stage-23-c');

    act(() => {
      stream.emit({
        eventType: 'retrieval.progress',
        stage: 'searched',
        candidates: 42,
      });
    });
    expect(screen.getByText(SEARCHED_42_KO)).toBeTruthy();

    act(() => {
      stream.emit({ eventType: 'retrieval.progress', stage: 'reranked' });
    });

    expect(screen.getByText(RERANKED_KO)).toBeTruthy();
    expect(screen.queryByText(SEARCHED_42_KO)).toBeNull();
  });

  it('기준 24-b: answer.started에서 evidence 2건·3건의 작성 문구로 바뀐다', async () => {
    await assertGeneratingCount(
      'spec-46-stage-24-b-count-2',
      2,
      '지침 근거 2건을 바탕으로 답변을 작성하는 중…',
    );

    cleanup();

    await assertGeneratingCount(
      'spec-46-stage-24-b-count-3',
      3,
      '지침 근거 3건을 바탕으로 답변을 작성하는 중…',
    );
    expect(
      screen.queryByText('지침 근거 2건을 바탕으로 답변을 작성하는 중…'),
    ).toBeNull();
  });

  it('기준 25: generating에는 대기 문구만 있고 델타 본문과 스트리밍 커서는 없다', async () => {
    const stream = await sendQuestion('spec-46-stage-25');

    act(() => {
      stream.emit({ eventType: 'retrieval.progress', stage: 'reranked' });
      stream.emit({ eventType: 'retrieval.completed', evidence: makeEvidence(2) });
    });
    expect(screen.getByText(RERANKED_KO)).toBeTruthy();

    act(() => {
      stream.emit({ eventType: 'answer.started' });
    });

    expect(screen.getByText(GENERATING_2_KO)).toBeTruthy();
    expect(screen.queryByText(DELTA_TEXT)).toBeNull();
    expect(document.body).not.toHaveTextContent('▍');

    // 이후 실제 delta에서 둘 다 나타나는 양성 대조로, 위 부재 단언이 공허하지 않게 한다.
    act(() => {
      stream.emit({
        eventType: 'answer.delta',
        messageId: stream.assistantMessageId,
        seq: 0,
        delta: DELTA_TEXT,
      });
    });

    expect(screen.getByText(DELTA_TEXT)).toBeTruthy();
    expect(document.body).toHaveTextContent('▍');
  });

  it('기준 26: answer.started 뒤 첫 delta에서 모든 대기 문구가 사라지고 본문으로 넘어간다', async () => {
    const stream = await sendQuestion('spec-46-stage-26');

    act(() => {
      stream.emit({ eventType: 'retrieval.progress', stage: 'reranked' });
      stream.emit({ eventType: 'retrieval.completed', evidence: makeEvidence(2) });
    });
    expect(screen.getByText(RERANKED_KO)).toBeTruthy();

    act(() => {
      stream.emit({ eventType: 'answer.started' });
    });
    expect(screen.getByText(GENERATING_2_KO)).toBeTruthy();

    act(() => {
      stream.emit({
        eventType: 'answer.delta',
        messageId: stream.assistantMessageId,
        seq: 0,
        delta: DELTA_TEXT,
      });
    });

    expect(screen.queryByText(ANALYZING_KO)).toBeNull();
    expect(screen.queryByText(EMBEDDED_KO)).toBeNull();
    expect(screen.queryByText(SEARCHED_42_KO)).toBeNull();
    expect(screen.queryByText(RERANKED_KO)).toBeNull();
    expect(screen.queryByText(GENERATING_2_KO)).toBeNull();
    expect(screen.getByText(DELTA_TEXT)).toBeTruthy();
  });

  it('기준 28-a: 3초 뒤 embedded로 바뀌어도 경과 시간은 3초에서 이어진다', async () => {
    const stream = await sendQuestion('spec-46-stage-28-a');
    await advanceElapsed(3_000);
    expect(screen.getByText('(3초)')).toBeTruthy();

    act(() => {
      stream.emit({ eventType: 'retrieval.progress', stage: 'embedded' });
    });

    expect(screen.getByText(EMBEDDED_KO)).toBeTruthy();
    expect(screen.queryByText(ANALYZING_KO)).toBeNull();
    expect(screen.getByText('(3초)')).toBeTruthy();
    expect(screen.queryByText('(0초)')).toBeNull();
  });

  it('기준 28-b: 5초 뒤 generating으로 바뀌어도 작성 문구와 5초 경과가 함께 남는다', async () => {
    const stream = await sendQuestion('spec-46-stage-28-b');
    await advanceElapsed(3_000);

    act(() => {
      stream.emit({ eventType: 'retrieval.progress', stage: 'embedded' });
    });
    expect(screen.getByText(EMBEDDED_KO)).toBeTruthy();
    expect(screen.getByText('(3초)')).toBeTruthy();

    await advanceElapsed(2_000);
    expect(screen.getByText('(5초)')).toBeTruthy();
    expect(screen.queryByText('(3초)')).toBeNull();

    act(() => {
      stream.emit({ eventType: 'retrieval.completed', evidence: makeEvidence(2) });
      stream.emit({ eventType: 'answer.started' });
    });

    expect(screen.getByText(GENERATING_2_KO)).toBeTruthy();
    expect(screen.getByText('(5초)')).toBeTruthy();
    expect(screen.queryByText('(0초)')).toBeNull();
  });

  it('기준 29-a: 진행 이벤트 없이 retrieval.completed만 와도 오늘의 evidence 폴백을 유지한다', async () => {
    const stream = await sendQuestion('spec-46-stage-29-a-legacy');

    act(() => {
      stream.emit({ eventType: 'retrieval.completed', evidence: makeEvidence(2) });
    });

    expect(screen.getByText(GENERATING_2_KO)).toBeTruthy();
    expect(screen.queryByText(ANALYZING_KO)).toBeNull();

    // 위 호환성 회귀만으로는 현재 스텁도 통과하므로, 별도 스트림의 아는 stage로 RED를 보장한다.
    cleanup();
    const wiringGuard = await sendQuestion('spec-46-stage-29-a-wiring-guard');
    act(() => {
      wiringGuard.emit({ eventType: 'retrieval.progress', stage: 'embedded' });
    });
    expect(screen.getByText(EMBEDDED_KO)).toBeTruthy();
    expect(screen.queryByText(ANALYZING_KO)).toBeNull();
  });

  it('기준 29-b: retrieval.started까지만 오면 오늘의 검색 문구를 유지한다', async () => {
    const stream = await sendQuestion('spec-46-stage-29-b');

    expect(screen.getByText(ANALYZING_KO)).toBeTruthy();

    // started 폴백만으로는 스텁도 통과하므로 다음 유효 stage 전환을 양성 대조로 둔다.
    act(() => {
      stream.emit({ eventType: 'retrieval.progress', stage: 'embedded' });
    });
    expect(screen.getByText(EMBEDDED_KO)).toBeTruthy();
    expect(screen.queryByText(ANALYZING_KO)).toBeNull();
  });

  it('기준 30-a: en의 embedded 문구를 표시하고 한국어 문구는 표시하지 않는다', async () => {
    setLanguageInputs('ko-KR', 'en');
    const stream = await sendQuestion('spec-46-stage-30-a', EN_CONTROLS);

    act(() => {
      stream.emit({ eventType: 'retrieval.progress', stage: 'embedded' });
    });

    expect(screen.getByText(EMBEDDED_EN)).toBeTruthy();
    expect(screen.queryByText(EMBEDDED_KO)).toBeNull();
  });

  it('기준 30-b: en의 searched 문구에 candidates 수를 표시하고 한국어 문구는 표시하지 않는다', async () => {
    setLanguageInputs('ko-KR', 'en');
    const stream = await sendQuestion('spec-46-stage-30-b', EN_CONTROLS);

    act(() => {
      stream.emit({
        eventType: 'retrieval.progress',
        stage: 'searched',
        candidates: 42,
      });
    });

    expect(screen.getByText(SEARCHED_42_EN)).toBeTruthy();
    expect(screen.queryByText(SEARCHED_42_KO)).toBeNull();
  });

  it('기준 30-c: en의 reranked 문구를 표시하고 한국어 문구는 표시하지 않는다', async () => {
    setLanguageInputs('ko-KR', 'en');
    const stream = await sendQuestion('spec-46-stage-30-c', EN_CONTROLS);

    act(() => {
      stream.emit({ eventType: 'retrieval.progress', stage: 'reranked' });
    });

    expect(screen.getByText(RERANKED_EN)).toBeTruthy();
    expect(screen.queryByText(RERANKED_KO)).toBeNull();
  });

  it('기준 30-d: en의 answer.started 문구에 evidence 수를 표시하고 한국어 문구는 표시하지 않는다', async () => {
    setLanguageInputs('ko-KR', 'en');
    const stream = await sendQuestion('spec-46-stage-30-d', EN_CONTROLS);

    act(() => {
      stream.emit({ eventType: 'retrieval.progress', stage: 'reranked' });
    });
    expect(screen.getByText(RERANKED_EN)).toBeTruthy();

    act(() => {
      stream.emit({ eventType: 'retrieval.completed', evidence: makeEvidence(2) });
    });
    expect(screen.getByText(RERANKED_EN)).toBeTruthy();
    expect(screen.queryByText(GENERATING_2_EN)).toBeNull();

    act(() => {
      stream.emit({ eventType: 'answer.started' });
    });

    expect(screen.getByText(GENERATING_2_EN)).toBeTruthy();
    expect(screen.queryByText(GENERATING_2_KO)).toBeNull();
  });
});
