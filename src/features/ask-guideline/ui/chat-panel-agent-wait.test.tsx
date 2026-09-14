// @vitest-environment happy-dom
// spec 52 FE 수용 기준 14~29(화면·카탈로그) 동결 테스트. 구현 중 수정 금지.
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { SendMessageArgs } from '../api/send-message';
import type { EvidenceDetail, MessageDto, AnswerCitation } from '../model/stream-state.model';
import type { StreamEvent } from '@/shared/api/stream-client';
import { resetAllStreams } from '../model/stream-store';
import { messagesFor } from '@/shared/i18n/messages';
import { UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';

const sendMock = vi.hoisted(() => vi.fn<(args: SendMessageArgs) => Promise<void>>());
vi.mock('../api/send-message', () => ({ sendMessageStream: sendMock }));
import { ChatPanel } from './chat-panel';

useMswServer();
const PAGE = { size: 50, hasNext: false, nextCursor: null };
const ANALYZING = '질문을 분석하는 중…';
const READING = '환자 기록을 읽는 중…';
const DRAFTING = '환자 기록을 바탕으로 답변을 작성하는 중…';
const compositeLabel = (count: number) => `환자 기록과 지침 근거 ${count}건을 바탕으로 답변을 작성하는 중…`;
const guidelineLabel = (count: number) => `지침 근거 ${count}건을 바탕으로 답변을 작성하는 중…`;
const DELTA = 'CASE-901의 합성 기록을 요약한 답변입니다.';
const items: EvidenceDetail[] = [901, 902].map((id) => ({ id: `ev-${id}`, guidelineId: `gl-${id}`, guidelineVersionId: `gv-${id}`, guidelineTitle: `합성 지침 ${id}`, version: '1.0', sectionPath: ['합성 권고'], excerpt: `합성 근거 ${id}`, sourceUrl: `https://example.test/${id}` }));
const route = (value: string): StreamEvent => ({ eventType: 'agent.progress', stage: 'routed', route: value });
const loaded: StreamEvent = { eventType: 'agent.progress', stage: 'patient_loaded' };
const started: StreamEvent = { eventType: 'retrieval.started' };
const progress = (stage: string, candidates?: number): StreamEvent => ({ eventType: 'retrieval.progress', stage, ...(candidates === undefined ? {} : { candidates }) });
const answer = (evidenceCount: number): StreamEvent => ({ eventType: 'answer.started', evidenceCount });
const frame = (index: number, total: number): StreamEvent => ({ eventType: 'retrieval.evidence', index, total, evidence: items[index] });
type Live = { emit: (...events: StreamEvent[]) => void; assistantId: string };
type Props = Omit<ComponentProps<typeof ChatPanel>, 'conversationId'>;

function mockConversation(id: string, getMessages: () => MessageDto[] = () => []) {
  server.use(
    http.get(`/api/v1/conversations/${id}`, () => HttpResponse.json(envelope({ id, type: 'GUIDELINE_QA', title: '합성 대화 901', status: 'ACTIVE', lastMessageAt: '2026-09-15T00:00:00.000Z', createdAt: '2026-09-15T00:00:00.000Z' }))),
    http.get(`/api/v1/conversations/${id}/messages`, () => HttpResponse.json(envelope(getMessages(), PAGE))),
  );
}
const setupUser = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
async function sendQuestion(id: string, props: Props = {}, en = false, getMessages: () => MessageDto[] = () => []): Promise<Live> {
  mockConversation(id, getMessages);
  let emit: SendMessageArgs['onEvent'] | undefined;
  const assistantId = `${id}-assistant`;
  sendMock.mockImplementation((args) => {
    emit = args.onEvent;
    args.onEvent({ eventType: 'message.accepted', requestId: `${id}-request`, userMessageId: `${id}-user`, assistantMessageId: assistantId });
    return new Promise<void>(() => {});
  });
  renderWithProviders(<ChatPanel conversationId={id} {...props} />);
  const user = setupUser();
  await user.type(await screen.findByLabelText(en ? 'Question' : '질문 입력'), 'CASE-901 합성 기록을 설명해 주세요.');
  await user.click(screen.getByRole('button', { name: en ? 'Send' : '전송' }));
  await screen.findByText(en ? 'Analyzing your question…' : ANALYZING);
  return { assistantId, emit(...events) { act(() => { if (!emit) throw new Error('전송 전 이벤트 주입'); events.forEach(emit); }); } };
}
async function patientGuard(id: string) {
  // 양성 배선 가드: 회귀만으로는 통과하는 스텁도 새 환자 문구에서 탈락한다.
  const stream = await sendQuestion(id);
  stream.emit(route('PATIENT'));
  expect(screen.getByText(READING)).toBeInTheDocument();
}
async function advanceElapsed(milliseconds: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
}
function abstained(id: string, abstainReason: string): MessageDto {
  return { id, role: 'ASSISTANT', content: '', status: 'ABSTAINED', citations: [], createdAt: '2026-09-15T00:00:00.000Z', abstainReason };
}
beforeEach(() => {
  (globalThis as unknown as { jest?: unknown }).jest = { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) };
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-15T00:00:00.000Z'));
  sendMock.mockReset();
  resetAllStreams();
  stubNavigatorLanguage('ko-KR');
  stubStoredUiLang(UI_LANG_STORAGE_KEY, null);
});
afterEach(() => {
  cleanup();
  resetAllStreams();
  delete (globalThis as unknown as { jest?: unknown }).jest;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('spec 52 환자·복합 대기 문구', () => {
  // RED: 현재 reducer/화면은 agent.progress를 소비하지 않으므로 새 문구가 나타나지 않는다.
  it.each([['14-b', 'PATIENT'], ['15-b', 'COMPOSITE']])('%s: routed/%s의 환자 읽기', async (_point, value) => {
    const stream = await sendQuestion(`reading-${value}`);
    stream.emit(route(value));
    expect(screen.getByText(READING)).toBeInTheDocument();
    expect(screen.queryByText(ANALYZING)).toBeNull();
  });
  it.each([['16-a', 'GUIDELINE'], ['16-b', 'OTHER']])('%s: %s는 분석 문구 유지', async (_point, value) => {
    const stream = await sendQuestion(`unchanged-${value}`);
    stream.emit(route(value));
    expect(screen.getByText(ANALYZING)).toBeInTheDocument();
    expect(screen.queryByText(READING)).toBeNull();
    cleanup();
    await patientGuard(`unchanged-guard-${value}`);
  });
  it('18-b·19-b: 환자 기록 읽기 → 작성 → 검색 없는 첫 delta', async () => {
    const stream = await sendQuestion('patient-delta-901');
    stream.emit(route('PATIENT'));
    expect(screen.getByText(READING)).toBeInTheDocument();
    stream.emit(loaded);
    expect(screen.getByText(DRAFTING)).toBeInTheDocument(); // 18-b / 19-b delta 직전
    expect(screen.queryByText(READING)).toBeNull();
    stream.emit({ eventType: 'answer.delta', seq: 0, delta: DELTA });
    expect(document.querySelector('[aria-live="polite"]')).toBeNull(); // 모든 대기 문구
    for (const text of [ANALYZING, READING, DRAFTING, '지침을 검색하는 중…', '근거를 정리하는 중…']) expect(screen.queryByText(text)).toBeNull();
    expect(screen.getByText(DELTA)).toBeInTheDocument();
    expect(document.body).toHaveTextContent('▍');
  });
  it('20-a·20-b: 복합 검색 단계가 환자 문구를 덮는다', async () => {
    const stream = await sendQuestion('composite-search-901');
    stream.emit(route('COMPOSITE'), loaded);
    expect(screen.getByText(DRAFTING)).toBeInTheDocument();
    stream.emit(started, progress('embedded'));
    expect(screen.getByText('지침을 검색하는 중…')).toBeInTheDocument();
    expect(screen.queryByText(DRAFTING)).toBeNull();
    expect(screen.queryByText(READING)).toBeNull();
    stream.emit(progress('searched', 12));
    expect(screen.getByText('후보 12건에서 근거를 고르는 중…')).toBeInTheDocument();
  });
  it('21-a~c: 복합 생성 건수는 근거 프레임 수가 아닌 evidenceCount다', async () => {
    const onEvidenceChange = vi.fn();
    const stream = await sendQuestion('composite-count-901', { onEvidenceChange });
    stream.emit(route('COMPOSITE'), loaded, started, progress('reranked'), answer(3));
    expect(screen.getByText(compositeLabel(3))).toBeInTheDocument(); // 21-a
    expect(screen.queryByText('근거를 정리하는 중…')).toBeNull();
    expect(onEvidenceChange).toHaveBeenLastCalledWith([], expect.anything()); // 21-b: 아직 프레임 없음
    expect(screen.queryByText(compositeLabel(0))).toBeNull();
    expect(screen.queryByText(guidelineLabel(3), { exact: true })).toBeNull(); // 21-c
    stream.emit(frame(0, 3));
    stream.emit(frame(1, 3));
    expect(screen.getByText(compositeLabel(3))).toBeInTheDocument();
    expect(screen.queryByText(compositeLabel(2))).toBeNull();
  });
  it('22-a: 지침 생성 문구는 그대로다', async () => {
    const stream = await sendQuestion('guideline-generating-901');
    stream.emit(route('GUIDELINE'), started, progress('reranked'), answer(2));
    expect(screen.getByText(guidelineLabel(2))).toBeInTheDocument();
    expect(screen.queryByText(compositeLabel(2))).toBeNull();
    cleanup();
    const guard = await sendQuestion('guideline-generating-guard-901');
    guard.emit(route('COMPOSITE'), loaded, started, progress('reranked'), answer(3));
    expect(screen.getByText(compositeLabel(3))).toBeInTheDocument(); // 회귀의 RED 가드
  });
  it('23-e: 미지의 TRIAGE는 새 문구를 만들지 않는다', async () => {
    const stream = await sendQuestion('unknown-route-901');
    stream.emit(route('TRIAGE'));
    expect(screen.getByText(ANALYZING)).toBeInTheDocument();
    expect(screen.queryByText(READING)).toBeNull();
    expect(screen.queryByText(DRAFTING)).toBeNull();
    expect(screen.queryByText(/환자 기록과 지침 근거/)).toBeNull();
    stream.emit(route('PATIENT'));
    expect(screen.getByText(READING)).toBeInTheDocument(); // 같은 테스트의 RED 가드
  });
  it('24-a: ko 카탈로그 3종의 정확한 문자열', () => {
    // RED: 세 값이 현재 (spec 52 미구현)이다.
    const t = messagesFor('ko');
    expect(t.agentReadingPatient).toBe('환자 기록을 읽는 중…');
    expect(t.agentDraftingFromPatient).toBe('환자 기록을 바탕으로 답변을 작성하는 중…');
    expect(t.agentDraftingComposite).toBe('환자 기록과 지침 근거 {count}건을 바탕으로 답변을 작성하는 중…');
  });
  it('24-b: en 카탈로그 3종의 정확한 문자열', () => {
    // RED: 세 값이 현재 (spec 52 not implemented)이다.
    const t = messagesFor('en');
    expect(t.agentReadingPatient).toBe('Reading the patient record…');
    expect(t.agentDraftingFromPatient).toBe('Drafting the answer from the patient record…');
    expect(t.agentDraftingComposite).toBe('Drafting the answer from the patient record and {count} guideline sources…');
  });
  it('24-c: 영어 화면은 환자 읽기·작성을 영어로 표시한다', async () => {
    stubStoredUiLang(UI_LANG_STORAGE_KEY, 'en');
    const stream = await sendQuestion('en-patient-901', {}, true);
    stream.emit(route('PATIENT'));
    expect(screen.getByText('Reading the patient record…')).toBeInTheDocument();
    expect(screen.queryByText(READING)).toBeNull();
    stream.emit(loaded);
    expect(screen.getByText('Drafting the answer from the patient record…')).toBeInTheDocument();
    expect(screen.queryByText(DRAFTING)).toBeNull();
    expect(screen.queryByText(READING)).toBeNull();
  });
  it('24-d: 영어 복합 생성 문구에 3건을 보간한다', async () => {
    stubStoredUiLang(UI_LANG_STORAGE_KEY, 'en');
    const stream = await sendQuestion('en-composite-901', {}, true);
    stream.emit(route('COMPOSITE'), loaded, started, progress('reranked'), answer(3));
    expect(screen.getByText('Drafting the answer from the patient record and 3 guideline sources…')).toBeInTheDocument();
  });
  it('25-a·25-b: 환자 단계 사이에서도 전송 시각부터 3초·5초가 이어진다', async () => {
    const stream = await sendQuestion('elapsed-patient-901');
    await advanceElapsed(3000);
    expect(screen.getByText('(3초)')).toBeInTheDocument();
    stream.emit(route('PATIENT'));
    expect(screen.getByText(READING)).toBeInTheDocument();
    expect(screen.getByText('(3초)')).toBeInTheDocument();
    expect(screen.queryByText('(0초)')).toBeNull();
    stream.emit(loaded);
    await advanceElapsed(2000);
    expect(screen.getByText(DRAFTING)).toBeInTheDocument();
    expect(screen.getByText('(5초)')).toBeInTheDocument();
    expect(screen.queryByText('(3초)')).toBeNull();
  });
});

describe('spec 52 기권·근거·인용', () => {
  it('26-a·26-b: OTHER와 PATIENT의 메시지 기권 사유를 그대로 표시한다', async () => {
    // RED: OTHER 회귀 뒤 별도 PATIENT의 읽기 문구가 스텁을 탈락시킨다.
    const other = await sendQuestion('abstain-other-901');
    const outside = '합성 질문은 CASE-901 기록과 지침의 범위 밖입니다.';
    other.emit(route('OTHER'), { eventType: 'answer.abstained', message: abstained(other.assistantId, outside), reason: 'out_of_scope' });
    const notice = await screen.findByText(outside);
    expect(notice.closest('.bg-amber-50')?.textContent).toBe(outside); // 26-a
    expect(screen.queryByText('out_of_scope')).toBeNull();
    cleanup();
    const patient = await sendQuestion('abstain-patient-901');
    patient.emit(route('PATIENT'));
    expect(screen.getByText(READING)).toBeInTheDocument();
    const unresolved = '합성 라벨 CASE-901에 대응하는 기록을 정하지 못했습니다.';
    patient.emit({ eventType: 'answer.abstained', message: abstained(patient.assistantId, unresolved), reason: 'patient_unresolved' });
    expect((await screen.findByText(unresolved)).closest('.bg-amber-50')?.textContent).toBe(unresolved); // 26-b
    expect(screen.queryByText(READING)).toBeNull();
  });
  it('27-a: 같은 기권 메시지는 스트림과 GET 재조회에서 같은 문장이다', async () => {
    // RED: 스트림의 환자 읽기 문구를 선행 단언한다.
    let persisted: MessageDto[] = [];
    const id = 'abstain-restored-901';
    const stream = await sendQuestion(id, {}, false, () => persisted);
    stream.emit(route('PATIENT'));
    expect(screen.getByText(READING)).toBeInTheDocument();
    const reason = '합성 라벨 CASE-902를 하나의 환자 기록으로 해석하지 못했습니다.';
    const message = abstained(stream.assistantId, reason);
    stream.emit({ eventType: 'answer.abstained', message, reason: 'patient_unresolved' });
    const streamedText = (await screen.findByText(reason)).textContent;
    cleanup();
    resetAllStreams(); // 로컬 최종본으로 재조회 테스트가 공허하게 통과하지 않게 한다.
    persisted = [message];
    renderWithProviders(<ChatPanel conversationId={id} />);
    const restoredText = (await screen.findByText(reason)).textContent;
    expect(streamedText).toBe(reason);
    expect(restoredText).toBe(reason);
    expect(restoredText).toBe(streamedText);
  });
  it('28-a·29-a: 복합 근거가 순서대로 쌓이고 완료 인용이 패널을 연다', async () => {
    // RED: 근거·인용 회귀 앞의 복합 생성 문구가 스텁을 탈락시킨다.
    const onEvidenceChange = vi.fn();
    const onShowCitations = vi.fn();
    const onSelectMarker = vi.fn();
    const stream = await sendQuestion('composite-citations-901', { onEvidenceChange, onShowCitations, onSelectMarker });
    stream.emit(route('COMPOSITE'), loaded, started, answer(2));
    expect(screen.getByText(compositeLabel(2))).toBeInTheDocument();
    stream.emit(frame(0, 2));
    expect(onEvidenceChange).toHaveBeenLastCalledWith([items[0]], expect.anything());
    stream.emit(frame(1, 2));
    expect(onEvidenceChange).toHaveBeenLastCalledWith(items, expect.anything()); // 28-a
    const citations: AnswerCitation[] = [{ marker: 1, evidenceId: items[0].id, guidelineTitle: items[0].guidelineTitle, guidelineVersion: items[0].version, sectionPath: items[0].sectionPath, quote: items[0].excerpt, sourceUrl: items[0].sourceUrl }];
    const message: MessageDto = { id: stream.assistantId, role: 'ASSISTANT', content: DELTA, status: 'COMPLETED', citations, createdAt: '2026-09-15T00:00:01.000Z' };
    stream.emit({ eventType: 'retrieval.completed' }, { eventType: 'answer.delta', seq: 0, delta: DELTA }, { eventType: 'answer.completed', message });
    await setupUser().click(await screen.findByRole('button', { name: '[1]' }));
    expect(onShowCitations).toHaveBeenCalledWith(citations, 1, expect.anything()); // 29-a
    expect(onSelectMarker).toHaveBeenCalledWith(1);
  });
});
