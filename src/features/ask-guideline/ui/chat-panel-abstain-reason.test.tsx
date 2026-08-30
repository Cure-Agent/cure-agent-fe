// @vitest-environment happy-dom
// spec 43 기권 사유 영속화 — BE가 메시지에 실은 문장을 두 경로에서 같은 보류 안내로 그린다
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '../api/send-message';
import type { MessageDto } from '../model/stream-state.model';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';

const sendMessageStreamMock = vi.hoisted(() =>
  vi.fn<(args: SendMessageArgs) => Promise<void>>(),
);

vi.mock('../api/send-message', () => ({
  sendMessageStream: sendMessageStreamMock,
}));

import { ChatPanel } from './chat-panel';

/**
 * docs/specs/43 FE 수용 기준 15~19 동결 테스트. 구현 중 수정 금지.
 * 사유 문장은 테스트 서버가 정하며 FE 리소스나 구현 상수에서 가져오지 않는다.
 */

useMswServer();

const PAGE = { size: 50, hasNext: false, nextCursor: null };
const FALLBACK_NOTICE =
  '검색 조건에 해당하는 지침 근거를 찾지 못해 답변을 보류했습니다.';

const REASONS = {
  filteredOut: '선택한 진료지침 필터 안에서는 관련 근거를 찾지 못했습니다.',
  noRelevantEvidence: '이 질문과 직접 관련된 지침 근거를 찾지 못했습니다.',
  scopeTooBroad: '질문의 범위가 넓어 하나의 근거 답변으로 좁히지 못했습니다.',
} as const;

const REASON_CASES = [
  ['18-a', '필터 조건 사유', REASONS.filteredOut],
  ['18-b', '관련 근거 없음 사유', REASONS.noRelevantEvidence],
  ['18-c', '질문 범위 사유', REASONS.scopeTooBroad],
] as const;

beforeEach(() => {
  sendMessageStreamMock.mockReset();
  sendMessageStreamMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

function abstainedMessage(id: string, abstainReason?: string): MessageDto {
  return {
    id,
    role: 'ASSISTANT',
    content: '',
    status: 'ABSTAINED',
    citations: [],
    createdAt: '2026-08-30T10:00:00.000Z',
    ...(abstainReason === undefined ? {} : { abstainReason }),
  };
}

function mockConversation(
  conversationId: string,
  getMessages: () => MessageDto[],
): void {
  server.use(
    http.get(`/api/v1/conversations/${conversationId}`, () =>
      HttpResponse.json(
        envelope({
          id: conversationId,
          title: '기권 사유 테스트 대화',
          type: 'GUIDELINE_QA',
          status: 'ACTIVE',
          lastMessageAt: '2026-08-30T10:00:00.000Z',
          createdAt: '2026-08-30T09:00:00.000Z',
        }),
      ),
    ),
    http.get(`/api/v1/conversations/${conversationId}/messages`, () =>
      HttpResponse.json(envelope(getMessages(), PAGE)),
    ),
  );
}

function mockAbstainedStream(message: MessageDto, eventReason: string): void {
  sendMessageStreamMock.mockImplementation(async (args) => {
    args.onEvent({
      eventType: 'message.accepted',
      requestId: `request-${message.id}`,
      userMessageId: `user-${message.id}`,
      assistantMessageId: message.id,
    });
    args.onEvent({
      eventType: 'answer.abstained',
      message,
      reason: eventReason,
    });
  });
}

async function submitQuestion(question: string): Promise<void> {
  const previousCallCount = sendMessageStreamMock.mock.calls.length;
  const user = userEvent.setup();

  await user.type(await screen.findByLabelText('질문 입력'), question);
  await user.click(screen.getByRole('button', { name: '전송' }));

  await waitFor(() => {
    expect(sendMessageStreamMock).toHaveBeenCalledTimes(previousCallCount + 1);
  });
}

function amberNoticeContaining(textElement: HTMLElement): HTMLElement {
  const notice = textElement.closest('.bg-amber-50');
  expect(notice).not.toBeNull();
  return notice as HTMLElement;
}

describe('ChatPanel 저장된 기권 사유 재조회 (수용 기준 15)', () => {
  it('기준 15-a: 재조회한 ABSTAINED 메시지는 BE가 보낸 사유 문장을 그대로 보여준다', async () => {
    const message = abstainedMessage('restored-reason', REASONS.filteredOut);
    mockConversation('restore-reason', () => [message]);

    renderWithProviders(<ChatPanel conversationId="restore-reason" />);

    expect(await screen.findByText(REASONS.filteredOut)).toBeInTheDocument();
  });

  it('기준 15-b: 저장된 사유가 있으면 고정 폴백을 함께 보여 주지 않는다 — 같은 말을 두 번 하지 않는다', async () => {
    const message = abstainedMessage('restored-without-duplicate', REASONS.filteredOut);
    mockConversation('restore-without-duplicate', () => [message]);

    renderWithProviders(<ChatPanel conversationId="restore-without-duplicate" />);

    await screen.findByText(REASONS.filteredOut);
    expect(screen.queryByText(FALLBACK_NOTICE)).not.toBeInTheDocument();
  });
});

describe('ChatPanel 기권 사유 스트림 경로 (수용 기준 16)', () => {
  it('기준 16-a: answer.abstained는 message.abstainReason 문장을 화면에 보여준다', async () => {
    const message = abstainedMessage('streamed-reason', REASONS.noRelevantEvidence);
    mockConversation('stream-reason', () => []);
    mockAbstainedStream(message, '화면이 사용하지 않을 최상위 이벤트 사유');

    renderWithProviders(<ChatPanel conversationId="stream-reason" />);
    await submitQuestion('관련 근거가 있는지 알려 주세요.');

    expect(await screen.findByText(REASONS.noRelevantEvidence)).toBeInTheDocument();
  });

  it('기준 16-b: 최상위 event.reason만으로는 문장을 그리지 않고 메시지 필드만 표시 축으로 삼는다', async () => {
    const eventOnlyReason = '이 최상위 이벤트 사유는 화면에 노출되면 안 됩니다.';
    const messageWithoutReason = abstainedMessage('stream-event-only');
    mockConversation('stream-event-only', () => []);
    mockAbstainedStream(messageWithoutReason, eventOnlyReason);

    renderWithProviders(<ChatPanel conversationId="stream-event-only" />);
    await submitQuestion('기록 전 메시지의 동작을 확인합니다.');

    await screen.findByText(FALLBACK_NOTICE);
    expect(screen.queryByText(eventOnlyReason)).not.toBeInTheDocument();

    // 대조군: 같은 스트림 이벤트에서 메시지 필드에 실린 문장은 표시되어야 한다.
    cleanup();
    const messageReason = '메시지 DTO에만 실어 보낸 대조 사유 문장입니다.';
    const messageWithReason = abstainedMessage('stream-message-axis', messageReason);
    mockConversation('stream-message-axis', () => []);
    mockAbstainedStream(messageWithReason, eventOnlyReason);

    renderWithProviders(<ChatPanel conversationId="stream-message-axis" />);
    await submitQuestion('표시 축이 메시지인지 확인합니다.');

    expect(await screen.findByText(messageReason)).toBeInTheDocument();
    expect(screen.queryByText(eventOnlyReason)).not.toBeInTheDocument();
  });

  it('기준 16-c: 동일 메시지는 스트림 직후와 재조회 후에 같은 사유 문장으로 보인다', async () => {
    const message = abstainedMessage('same-message', REASONS.scopeTooBroad);
    let persisted: MessageDto[] = [];
    mockConversation('same-message-both-paths', () => persisted);
    mockAbstainedStream(message, '비교에 쓰지 않는 최상위 이벤트 사유');

    renderWithProviders(<ChatPanel conversationId="same-message-both-paths" />);
    await submitQuestion('스트림과 재조회 결과를 비교합니다.');
    const streamedText = (await screen.findByText(REASONS.scopeTooBroad)).textContent;

    cleanup();
    persisted = [message];
    renderWithProviders(<ChatPanel conversationId="same-message-both-paths" />);
    const restoredText = (await screen.findByText(REASONS.scopeTooBroad)).textContent;

    expect(streamedText).toBe(REASONS.scopeTooBroad);
    expect(restoredText).toBe(REASONS.scopeTooBroad);
    expect(restoredText).toBe(streamedText);
  });
});

describe('ChatPanel 과거 ABSTAINED 메시지 폴백 (수용 기준 17)', () => {
  it('기준 17-a: abstainReason 키가 없는 과거 메시지는 기존 고정 안내를 유지한다', async () => {
    const legacyMessage = abstainedMessage('legacy-fallback');
    mockConversation('legacy-fallback', () => [legacyMessage]);

    renderWithProviders(<ChatPanel conversationId="legacy-fallback" />);

    expect(await screen.findByText(FALLBACK_NOTICE)).toBeInTheDocument();
  });

  it('기준 17-b: 과거 메시지의 폴백 화면에는 임의의 사유 문장이 섞이지 않는다', async () => {
    const legacyMessage = abstainedMessage('legacy-no-mixed-reason');
    mockConversation('legacy-no-mixed-reason', () => [legacyMessage]);

    renderWithProviders(<ChatPanel conversationId="legacy-no-mixed-reason" />);

    await screen.findByText(FALLBACK_NOTICE);
    for (const reason of Object.values(REASONS)) {
      expect(screen.queryByText(reason)).not.toBeInTheDocument();
    }
  });
});

describe('ChatPanel 세 기권 사유 분리 (수용 기준 18)', () => {
  it.each(REASON_CASES)(
    '기준 %s: %s는 다른 사유로 치환되지 않고 BE 문장 그대로 표시된다',
    async (_criterion, _label, reason) => {
      const conversationId = `distinct-reason-${_criterion}`;
      const message = abstainedMessage(`message-${_criterion}`, reason);
      mockConversation(conversationId, () => [message]);

      renderWithProviders(<ChatPanel conversationId={conversationId} />);

      const renderedReason = await screen.findByText(reason);
      expect(renderedReason).toHaveTextContent(reason);
    },
  );
});

describe('ChatPanel 기권 안내 프레이밍 (수용 기준 19)', () => {
  it('기준 19-a: 사유 문장은 폴백과 같은 기존 amber 보류 안내 컨테이너 안에 놓인다', async () => {
    const legacyMessage = abstainedMessage('framing-fallback');
    mockConversation('framing-fallback', () => [legacyMessage]);
    renderWithProviders(<ChatPanel conversationId="framing-fallback" />);

    const fallbackText = await screen.findByText(FALLBACK_NOTICE);
    const fallbackNotice = amberNoticeContaining(fallbackText);
    const fallbackShape = {
      tagName: fallbackNotice.tagName,
      className: fallbackNotice.className,
    };

    cleanup();
    const reasonMessage = abstainedMessage('framing-reason', REASONS.noRelevantEvidence);
    mockConversation('framing-reason', () => [reasonMessage]);
    renderWithProviders(<ChatPanel conversationId="framing-reason" />);

    const reasonText = await screen.findByText(REASONS.noRelevantEvidence);
    const reasonNotice = amberNoticeContaining(reasonText);

    expect(reasonNotice).toContainElement(reasonText);
    expect(screen.getByTestId('chat-messages')).toContainElement(reasonNotice);
    expect({ tagName: reasonNotice.tagName, className: reasonNotice.className }).toEqual(
      fallbackShape,
    );
  });

  it('기준 19-b: 사유 컨테이너는 사유 한 문장만 담고 폴백 문구를 함께 담지 않는다', async () => {
    const reason = '보류 컨테이너에 단독으로 표시할 서버 사유 문장입니다.';
    const message = abstainedMessage('framing-single-sentence', reason);
    mockConversation('framing-single-sentence', () => [message]);

    renderWithProviders(<ChatPanel conversationId="framing-single-sentence" />);

    const reasonText = await screen.findByText(reason);
    const reasonNotice = amberNoticeContaining(reasonText);

    expect(within(reasonNotice).getByText(reason)).toBe(reasonText);
    expect(within(reasonNotice).queryByText(FALLBACK_NOTICE)).not.toBeInTheDocument();
    expect(reasonNotice.textContent).toBe(reason);
  });
});
