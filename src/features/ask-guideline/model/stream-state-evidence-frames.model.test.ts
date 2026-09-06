// spec 47 FE 수용 기준 reducer·카탈로그 동결 테스트. 구현 중 수정 금지.
import { describe, expect, it } from 'vitest';
import { messagesFor } from '@/shared/i18n/messages';
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
  {
    id: 'evidence-3',
    guidelineId: 'guideline-3',
    guidelineVersionId: 'guideline-version-3',
    guidelineTitle: '요통 진료지침 3',
    version: '1.0',
    sectionPath: ['치료', '권고 3'],
    excerpt: '근거 문장 3',
    sourceUrl: 'https://example.com/guidelines/3',
  },
];

function asStreamEvent(event: Record<string, unknown>): StreamEvent {
  return event as unknown as StreamEvent;
}

function applyEvent(state: StreamState, event: StreamEvent): StreamState {
  return streamReducer(state, { type: 'event', event });
}

function retrievingState(): StreamState {
  const accepted = applyEvent(
    initialStreamState,
    asStreamEvent({
      eventType: 'message.accepted',
      requestId: 'request-evidence-frames',
      userMessageId: 'user-evidence-frames',
      assistantMessageId: 'assistant-evidence-frames',
    }),
  );

  return applyEvent(accepted, asStreamEvent({ eventType: 'retrieval.started' }));
}

function rerankedState(): StreamState {
  const embedded = applyEvent(
    retrievingState(),
    asStreamEvent({ eventType: 'retrieval.progress', stage: 'embedded' }),
  );
  const searched = applyEvent(
    embedded,
    asStreamEvent({
      eventType: 'retrieval.progress',
      stage: 'searched',
      candidates: 59,
    }),
  );
  return applyEvent(
    searched,
    asStreamEvent({ eventType: 'retrieval.progress', stage: 'reranked' }),
  );
}

function evidenceFrame(index: number, total: number): StreamEvent {
  return asStreamEvent({
    eventType: 'retrieval.evidence',
    index,
    total,
    evidence: evidence[index],
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

function stateWithEvidenceFrames(count: number): StreamState {
  let state = retrievingState();
  for (let index = 0; index < count; index += 1) {
    state = applyEvent(state, evidenceFrame(index, count));
  }
  return state;
}

describe('streamReducer spec 47 근거 프레임 (FE 수용 기준 21~26·29)', () => {
  it('기준 21-a: 첫 retrieval.evidence는 해당 근거 1건만 담는다', () => {
    const next = applyEvent(retrievingState(), evidenceFrame(0, 3));

    expect(next.evidence).toEqual([evidence[0]]);
  });

  it('기준 21-b: index 0·1·2 프레임을 도착 순서 그대로 3건 누적한다', () => {
    const next = stateWithEvidenceFrames(3);

    expect(next.evidence).toHaveLength(3);
    expect(next.evidence).toEqual(evidence);
    expect(next.evidence.map((item) => item.id)).toEqual([
      'evidence-1',
      'evidence-2',
      'evidence-3',
    ]);
  });

  it('기준 21-c: 두 번째 프레임은 첫 근거를 덮지 않고 길이를 1에서 2로 늘린다', () => {
    const first = applyEvent(retrievingState(), evidenceFrame(0, 3));
    expect(first.evidence).toHaveLength(1);
    expect(first.evidence).toEqual([evidence[0]]);

    const second = applyEvent(first, evidenceFrame(1, 3));
    expect(second.evidence).toHaveLength(2);
    expect(second.evidence).toEqual(evidence.slice(0, 2));
  });

  it('기준 22-a: evidence 키 없는 retrieval.completed가 앞서 받은 3건을 보존한다', () => {
    const before = stateWithEvidenceFrames(3);
    expect(before.evidence).toEqual(evidence);

    const next = applyEvent(before, retrievalCompleted());

    expect(next.evidence).toEqual(evidence);
  });

  it('기준 22-b: evidence 빈 배열인 retrieval.completed도 앞서 받은 3건을 보존한다', () => {
    const before = stateWithEvidenceFrames(3);
    expect(before.evidence).toEqual(evidence);

    const next = applyEvent(before, retrievalCompleted([]));

    expect(next.evidence).toEqual(evidence);
  });

  it('기준 23-a: 구버전 retrieval.completed의 2건 배열도 그대로 받는다', () => {
    const legacy = applyEvent(retrievingState(), retrievalCompleted(evidence.slice(0, 2)));

    expect(legacy.evidence).toHaveLength(2);
    expect(legacy.evidence).toEqual(evidence.slice(0, 2));

    // 구버전 호환 단언만으로 현재 스텁이 통과하지 않도록 신규 프레임의 양성 배선을 함께 본다.
    const wiringGuard = applyEvent(retrievingState(), evidenceFrame(2, 3));
    expect(wiringGuard.evidence).toEqual([evidence[2]]);
  });

  it('기준 24-a: answer.started의 evidenceCount는 5이고 evidence는 아직 비어 있다', () => {
    const next = applyEvent(rerankedState(), answerStarted(5));

    expect(next.evidenceCount).toBe(5);
    expect(next.evidence).toEqual([]);
  });

  it('기준 24-e: evidenceCount 없는 answer.started는 null을 유지한다', () => {
    // null 부재 단언만으로 스텁이 통과하지 않게 count가 있는 신규 경로를 양성 대조로 둔다.
    const counted = applyEvent(rerankedState(), answerStarted(5));
    expect(counted.evidenceCount).toBe(5);

    const withoutCount = applyEvent(rerankedState(), answerStarted());
    expect(withoutCount.evidenceCount).toBeNull();
  });

  it('기준 25-a: 신규 순서의 answer.started는 phase를 generating으로 바꾼다', () => {
    const next = applyEvent(rerankedState(), answerStarted(5));

    // 기존 phase 회귀만으로 스텁이 통과하지 않도록 신규 페이로드 배선을 함께 확인한다.
    expect(next.evidenceCount).toBe(5);
    expect(next.phase).toBe('generating');
  });

  it('기준 25-b: answer.started 뒤 retrieval.evidence가 와도 generating에서 내려가지 않는다', () => {
    const generating = applyEvent(rerankedState(), answerStarted(5));
    expect(generating.evidenceCount).toBe(5);

    const next = applyEvent(generating, evidenceFrame(0, 3));

    expect(next.evidence).toEqual([evidence[0]]);
    expect(next.phase).toBe('generating');
  });

  it('기준 25-c: answer.started 뒤 retrieval.completed가 와도 generating에서 내려가지 않는다', () => {
    const generating = applyEvent(rerankedState(), answerStarted(5));
    const next = applyEvent(generating, retrievalCompleted());

    expect(next.phase).toBe('generating');
    expect(next.evidenceCount).toBe(5);
  });

  it('기준 26-a: 신규 순서 전체 뒤 첫 delta가 streaming·본문·nextSeq를 함께 갱신한다', () => {
    let state = applyEvent(rerankedState(), answerStarted(3));
    expect(state.evidenceCount).toBe(3);
    expect(state.evidence).toEqual([]);

    for (let index = 0; index < 3; index += 1) {
      state = applyEvent(state, evidenceFrame(index, 3));
    }
    state = applyEvent(state, retrievalCompleted());

    // 첫 delta 회귀만으로 현재 스텁이 통과하지 않게 신규 순서가 살아 있음을 먼저 고정한다.
    expect(state.phase).toBe('generating');
    expect(state.evidence).toEqual(evidence);

    const next = applyEvent(
      state,
      asStreamEvent({
        eventType: 'answer.delta',
        messageId: 'assistant-evidence-frames',
        seq: 0,
        delta: '침 치료를 고려할 수 있습니다.',
      }),
    );

    expect(next).toMatchObject({
      phase: 'streaming',
      content: '침 치료를 고려할 수 있습니다.',
      nextSeq: 1,
    });
  });

  it('기준 29-a: 신규 근거 2건을 받은 상태에서 모르는 eventType은 같은 참조를 돌려준다', () => {
    const prev = stateWithEvidenceFrames(2);

    // 무배선 스텁이 아래의 부재 단언만으로 통과하지 못하게 하는 양성 배선 가드다.
    expect(prev.evidence).toEqual(evidence.slice(0, 2));

    const next = applyEvent(prev, asStreamEvent({ eventType: 'answer.thinking' }));

    expect(next).toBe(prev);
  });

  it('기준 29-b: 신규 근거 2건을 받은 상태에서 모르는 stage는 같은 참조를 돌려준다', () => {
    const prev = stateWithEvidenceFrames(2);

    // 무배선 스텁이 아래의 부재 단언만으로 통과하지 못하게 하는 양성 배선 가드다.
    expect(prev.evidence).toEqual(evidence.slice(0, 2));

    const next = applyEvent(
      prev,
      asStreamEvent({ eventType: 'retrieval.progress', stage: 'reembedded' }),
    );

    expect(next).toBe(prev);
  });
});

describe('spec 47 대기 문구 카탈로그 (FE 수용 기준 27·28)', () => {
  it('기준 27-c·28-a: ko 분석 문구는 확정 문자열이고 embedded 문구와 다르다', () => {
    const ko = messagesFor('ko');

    expect(ko.analyzingQuestion).toBe('질문을 분석하는 중…');
    expect(ko.analyzingQuestion).not.toBe(ko.retrievalStageEmbedded);
  });

  it('기준 27-d·28-b: en 분석 문구는 확정 문자열이고 embedded 문구와 다르다', () => {
    const en = messagesFor('en');

    expect(en.analyzingQuestion).toBe('Analyzing your question…');
    expect(en.analyzingQuestion).not.toBe(en.retrievalStageEmbedded);
  });
});
