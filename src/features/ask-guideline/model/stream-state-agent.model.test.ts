// spec 52 FE 수용 기준 14~23·28(reducer) 동결 테스트. 구현 중 수정 금지.
import { describe, expect, it } from 'vitest';
import { initialStreamState, streamReducer, type StreamState, type EvidenceDetail } from './stream-state.model';
import type { StreamEvent } from '@/shared/api/stream-client';

const event = (state: StreamState, value: StreamEvent) => streamReducer(state, { type: 'event', event: value });
const accepted = () => event(initialStreamState, { eventType: 'message.accepted', requestId: 'r-901', userMessageId: 'u-901', assistantMessageId: 'a-901' });
const routed = (state: StreamState, route: string) => event(state, { eventType: 'agent.progress', stage: 'routed', route });
const loaded = (state: StreamState) => event(state, { eventType: 'agent.progress', stage: 'patient_loaded' });
const composite = () => loaded(routed(accepted(), 'COMPOSITE'));
const evidence: EvidenceDetail[] = [901, 902].map((id) => ({ id: `ev-${id}`, guidelineId: `gl-${id}`, guidelineVersionId: `gv-${id}`, guidelineTitle: `합성 지침 ${id}`, version: '1.0', sectionPath: ['합성 권고'], excerpt: `합성 근거 ${id}`, sourceUrl: `https://example.test/${id}` }));

describe('spec 52 agent.progress reducer', () => {
  // 각 테스트의 RED 근거: 현재 reducer는 agent.progress를 무시해 route=null, loaded=false다.
  it('14-a·17-a·17-b·18-a: PATIENT의 사실만 채우고 accepted phase를 유지한다', () => {
    const patient = routed(accepted(), 'PATIENT');
    expect(patient.agentRoute).toBe('PATIENT'); // 14-a / 17-a의 양성 가드
    expect(patient.phase).toBe('accepted'); // 17-a
    const next = loaded(patient);
    expect(next.phase).toBe('accepted'); // 17-b
    expect(next.patientLoaded).toBe(true); // 17-b·18-a 공통 검증 지점
    expect(next.agentRoute).toBe('PATIENT'); // 18-a 유지
  });
  it('15-a·17-c: COMPOSITE 검색 중 patient_loaded 재도착도 phase를 보존한다', () => {
    const route = routed(accepted(), 'COMPOSITE');
    expect(route.agentRoute).toBe('COMPOSITE'); // 15-a 및 RED 가드
    const before = event(loaded(route), { eventType: 'retrieval.started' });
    expect(before.phase).toBe('retrieving'); // 17-c
    expect(loaded(before).phase).toBe('retrieving');
  });
  it.each(['GUIDELINE', 'OTHER'])('16-c: %s도 경로는 기록한다', (route) => {
    expect(routed(accepted(), route).agentRoute).toBe(route);
  });
  it('19-a: 환자 경로는 검색 없이 delta로 곧장 streaming이 된다', () => {
    const before = loaded(routed(accepted(), 'PATIENT'));
    expect(before.patientLoaded).toBe(true); // 회귀 단언의 양성 배선 가드
    const next = event(before, { eventType: 'answer.delta', seq: 0, delta: 'CASE-901 합성 기록 요약입니다.' });
    expect(next.phase).toBe('streaming');
    expect(next.content).toBe('CASE-901 합성 기록 요약입니다.');
    expect(next.nextSeq).toBe(1);
    expect(next.evidence).toEqual([]);
    expect(next.retrievalStage).toBeNull();
  });
  it('20-c·21-d: 검색과 생성이 복합 경로의 환자 사실을 지우지 않는다', () => {
    const searching = event(event(composite(), { eventType: 'retrieval.started' }), { eventType: 'retrieval.progress', stage: 'embedded' });
    expect(searching.retrievalStage).toBe('embedded'); // 20-c
    expect(searching.agentRoute).toBe('COMPOSITE');
    expect(searching.patientLoaded).toBe(true);
    const next = event(event(searching, { eventType: 'retrieval.progress', stage: 'reranked' }), { eventType: 'answer.started', evidenceCount: 3 });
    expect(next.phase).toBe('generating'); // 21-d
    expect(next.evidenceCount).toBe(3);
    expect(next.agentRoute).toBe('COMPOSITE');
    expect(next.patientLoaded).toBe(true);
  });
  it.each([
    ['23-a', { eventType: 'agent.progress', stage: 'routed', route: 'TRIAGE' }],
    ['23-b', { eventType: 'agent.progress', stage: 'summarized' }],
    ['23-c', { eventType: 'agent.progress' }],
  ] as const)('%s: 모르는 진행은 같은 참조다', (_point, value) => {
    const before = accepted();
    expect(event(before, value)).toBe(before);
    // 각각의 it 안에 양성 배선 가드: default:return state 스텁도 위 단언은 통과한다.
    expect(routed(before, 'PATIENT').agentRoute).toBe('PATIENT');
  });
  it('23-d: 모르는 route가 이미 아는 PATIENT를 지우지 않는다', () => {
    const before = routed(accepted(), 'PATIENT');
    expect(routed(before, 'TRIAGE').agentRoute).toBe('PATIENT');
  });
  it('28-b: 복합 근거 프레임은 순서대로 쌓이며 generating을 유지한다', () => {
    let state = event(event(composite(), { eventType: 'retrieval.started' }), { eventType: 'answer.started', evidenceCount: 2 });
    evidence.forEach((item, index) => { state = event(state, { eventType: 'retrieval.evidence', index, total: 2, evidence: item }); });
    expect(state.evidence).toEqual(evidence);
    expect(state.phase).toBe('generating');
    expect(state.agentRoute).toBe('COMPOSITE'); // RED 가드
  });
});
