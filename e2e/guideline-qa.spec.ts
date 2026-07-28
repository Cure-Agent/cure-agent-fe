/**
 * 크리티컬 플로우 2 — 지침 질의: 대화 생성 → 질문 → 스트리밍 답변 → 인용 근거.
 *
 * 제품의 핵심 가치가 통째로 걸린 경로다. 그리고 이 앱에서 가장 조립이 많은 곳이기도 하다:
 * SSE 프레임 파싱(stream-client) → 이벤트 reducer(stream-state.model) → 3단 화면의
 * 패널 간 상태 전달(대화 목록 · 답변 · 근거)이 한 줄로 이어져야 화면에 답이 뜬다.
 * 단위 테스트는 이 조각들을 따로 검증한다 — 여기서는 이어붙인 전체가 도는지를 본다.
 */
import { expect, test } from '@playwright/test';
import { mockApi, ok, okList, stream } from './fixtures/api';
import {
  ANSWER_STREAM,
  ANSWER_TEXT,
  ASSISTANT_MESSAGE,
  CLINICIAN,
  CONVERSATION,
  EVIDENCE,
  QUESTION,
  USER_MESSAGE,
} from './fixtures/data';

const STREAM_PATH = '/api/v1/conversations/:conversationId/messages/stream';

test('질문하면 스트리밍 답변과 인용 근거가 함께 도착한다', async ({ page }) => {
  // 대화·메시지는 요청 시점의 서버 상태를 반영해야 한다 — 스트림이 끝나면
  // ChatPanel이 GET messages를 다시 부르고(§8: GET messages가 최종 진실) 그 응답이 화면의 최종본이 된다
  let conversations: unknown[] = [];
  let messages: unknown[] = [];

  const api = await mockApi(page, {
    'GET /api/v1/auth/me': ok(CLINICIAN),
    'GET /api/v1/conversations': () => okList(conversations),
    'POST /api/v1/conversations': () => {
      conversations = [CONVERSATION];
      return ok(CONVERSATION);
    },
    'GET /api/v1/conversations/:conversationId/messages': () => okList(messages),
    [`POST ${STREAM_PATH}`]: () => {
      messages = [USER_MESSAGE, ASSISTANT_MESSAGE];
      return stream(ANSWER_STREAM);
    },
  });

  await page.goto('/assistant');

  // 대화가 없으면 질문을 받을 자리도 없다
  await expect(page.getByText('왼쪽에서 대화를 선택하거나 새 대화를 시작하세요')).toBeVisible();
  await expect(page.getByRole('heading', { name: '인용 근거' })).toBeVisible();

  await page.getByRole('button', { name: '새 대화' }).click();

  const composer = page.getByRole('textbox', { name: '질문 입력' });
  await expect(composer).toBeVisible();
  await composer.fill(QUESTION);
  await page.getByRole('button', { name: '전송' }).click();

  // 델타 조각이 순서대로 누적된 본문 그대로 떠야 한다 (seq 순서 처리 포함)
  await expect(page.getByText(ANSWER_TEXT)).toBeVisible();
  // 스트림 종결 후 서버 상태로 동기화되면 질문 버블도 함께 남는다
  await expect(page.getByText(QUESTION)).toBeVisible();

  // 근거 패널은 retrieval.completed로 채워진다 — 답변과 별개 경로다
  await expect(page.getByRole('button', { name: new RegExp(EVIDENCE.guidelineTitle) })).toBeVisible();
  await expect(page.getByText(`권고등급 A (강한 권고)`)).toBeVisible();

  // 답변의 인용 마커 → 근거 패널 항목 활성화 (marker = retrieval 순서, §8)
  await page.getByRole('button', { name: '[1]', exact: true }).click();
  await expect(page.locator('li[aria-current="true"]')).toContainText(EVIDENCE.guidelineTitle);

  // 전송 계약: 질문 본문 + 중복 생성 방지 키 (§8)
  const [streamCall] = api.callsTo('POST', STREAM_PATH);
  expect(streamCall.pathname).toBe(`/api/v1/conversations/${CONVERSATION.id}/messages/stream`);
  expect(streamCall.body).toMatchObject({ content: QUESTION });
  expect((streamCall.body as { clientRequestId?: unknown }).clientRequestId).toEqual(
    expect.stringMatching(/^[0-9a-f-]{36}$/),
  );

  expect(api.unhandled).toEqual([]);
});
