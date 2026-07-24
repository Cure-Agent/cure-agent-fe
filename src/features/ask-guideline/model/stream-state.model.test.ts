// docs/specs/08 수용 기준 1·2·3 동결 테스트 — 구현 중 수정 금지
import { describe, expect, it } from 'vitest';
import {
  initialStreamState,
  streamReducer,
  type EvidenceDetail,
  type MessageDto,
  type StreamAction,
  type StreamState,
} from './stream-state.model';

type StreamEvent = Extract<StreamAction, { type: 'event' }>['event'];

const evidence: EvidenceDetail[] = [
  {
    id: 'evidence-1',
    guidelineId: 'guideline-1',
    guidelineVersionId: 'guideline-version-1',
    guidelineTitle: '요통 한의표준임상진료지침',
    version: '1.0',
    sectionPath: ['2', '치료', '침치료'],
    excerpt: '침 치료를 고려할 수 있다.',
    sourceUrl: 'https://example.test/guidelines/guideline-1',
  },
];

const completedMessage: MessageDto = {
  id: 'assistant-message-1',
  role: 'ASSISTANT',
  content: '침 치료를 고려합니다.',
  status: 'COMPLETED',
  citations: [],
  createdAt: '2026-07-24T00:00:00.000Z',
};

function applyEvent(state: StreamState, event: StreamEvent): StreamState {
  return streamReducer(state, { type: 'event', event });
}

describe('streamReducer', () => {
  it('기준 1: accepted → retrieval.completed → delta 누적 → completed로 전이한다', () => {
    let state = applyEvent(initialStreamState, {
      eventType: 'message.accepted',
      requestId: 'request-1',
      userMessageId: 'user-message-1',
      assistantMessageId: 'assistant-message-1',
    });

    expect(state).toMatchObject({
      phase: 'accepted',
      requestId: 'request-1',
      userMessageId: 'user-message-1',
      assistantMessageId: 'assistant-message-1',
    });

    state = applyEvent(state, {
      eventType: 'retrieval.completed',
      evidence,
    });
    expect(state.evidence).toEqual(evidence);

    state = applyEvent(state, {
      eventType: 'answer.delta',
      messageId: 'assistant-message-1',
      seq: 0,
      delta: '침 치료를 ',
    });
    expect(state).toMatchObject({
      phase: 'streaming',
      content: '침 치료를 ',
      nextSeq: 1,
    });

    state = applyEvent(state, {
      eventType: 'answer.delta',
      messageId: 'assistant-message-1',
      seq: 1,
      delta: '고려합니다.',
    });
    expect(state).toMatchObject({
      content: '침 치료를 고려합니다.',
      nextSeq: 2,
    });

    state = applyEvent(state, {
      eventType: 'answer.completed',
      message: completedMessage,
    });
    expect(state).toMatchObject({
      phase: 'completed',
      content: '침 치료를 고려합니다.',
      message: completedMessage,
    });
  });

  it('기준 2: 중복 seq와 역행 seq delta는 내용을 바꾸지 않는다', () => {
    let state = applyEvent(initialStreamState, {
      eventType: 'message.accepted',
      requestId: 'request-1',
      userMessageId: 'user-message-1',
      assistantMessageId: 'assistant-message-1',
    });
    state = applyEvent(state, {
      eventType: 'retrieval.completed',
      evidence: [],
    });
    state = applyEvent(state, {
      eventType: 'answer.delta',
      messageId: 'assistant-message-1',
      seq: 0,
      delta: '첫 번째',
    });
    state = applyEvent(state, {
      eventType: 'answer.delta',
      messageId: 'assistant-message-1',
      seq: 1,
      delta: ' 두 번째',
    });

    const contentBeforeIgnoredDeltas = state.content;

    state = applyEvent(state, {
      eventType: 'answer.delta',
      messageId: 'assistant-message-1',
      seq: 1,
      delta: ' 중복',
    });
    expect(state).toMatchObject({
      content: contentBeforeIgnoredDeltas,
      nextSeq: 2,
    });

    state = applyEvent(state, {
      eventType: 'answer.delta',
      messageId: 'assistant-message-1',
      seq: 0,
      delta: ' 역행',
    });
    expect(state).toMatchObject({
      content: contentBeforeIgnoredDeltas,
      nextSeq: 2,
    });
  });

  it('기준 3: answer.abstained의 ABSTAINED 메시지와 사유를 반영한다', () => {
    const abstainedMessage: MessageDto = {
      id: 'assistant-message-2',
      role: 'ASSISTANT',
      content: '답변에 필요한 근거를 찾지 못했습니다.',
      status: 'ABSTAINED',
      citations: [],
      createdAt: '2026-07-24T00:01:00.000Z',
    };

    const state = applyEvent(initialStreamState, {
      eventType: 'answer.abstained',
      message: abstainedMessage,
      reason: 'NO_RELEVANT_EVIDENCE',
      missingInformation: ['관련 임상 지침'],
    });

    expect(state).toMatchObject({
      phase: 'abstained',
      message: abstainedMessage,
      abstainReason: 'NO_RELEVANT_EVIDENCE',
    });
    expect(state.message?.status).toBe('ABSTAINED');
  });

  it('기준 3: error 이벤트의 retryable과 traceId를 보존한다', () => {
    const state = applyEvent(initialStreamState, {
      eventType: 'error',
      code: 'STREAM_TEMPORARILY_UNAVAILABLE',
      message: '잠시 후 다시 시도해 주세요.',
      retryable: true,
      traceId: 'trace-error-1',
    });

    expect(state).toMatchObject({
      phase: 'error',
      error: {
        code: 'STREAM_TEMPORARILY_UNAVAILABLE',
        message: '잠시 후 다시 시도해 주세요.',
        retryable: true,
        traceId: 'trace-error-1',
      },
    });
  });
});
