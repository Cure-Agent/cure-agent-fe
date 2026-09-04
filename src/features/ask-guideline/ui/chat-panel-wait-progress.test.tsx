// @vitest-environment happy-dom
// answer-wait-progress 작업 2-a 수용 기준 1~6 동결 테스트. 구현 중 수정 금지.
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
    args.onEvent({
      eventType: 'message.accepted',
      requestId: `${conversationId}-request`,
      userMessageId: `${conversationId}-user`,
      assistantMessageId,
    });
    args.onEvent({ eventType: 'retrieval.started' });
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

async function sendQuestion(
  conversationId: string,
  controls: { input: string; send: string; retrieving: string } = {
    input: '질문 입력',
    send: '전송',
    retrieving: '지침 근거를 검색하는 중…',
  },
): Promise<LiveStream> {
  mockEmptyMessages(conversationId);
  const stream = holdStreamAtRetrieval(conversationId);
  const user = userEvent.setup();

  renderWithProviders(<ChatPanel conversationId={conversationId} />);
  await user.type(await screen.findByLabelText(controls.input), QUESTION);
  await user.click(screen.getByRole('button', { name: controls.send }));
  await screen.findByText(controls.retrieving);

  return stream;
}

beforeEach(() => {
  sendMessageStreamMock.mockReset();
  resetAllStreams();
  setLanguageInputs('ko-KR', null);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ChatPanel 답변 대기 진행 단계 (작업 2-a 수용 기준 1~6)', () => {
  it('기준 1: retrieval.started까지만 도착하면 근거를 검색하는 중이라고 표시한다', async () => {
    await sendQuestion('wait-progress-1');

    expect(screen.getByText('지침 근거를 검색하는 중…')).toBeTruthy();
  });

  it('기준 2: 근거 2건의 retrieval.completed가 도착하면 답변 작성 단계와 건수를 표시한다', async () => {
    const stream = await sendQuestion('wait-progress-2');

    act(() => {
      stream.emit({ eventType: 'retrieval.completed', evidence: makeEvidence(2) });
    });

    expect(
      screen.getByText('지침 근거 2건을 바탕으로 답변을 작성하는 중…'),
    ).toBeTruthy();
  });

  it('기준 3: 근거 2건의 retrieval.completed 뒤에는 검색 단계 문구가 남지 않는다', async () => {
    const stream = await sendQuestion('wait-progress-3');

    act(() => {
      stream.emit({ eventType: 'retrieval.completed', evidence: makeEvidence(2) });
    });

    expect(screen.queryByText('지침 근거를 검색하는 중…')).toBeNull();
  });

  it('기준 4: 근거가 3건이면 작성 단계에 3건을 표시하고 2건을 하드코딩하지 않는다', async () => {
    const stream = await sendQuestion('wait-progress-4');

    act(() => {
      stream.emit({ eventType: 'retrieval.completed', evidence: makeEvidence(3) });
    });

    expect(
      screen.getByText('지침 근거 3건을 바탕으로 답변을 작성하는 중…'),
    ).toBeTruthy();
    expect(
      screen.queryByText('지침 근거 2건을 바탕으로 답변을 작성하는 중…'),
    ).toBeNull();
  });

  it('기준 5: answer.delta가 도착하면 두 단계 문구를 모두 숨기고 델타 본문을 표시한다', async () => {
    const stream = await sendQuestion('wait-progress-5');

    act(() => {
      stream.emit({ eventType: 'retrieval.completed', evidence: makeEvidence(2) });
    });
    // delta 직전이 실제 답변 작성 단계였음을 보장해, 사라짐 단언이 공허해지지 않게 한다.
    expect(
      screen.getByText('지침 근거 2건을 바탕으로 답변을 작성하는 중…'),
    ).toBeTruthy();

    act(() => {
      stream.emit({
        eventType: 'answer.delta',
        messageId: stream.assistantMessageId,
        seq: 0,
        delta: '침 치료를 고려할 수 있습니다.',
      });
    });

    expect(
      screen.queryByText('지침 근거 2건을 바탕으로 답변을 작성하는 중…'),
    ).toBeNull();
    expect(screen.queryByText('지침 근거를 검색하는 중…')).toBeNull();
    expect(screen.getByText('침 치료를 고려할 수 있습니다.')).toBeTruthy();
  });

  it('기준 6: 표시 언어가 en이면 근거 2건의 작성 단계도 영어로 표시한다', async () => {
    setLanguageInputs('ko-KR', 'en');
    const stream = await sendQuestion('wait-progress-6', {
      input: 'Question',
      send: 'Send',
      retrieving: 'Searching the guidelines for evidence…',
    });

    act(() => {
      stream.emit({ eventType: 'retrieval.completed', evidence: makeEvidence(2) });
    });

    expect(screen.getByText('Drafting the answer from 2 guideline sources…')).toBeTruthy();
    expect(
      screen.queryByText('지침 근거 2건을 바탕으로 답변을 작성하는 중…'),
    ).toBeNull();
  });
});
