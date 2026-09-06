// @vitest-environment happy-dom
// spec 47 FE 수용 기준 화면 동결 테스트. 구현 중 수정 금지.
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '../api/send-message';
import type { EvidenceDetail } from '../model/stream-state.model';
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
const RERANKED_KO = '근거를 정리하는 중…';
const GENERATING_3_KO = '지침 근거 3건을 바탕으로 답변을 작성하는 중…';
const GENERATING_4_KO = '지침 근거 4건을 바탕으로 답변을 작성하는 중…';
const GENERATING_5_KO = '지침 근거 5건을 바탕으로 답변을 작성하는 중…';
const ANALYZING_EN = 'Analyzing your question…';

const KO_CONTROLS = { input: '질문 입력', send: '전송' };
const EN_CONTROLS = { input: 'Question', send: 'Send' };

type OnEvidenceChange = NonNullable<
  ComponentProps<typeof ChatPanel>['onEvidenceChange']
>;

type LiveStream = {
  assistantMessageId: string;
  emit: (event: StreamEvent) => void;
};

function asStreamEvent(event: Record<string, unknown>): StreamEvent {
  return event as unknown as StreamEvent;
}

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
  const assistantMessageId = `${conversationId}-assistant`;

  sendMessageStreamMock.mockImplementation((args) => {
    emit = args.onEvent;
    args.onEvent(
      asStreamEvent({
        eventType: 'message.accepted',
        requestId: `${conversationId}-request`,
        userMessageId: `${conversationId}-user`,
        assistantMessageId,
      }),
    );
    args.onEvent(asStreamEvent({ eventType: 'retrieval.started' }));

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

function makeEvidence(count: number): EvidenceDetail[] {
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

function evidenceFrame(
  index: number,
  total: number,
  item: EvidenceDetail,
): StreamEvent {
  return asStreamEvent({
    eventType: 'retrieval.evidence',
    index,
    total,
    evidence: item,
  });
}

function retrievalCompleted(completedEvidence?: EvidenceDetail[]): StreamEvent {
  return completedEvidence === undefined
    ? asStreamEvent({ eventType: 'retrieval.completed' })
    : asStreamEvent({
        eventType: 'retrieval.completed',
        evidence: completedEvidence,
      });
}

function answerStarted(evidenceCount?: number): StreamEvent {
  return evidenceCount === undefined
    ? asStreamEvent({ eventType: 'answer.started' })
    : asStreamEvent({ eventType: 'answer.started', evidenceCount });
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
  options: {
    controls?: { input: string; send: string };
    onEvidenceChange?: OnEvidenceChange;
  } = {},
): Promise<LiveStream> {
  const controls = options.controls ?? KO_CONTROLS;
  mockEmptyMessages(conversationId);
  const stream = holdStreamAtRetrieval(conversationId);
  const user = setupUser();

  renderWithProviders(
    <ChatPanel
      conversationId={conversationId}
      onEvidenceChange={options.onEvidenceChange}
    />,
  );
  await user.type(await screen.findByLabelText(controls.input), QUESTION);
  await user.click(screen.getByRole('button', { name: controls.send }));

  expect(sendMessageStreamMock).toHaveBeenCalled();
  return stream;
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
  vi.setSystemTime(new Date('2026-09-06T00:00:00.000Z'));
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

describe('ChatPanel spec 47 근거 프레임 (FE 수용 기준 21·23~28·30)', () => {
  it('기준 21-d: 근거 프레임마다 onEvidenceChange가 1 → 2 → 3건으로 다시 불린다', async () => {
    const items = makeEvidence(3);
    const onEvidenceChange = vi.fn<OnEvidenceChange>();
    const stream = await sendQuestion('spec-47-screen-21-d', { onEvidenceChange });
    onEvidenceChange.mockClear();

    act(() => {
      stream.emit(evidenceFrame(0, 3, items[0]));
    });
    expect(onEvidenceChange).toHaveBeenLastCalledWith([items[0]], 'ko');

    act(() => {
      stream.emit(evidenceFrame(1, 3, items[1]));
    });
    expect(onEvidenceChange).toHaveBeenLastCalledWith(items.slice(0, 2), 'ko');

    act(() => {
      stream.emit(evidenceFrame(2, 3, items[2]));
    });

    expect(onEvidenceChange).toHaveBeenCalledTimes(3);
    expect(onEvidenceChange.mock.calls.map(([received]) => received.length)).toEqual([
      1, 2, 3,
    ]);
    expect(onEvidenceChange).toHaveBeenLastCalledWith(items, 'ko');
  });

  it('기준 23-b: 구버전 retrieval.completed도 onEvidenceChange에 2건을 전달한다', async () => {
    const legacyItems = makeEvidence(2);
    const onLegacyEvidenceChange = vi.fn<OnEvidenceChange>();
    const legacy = await sendQuestion('spec-47-screen-23-b-legacy', {
      onEvidenceChange: onLegacyEvidenceChange,
    });
    onLegacyEvidenceChange.mockClear();

    act(() => {
      legacy.emit(retrievalCompleted(legacyItems));
    });

    expect(onLegacyEvidenceChange).toHaveBeenLastCalledWith(legacyItems, 'ko');

    // 구버전 회귀만으로 현재 스텁이 통과하지 않도록 신규 프레임의 양성 배선을 함께 본다.
    cleanup();
    const newItems = makeEvidence(1);
    const onNewEvidenceChange = vi.fn<OnEvidenceChange>();
    const current = await sendQuestion('spec-47-screen-23-b-wiring-guard', {
      onEvidenceChange: onNewEvidenceChange,
    });
    onNewEvidenceChange.mockClear();

    act(() => {
      current.emit(evidenceFrame(0, 1, newItems[0]));
    });
    expect(onNewEvidenceChange).toHaveBeenLastCalledWith(newItems, 'ko');
  });

  it('기준 24-b: 근거 도착 전 answer.started의 evidenceCount 5를 작성 문구에 쓴다', async () => {
    const onEvidenceChange = vi.fn<OnEvidenceChange>();
    const stream = await sendQuestion('spec-47-screen-24-b', { onEvidenceChange });

    act(() => {
      stream.emit(asStreamEvent({ eventType: 'retrieval.progress', stage: 'reranked' }));
    });
    expect(screen.getByText(RERANKED_KO)).toBeTruthy();

    act(() => {
      stream.emit(answerStarted(5));
    });

    expect(onEvidenceChange).toHaveBeenLastCalledWith([], 'ko');
    expect(screen.getByText(GENERATING_5_KO)).toBeTruthy();
    expect(
      screen.queryByText('지침 근거 0건을 바탕으로 답변을 작성하는 중…'),
    ).toBeNull();
  });

  it('기준 24-c: 근거가 2건까지 도착해도 작성 문구의 N은 evidenceCount 5로 남는다', async () => {
    const items = makeEvidence(2);
    const onEvidenceChange = vi.fn<OnEvidenceChange>();
    const stream = await sendQuestion('spec-47-screen-24-c', { onEvidenceChange });

    act(() => {
      stream.emit(asStreamEvent({ eventType: 'retrieval.progress', stage: 'reranked' }));
      stream.emit(answerStarted(5));
    });
    onEvidenceChange.mockClear();

    act(() => {
      stream.emit(evidenceFrame(0, 5, items[0]));
    });
    act(() => {
      stream.emit(evidenceFrame(1, 5, items[1]));
    });

    expect(onEvidenceChange).toHaveBeenLastCalledWith(items, 'ko');
    expect(screen.getByText(GENERATING_5_KO)).toBeTruthy();
    expect(
      screen.queryByText('지침 근거 2건을 바탕으로 답변을 작성하는 중…'),
    ).toBeNull();
  });

  it('기준 24-d: 구버전 answer.started는 completed의 evidence.length 3으로 폴백한다', async () => {
    const legacy = await sendQuestion('spec-47-screen-24-d-legacy');

    act(() => {
      legacy.emit(retrievalCompleted(makeEvidence(3)));
      legacy.emit(answerStarted());
    });

    expect(screen.getByText(GENERATING_3_KO)).toBeTruthy();

    // 구버전 폴백만으로 현재 스텁이 통과하지 않도록 count 기반 신규 경로를 함께 확인한다.
    cleanup();
    const wiringGuard = await sendQuestion('spec-47-screen-24-d-wiring-guard');
    act(() => {
      wiringGuard.emit(answerStarted(4));
    });
    expect(screen.getByText(GENERATING_4_KO)).toBeTruthy();
  });

  it('기준 25-d: answer.started 시점에는 작성 대기 문구만 있고 답변 본문은 없다', async () => {
    const stream = await sendQuestion('spec-47-screen-25-d');

    act(() => {
      stream.emit(asStreamEvent({ eventType: 'retrieval.progress', stage: 'reranked' }));
      stream.emit(answerStarted(5));
    });

    // 신규 count 문구가 실제로 보이는 양성 가드와 본문 부재를 한 화면에서 함께 본다.
    expect(screen.getByText(GENERATING_5_KO)).toBeTruthy();
    expect(screen.queryByText(DELTA_TEXT)).toBeNull();
    expect(document.body).not.toHaveTextContent('▍');

    // 같은 본문·커서가 실제 delta 뒤에는 나타나는 양성 대조로 위 부재 단언을 고정한다.
    act(() => {
      stream.emit(
        asStreamEvent({
          eventType: 'answer.delta',
          messageId: stream.assistantMessageId,
          seq: 0,
          delta: DELTA_TEXT,
        }),
      );
    });
    expect(screen.getByText(DELTA_TEXT)).toBeTruthy();
    expect(document.body).toHaveTextContent('▍');
  });

  it('기준 26-b: 첫 delta가 오면 대기 문구가 사라지고 답변 본문이 보인다', async () => {
    const items = makeEvidence(2);
    const stream = await sendQuestion('spec-47-screen-26-b');

    act(() => {
      stream.emit(asStreamEvent({ eventType: 'retrieval.progress', stage: 'reranked' }));
      stream.emit(answerStarted(5));
    });
    act(() => {
      stream.emit(evidenceFrame(0, 2, items[0]));
    });
    act(() => {
      stream.emit(evidenceFrame(1, 2, items[1]));
    });
    act(() => {
      stream.emit(retrievalCompleted());
    });

    // delta 직전의 신규 순서가 실제 generating 화면임을 보장한다.
    expect(screen.getByText(GENERATING_5_KO)).toBeTruthy();

    act(() => {
      stream.emit(
        asStreamEvent({
          eventType: 'answer.delta',
          messageId: stream.assistantMessageId,
          seq: 0,
          delta: DELTA_TEXT,
        }),
      );
    });

    expect(screen.queryByText(GENERATING_5_KO)).toBeNull();
    expect(screen.getByText(DELTA_TEXT)).toBeTruthy();
  });

  it('기준 27-a·27-b: started의 분석 문구가 embedded에서 검색 문구로 바뀐다', async () => {
    const stream = await sendQuestion('spec-47-screen-27-a-b');

    expect(screen.getByText(ANALYZING_KO)).toBeTruthy();
    expect(screen.queryByText(EMBEDDED_KO)).toBeNull();

    act(() => {
      stream.emit(asStreamEvent({ eventType: 'retrieval.progress', stage: 'embedded' }));
    });

    expect(screen.getByText(EMBEDDED_KO)).toBeTruthy();
    expect(screen.queryByText(ANALYZING_KO)).toBeNull();
  });

  it('기준 28-c: 표시 언어가 en이면 진행 이벤트 전 분석 문구도 영어다', async () => {
    setLanguageInputs('ko-KR', 'en');
    await sendQuestion('spec-47-screen-28-c', { controls: EN_CONTROLS });

    expect(screen.getByText(ANALYZING_EN)).toBeTruthy();
    expect(screen.queryByText(ANALYZING_KO)).toBeNull();
  });

  it('기준 30-a: 경과 3초는 answer.started의 신규 작성 단계로 넘어가도 이어진다', async () => {
    const stream = await sendQuestion('spec-47-screen-30-a');

    await advanceElapsed(3_000);
    expect(screen.getByText('(3초)')).toBeTruthy();

    act(() => {
      stream.emit(asStreamEvent({ eventType: 'retrieval.progress', stage: 'reranked' }));
    });
    expect(screen.getByText(RERANKED_KO)).toBeTruthy();
    expect(screen.getByText('(3초)')).toBeTruthy();

    act(() => {
      stream.emit(answerStarted(4));
    });

    expect(screen.getByText(GENERATING_4_KO)).toBeTruthy();
    expect(screen.getByText('(3초)')).toBeTruthy();
    expect(screen.queryByText('(0초)')).toBeNull();
  });
});
