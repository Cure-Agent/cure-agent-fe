// @vitest-environment happy-dom
// docs/specs/57 FE 수용 기준 1~6·8~13·16 동결 테스트 — 구현 중 수정 금지
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '../api/send-message';
import type { AnswerCitation, GuidanceDto, MessageDto } from '../model/stream-state.model';
import { resetAllStreams } from '../model/stream-store';
import { envelope, errorEnvelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';

const sendMessageStreamMock = vi.hoisted(() =>
  vi.fn<(args: SendMessageArgs) => Promise<void>>(),
);

vi.mock('../api/send-message', () => ({
  sendMessageStream: sendMessageStreamMock,
}));

import { ChatPanel } from './chat-panel';

useMswServer();

const PAGE = { size: 50, hasNext: false, nextCursor: null };
const DATE = '2026-09-30T00:00:00.000Z';
const PATIENT_ID = 'patient-synthetic-57';
const QUESTION = 'CASE-057 합성진단-57a 기록의 확인 순서를 정리해 주세요.';
const QUESTION_TWO = 'CASE-057 두 번째 합성 관찰 기록도 구분해 주세요.';
const LAST_SENTENCE = '마지막 합성 확인 결과는 검토자가 별도의 의견으로 기록합니다.';
const ANSWER = 'CASE-057 합성진단-57a에 관한 기록을 확인하기 위해 먼저 합성 관찰 항목과 누락된 정보를 구분합니다 [1]. 이 자료는 실제 환자의 기록이 아닌 합성 사례이며 첫 번째 항목의 관찰 시점과 두 번째 항목의 기록 시점이 서로 다를 수 있으므로 각각의 조건을 확인해야 합니다. 합성약물-57b와 합성알레르기-57c는 검토를 위한 예시 값으로 제시되었으며 추가 정보가 도착하면 검토 의견에 그 내용을 반영합니다 [2]. 제시된 참고 항목의 적용 여부는 합성 기록에 있는 정보와 아직 확인되지 않은 정보를 함께 살펴 정리합니다. ' + LAST_SENTENCE;
const SUMMARY = `${ANSWER.slice(0, 200)}…`;
const CITATIONS: AnswerCitation[] = [
  {
    marker: 1,
    evidenceId: 'evidence-synthetic-57a',
    guidelineTitle: '합성 관찰 지침 57a',
    guidelineVersion: '1.0',
    sectionPath: ['합성 관찰', '확인'],
    quote: '합성 관찰 항목의 기록 시점을 확인합니다.',
    sourceUrl: 'https://example.test/guideline-57a',
  },
  {
    marker: 2,
    evidenceId: 'evidence-synthetic-57b',
    guidelineTitle: '합성 검토 지침 57b',
    guidelineVersion: '2.0',
    sectionPath: ['합성 검토', '보완'],
    quote: '합성 기록의 누락 정보를 구분합니다.',
    sourceUrl: 'https://example.test/guideline-57b',
  },
];
const DRAFT_GUIDANCE: GuidanceDto = {
  id: 'guidance-synthetic-57',
  patientId: PATIENT_ID,
  patientProfileSnapshotId: 'snapshot-synthetic-57',
  summary: SUMMARY,
  considerations: [{
    title: '합성진단-57a 첫 검토 항목',
    rationale: '합성 관찰 기록의 확인 조건입니다.',
    citations: [],
  }],
  safetyAlerts: [{
    severity: 'WARNING',
    description: '합성알레르기-57c 기록의 확인이 필요합니다.',
    citations: [],
  }],
  missingInformation: ['합성 관찰 시각'],
  reviewStatus: 'DRAFT',
  generatedAt: DATE,
};
const ACCEPTED_GUIDANCE: GuidanceDto = { ...DRAFT_GUIDANCE, reviewStatus: 'ACCEPTED' };
// 종결 메시지에는 guidanceId가 없다. 이벤트의 guidance가 카드 여부를 정한다.
const ANSWER_MESSAGE: MessageDto = {
  id: 'assistant-synthetic-57',
  role: 'ASSISTANT',
  content: ANSWER,
  status: 'COMPLETED',
  responseLang: 'ko',
  citations: CITATIONS,
  createdAt: '2026-09-30T00:00:01.000Z',
};
const QUESTION_SAVED: MessageDto = {
  id: 'user-synthetic-57',
  role: 'USER',
  content: QUESTION,
  status: 'COMPLETED',
  citations: [],
  createdAt: DATE,
};
const ANSWER_SAVED: MessageDto = {
  ...ANSWER_MESSAGE,
  guidanceId: ACCEPTED_GUIDANCE.id,
  answerKind: 'CLINICAL_GUIDANCE',
};
const PLAIN_MESSAGE: MessageDto = {
  ...ANSWER_MESSAGE,
  id: 'assistant-plain-synthetic-57',
  content: 'CASE-057 참고안 없는 합성 답변입니다 [1][2].',
  answerKind: 'GUIDELINE_ANSWER',
};

function mockContext(id: string) {
  server.use(
    http.get(`/api/v1/conversations/${id}`, () =>
      HttpResponse.json(envelope({
        id,
        type: 'PATIENT_GUIDANCE',
        patientId: PATIENT_ID,
        title: 'CASE-057 합성 환자 대화',
        status: 'ACTIVE',
        lastMessageAt: DATE,
        createdAt: DATE,
      })),
    ),
    http.get(`/api/v1/patients/${PATIENT_ID}`, () =>
      HttpResponse.json(envelope({
        id: PATIENT_ID,
        caseLabel: 'CASE-057',
        status: 'ACTIVE',
        version: 1,
        diagnoses: ['합성진단-57a'],
        medications: ['합성약물-57b'],
        allergies: ['합성알레르기-57c'],
      })),
    ),
  );
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('질문 입력'), QUESTION);
  await user.click(screen.getByRole('button', { name: '전송' }));
}

describe('스트림 종결: 카드가 답변을 품는다 (PATIENT_GUIDANCE)', () => {
  beforeEach(() => {
    sendMessageStreamMock.mockReset();
    resetAllStreams();
  });

  afterEach(() => {
    cleanup();
    resetAllStreams();
    vi.restoreAllMocks();
  });

  async function complete(
    id: string,
    callbacks: Pick<Parameters<typeof ChatPanel>[0], 'onShowCitations' | 'onSelectMarker'> = {},
  ) {
    mockContext(id);
    let persisted: MessageDto[] = [];
    let servedSavedAnswer = false;
    server.use(
      http.get(`/api/v1/conversations/${id}/messages`, () => {
        if (persisted.some((message) => message.id === ANSWER_MESSAGE.id)) {
          servedSavedAnswer = true;
        }
        return HttpResponse.json(envelope(persisted, PAGE));
      }),
      http.get(`/api/v1/clinical-guidance/${DRAFT_GUIDANCE.id}`, () =>
        HttpResponse.json(envelope(DRAFT_GUIDANCE)),
      ),
    );
    sendMessageStreamMock.mockImplementation(async (args) => {
      args.onEvent({
        eventType: 'message.accepted',
        requestId: `${id}-request`,
        userMessageId: QUESTION_SAVED.id,
        assistantMessageId: ANSWER_MESSAGE.id,
      });
      persisted = [
        { ...ANSWER_MESSAGE, guidanceId: DRAFT_GUIDANCE.id, answerKind: 'CLINICAL_GUIDANCE' },
        QUESTION_SAVED,
      ];
      args.onEvent({
        eventType: 'answer.completed',
        message: ANSWER_MESSAGE,
        guidance: DRAFT_GUIDANCE,
      });
    });
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(
      <ChatPanel conversationId={id} {...callbacks} />,
    );
    await screen.findByLabelText('질문 입력');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    await submit(user);
    await screen.findByRole('region', { name: '임상 참고안' });
    await waitFor(() => expect(servedSavedAnswer).toBe(true));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    return {
      user,
      queryClient,
      card: screen.getByRole('region', { name: '임상 참고안' }),
    };
  }

  it('기준 1: 카드 안에 200자를 넘는 답변 전문과 마지막 문장이 있다', async () => {
    const { card } = await complete('spec57-stream-1');
    expect(within(card).getByText(ANSWER)).toBeInTheDocument();
    expect(ANSWER.length).toBeGreaterThan(200);
    expect(card).toHaveTextContent(LAST_SENTENCE);
  });

  it('기준 2: 답변은 화면에 한 번만 있고 그 하나가 카드 안에 있다', async () => {
    const { card } = await complete('spec57-stream-2');
    const answers = screen.getAllByText(ANSWER);
    expect(answers).toHaveLength(1);
    expect(card.contains(answers[0])).toBe(true);
  });

  it('기준 3: 답변 앞 200자와 말줄임표인 summary는 화면에 없다', async () => {
    await complete('spec57-stream-3');
    expect(screen.queryByText(SUMMARY)).toBeNull();
    expect(document.body).not.toHaveTextContent(SUMMARY);
  });

  it('기준 4: 카드 안에서 답변 본문이 첫 검토 항목보다 앞에 선다', async () => {
    const { card } = await complete('spec57-stream-4');
    const answerNode = within(card).getByText(ANSWER);
    const itemNode = await within(card).findByText(DRAFT_GUIDANCE.considerations[0].title);
    expect(answerNode.compareDocumentPosition(itemNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('기준 5: 카드 안 답변의 인용 칩은 메시지의 전체 인용과 마커를 전달한다', async () => {
    const onShowCitations = vi.fn();
    const onSelectMarker = vi.fn();
    const { card, user } = await complete('spec57-stream-5', { onShowCitations, onSelectMarker });
    await user.click(within(card).getByRole('button', { name: '[2]' }));
    expect(onShowCitations).toHaveBeenCalledTimes(1);
    expect(onShowCitations).toHaveBeenCalledWith(CITATIONS, 2, expect.anything());
    expect(onSelectMarker).toHaveBeenCalledWith(2);
  });

  it('기준 6: 답변을 품은 카드의 검토를 해당 id로 한 번 POST하고 수정 반영을 표시한다', async () => {
    const reviews: { path: string; body: unknown }[] = [];
    server.use(
      http.post('/api/v1/clinical-guidance/:guidanceId/reviews', async ({ request }) => {
        reviews.push({ path: new URL(request.url).pathname, body: await request.json() });
        return HttpResponse.json(envelope({ ...DRAFT_GUIDANCE, reviewStatus: 'MODIFIED' }));
      }),
    );
    const { card, user } = await complete('spec57-stream-6');
    expect(within(card).getByText(ANSWER)).toBeInTheDocument();
    const note = 'CASE-057 합성 관찰 시각을 보완하여 검토했습니다.';
    await user.click(await within(card).findByRole('radio', { name: 'MODIFIED' }));
    await user.type(within(card).getByLabelText('검토 의견'), note);
    await user.click(within(card).getByRole('button', { name: '검토 확정' }));
    await waitFor(() => {
      expect(reviews).toHaveLength(1);
      expect(reviews[0].path).toBe(`/api/v1/clinical-guidance/${DRAFT_GUIDANCE.id}/reviews`);
      expect(reviews[0].body).toEqual({ decision: 'MODIFIED', note });
    });
    expect(await within(card).findByText('수정 반영')).toBeInTheDocument();
    expect(reviews).toHaveLength(1);
  });

  it('기준 16 ⑵: guidance 없는 로컬 종결 답변에는 카드와 조회 안내가 없다', async () => {
    const id = 'spec57-stream-16-2';
    mockContext(id);
    let completed = false;
    let servedAfterCompletion = false;
    server.use(
      http.get(`/api/v1/conversations/${id}/messages`, () => {
        if (completed) servedAfterCompletion = true;
        // M⑴과 격리: 종결 뒤에도 목록에는 답변을 넣지 않는다.
        return HttpResponse.json(envelope([], PAGE));
      }),
    );
    sendMessageStreamMock.mockImplementation(async (args) => {
      args.onEvent({
        eventType: 'message.accepted',
        requestId: `${id}-request`,
        userMessageId: QUESTION_SAVED.id,
        assistantMessageId: PLAIN_MESSAGE.id,
      });
      completed = true;
      args.onEvent({ eventType: 'answer.completed', message: PLAIN_MESSAGE });
    });
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<ChatPanel conversationId={id} />);
    await screen.findByLabelText('질문 입력');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    await submit(user);
    await screen.findByText(PLAIN_MESSAGE.content);
    await waitFor(() => expect(servedAfterCompletion).toBe(true));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.getByText(PLAIN_MESSAGE.content)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '임상 참고안' })).toBeNull();
    expect(screen.queryByText('임상 참고안')).toBeNull();
    expect(screen.queryByText('임상 참고안 불러오는 중…')).toBeNull();
  });
});

describe('새로고침 복원: 카드 틀이 먼저 선다 (PATIENT_GUIDANCE)', () => {
  let releases: (() => void)[] = [];

  beforeEach(() => {
    releases = [];
    sendMessageStreamMock.mockReset();
    resetAllStreams();
  });

  afterEach(() => {
    cleanup();
    for (const release of releases) release();
    resetAllStreams();
    vi.restoreAllMocks();
  });

  async function restore(id: string, items: MessageDto[] = [ANSWER_SAVED, QUESTION_SAVED], failed = false) {
    mockContext(id);
    let requested = false;
    let release!: () => void;
    const responseGate = new Promise<void>((resolve) => { release = resolve; });
    releases.push(release);
    server.use(
      http.get(`/api/v1/conversations/${id}/messages`, () =>
        HttpResponse.json(envelope(items, PAGE)),
      ),
      http.get('/api/v1/clinical-guidance/:guidanceId', async () => {
        requested = true;
        await responseGate;
        return failed
          ? HttpResponse.json(errorEnvelope('SYNTHETIC_GUIDANCE_NOT_FOUND', '합성 참고안 조회 실패'), { status: 404 })
          : HttpResponse.json(envelope(ACCEPTED_GUIDANCE));
      }),
    );
    const result = renderWithProviders(<ChatPanel conversationId={id} />);
    // 요청이 실제 도착했으며 응답은 아직 풀리지 않은 시점이다.
    await waitFor(() => expect(requested).toBe(true));
    expect(sendMessageStreamMock).not.toHaveBeenCalled();
    return { ...result, release };
  }

  it('기준 8: 참고안 응답 전 카드 안에 답변이 있고 검토 항목은 없다', async () => {
    await restore('spec57-restore-8');
    const card = screen.getByRole('region', { name: '임상 참고안' });
    expect(card).toBeInTheDocument();
    expect(within(card).getByText(ANSWER)).toBeInTheDocument();
    expect(screen.queryByText(ACCEPTED_GUIDANCE.considerations[0].title)).toBeNull();
  });

  it('기준 9: 참고안 응답 전 카드 안에 불러오는 중 문구가 있다', async () => {
    await restore('spec57-restore-9');
    const card = screen.getByRole('region', { name: '임상 참고안' });
    expect(within(card).getByText('임상 참고안 불러오는 중…')).toBeInTheDocument();
  });

  it('기준 10: 참고안 응답 전 답변은 한 번만 있고 카드 안에 있다', async () => {
    await restore('spec57-restore-10');
    const card = screen.getByRole('region', { name: '임상 참고안' });
    const answers = screen.getAllByText(ANSWER);
    expect(answers).toHaveLength(1);
    expect(card.contains(answers[0])).toBe(true);
  });

  it('기준 11: 도착한 참고안의 항목과 승인 상태가 동일한 카드에 채워진다', async () => {
    const { release } = await restore('spec57-restore-11');
    const cardBefore = screen.getByRole('region', { name: '임상 참고안' });
    release();
    expect(await within(cardBefore).findByText(ACCEPTED_GUIDANCE.considerations[0].title)).toBeInTheDocument();
    expect(await within(cardBefore).findByText('승인됨')).toBeInTheDocument();
    expect(within(cardBefore).getByText(ANSWER)).toBeInTheDocument();
    expect(cardBefore.isConnected).toBe(true);
    expect(screen.getAllByRole('region', { name: '임상 참고안' })).toEqual([cardBefore]);
    expect(within(cardBefore).queryByText('임상 참고안 불러오는 중…')).toBeNull();
  });

  it('기준 12: 참고안 조회 실패 뒤에도 같은 카드 안에 답변과 실패 문구가 있다', async () => {
    const { release } = await restore('spec57-restore-12', [ANSWER_SAVED, QUESTION_SAVED], true);
    const card = screen.getByRole('region', { name: '임상 참고안' });
    release();
    expect(await within(card).findByText('임상 참고안을 불러오지 못했습니다')).toBeInTheDocument();
    expect(within(card).getByText(ANSWER)).toBeInTheDocument();
  });

  it('기준 13: 응답 전 카드가 첫 질문 뒤와 두 번째 질문 앞에 선다', async () => {
    const questionTwo: MessageDto = {
      ...QUESTION_SAVED,
      id: 'user-second-synthetic-57',
      content: QUESTION_TWO,
      createdAt: '2026-09-30T00:00:02.000Z',
    };
    const answerTwo: MessageDto = {
      ...PLAIN_MESSAGE,
      createdAt: '2026-09-30T00:00:03.000Z',
    };
    await restore('spec57-restore-13', [answerTwo, questionTwo, ANSWER_SAVED, QUESTION_SAVED]);
    const questionOneNode = screen.getByText(QUESTION);
    const card = screen.getByRole('region', { name: '임상 참고안' });
    const questionTwoNode = screen.getByText(QUESTION_TWO);
    expect(questionOneNode.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card.compareDocumentPosition(questionTwoNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('기준 16 ⑴: guidanceId 없는 저장 완료 답변에는 카드와 조회 안내가 없다', async () => {
    const id = 'spec57-restore-16-1';
    mockContext(id);
    server.use(
      http.get(`/api/v1/conversations/${id}/messages`, () =>
        HttpResponse.json(envelope([PLAIN_MESSAGE, QUESTION_SAVED], PAGE)),
      ),
    );
    const { queryClient } = renderWithProviders(<ChatPanel conversationId={id} />);
    await screen.findByText(PLAIN_MESSAGE.content);
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.getByText(PLAIN_MESSAGE.content)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '임상 참고안' })).toBeNull();
    expect(screen.queryByText('임상 참고안')).toBeNull();
    expect(screen.queryByText('임상 참고안 불러오는 중…')).toBeNull();
    expect(sendMessageStreamMock).not.toHaveBeenCalled();
  });
});
