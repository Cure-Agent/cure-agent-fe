// spec 46 FE 수용 기준 23~30 동결 테스트. 구현 중 수정 금지.
import { describe, expect, it } from 'vitest';
import {
  initialStreamState,
  streamReducer,
  type EvidenceDetail,
  type StreamAction,
  type StreamState,
} from './stream-state.model';

type StreamEvent = Extract<StreamAction, { type: 'event' }>['event'];

const evidence: EvidenceDetail[] = [
  {
    id: 'evidence-1',
    guidelineId: 'guideline-1',
    guidelineVersionId: 'guideline-version-1',
    guidelineTitle: '요통 진료지침 1',
    version: '1.0',
    sectionPath: ['치료', '권고 1'],
    excerpt: '근거 문장 1',
    sourceUrl: 'https://example.com/guidelines/1',
  },
  {
    id: 'evidence-2',
    guidelineId: 'guideline-2',
    guidelineVersionId: 'guideline-version-2',
    guidelineTitle: '요통 진료지침 2',
    version: '1.0',
    sectionPath: ['치료', '권고 2'],
    excerpt: '근거 문장 2',
    sourceUrl: 'https://example.com/guidelines/2',
  },
];

function applyEvent(state: StreamState, event: StreamEvent): StreamState {
  return streamReducer(state, { type: 'event', event });
}

function retrievingState(): StreamState {
  const accepted = applyEvent(initialStreamState, {
    eventType: 'message.accepted',
    requestId: 'request-progress',
    userMessageId: 'user-progress',
    assistantMessageId: 'assistant-progress',
  });

  return applyEvent(accepted, { eventType: 'retrieval.started' });
}

function completedRetrievalState(): StreamState {
  return applyEvent(retrievingState(), {
    eventType: 'retrieval.completed',
    evidence,
  });
}

describe('streamReducer spec 46 진행 단계 (FE 수용 기준 24·26·27)', () => {
  it('기준 24-a: answer.started는 phase를 generating으로 바꾸고 기존 evidence를 보존한다', () => {
    const before = completedRetrievalState();
    expect(before.evidence).toEqual(evidence);

    const next = applyEvent(before, { eventType: 'answer.started' });

    expect(next.phase).toBe('generating');
    expect(next.evidence).toEqual(evidence);
  });

  it('기준 26: generating에서 첫 answer.delta가 오면 streaming으로 올라가고 본문을 누적한다', () => {
    const generating = applyEvent(completedRetrievalState(), {
      eventType: 'answer.started',
    });

    // 출발점 자체를 단언해 answer.started 무배선 스텁에서는 이 회귀 테스트도 반드시 RED다.
    expect(generating.phase).toBe('generating');

    const next = applyEvent(generating, {
      eventType: 'answer.delta',
      messageId: 'assistant-progress',
      seq: 0,
      delta: '침 치료를 고려할 수 있습니다.',
    });

    expect(next).toMatchObject({
      phase: 'streaming',
      content: '침 치료를 고려할 수 있습니다.',
      nextSeq: 1,
    });
  });

  it('기준 27-b 선행 가드: 아는 retrieval.progress stage는 새 상태와 올바른 후보 수를 만든다', () => {
    const retrieving = retrievingState();

    const searched = applyEvent(retrieving, {
      eventType: 'retrieval.progress',
      stage: 'searched',
      candidates: 42,
    });
    expect(searched).not.toBe(retrieving);
    expect(searched).toMatchObject({
      retrievalStage: 'searched',
      retrievalCandidates: 42,
    });

    const embedded = applyEvent(retrieving, {
      eventType: 'retrieval.progress',
      stage: 'embedded',
    });
    expect(embedded).not.toBe(retrieving);
    expect(embedded).toMatchObject({
      retrievalStage: 'embedded',
      retrievalCandidates: null,
    });

    const reranked = applyEvent(retrieving, {
      eventType: 'retrieval.progress',
      stage: 'reranked',
    });
    expect(reranked).not.toBe(retrieving);
    expect(reranked).toMatchObject({
      retrievalStage: 'reranked',
      retrievalCandidates: null,
    });

    const rerankedAfterSearched = applyEvent(searched, {
      eventType: 'retrieval.progress',
      stage: 'reranked',
    });
    expect(rerankedAfterSearched).not.toBe(searched);
    expect(rerankedAfterSearched).toMatchObject({
      retrievalStage: 'reranked',
      retrievalCandidates: null,
    });
  });

  it('기준 27-a: 모르는 eventType은 유효한 진행 상태의 참조를 그대로 돌려준다', () => {
    const retrieving = retrievingState();
    const prev = applyEvent(retrieving, {
      eventType: 'retrieval.progress',
      stage: 'searched',
      candidates: 42,
    });

    // 전부 무시하는 현재 스텁이 이 부재 단언만으로 통과하지 못하게 하는 양성 배선 가드다.
    expect(prev).not.toBe(retrieving);
    expect(prev).toMatchObject({
      retrievalStage: 'searched',
      retrievalCandidates: 42,
    });

    const next = applyEvent(prev, { eventType: 'answer.thinking' });

    expect(next).toBe(prev);
  });

  it('기준 27-b: 모르는 stage와 stage 없는 retrieval.progress는 상태 참조를 그대로 돌려준다', () => {
    const retrieving = retrievingState();
    const prev = applyEvent(retrieving, {
      eventType: 'retrieval.progress',
      stage: 'searched',
      candidates: 42,
    });

    // 아는 stage의 실제 변경을 같은 테스트에서도 확인해 무배선 스텁을 반드시 탈락시킨다.
    expect(prev).not.toBe(retrieving);
    expect(prev).toMatchObject({
      retrievalStage: 'searched',
      retrievalCandidates: 42,
    });

    const unknownStage = applyEvent(prev, {
      eventType: 'retrieval.progress',
      stage: 'reembedded',
    });
    expect(unknownStage).toBe(prev);

    const missingStage = applyEvent(prev, {
      eventType: 'retrieval.progress',
    });
    expect(missingStage).toBe(prev);
  });
});
