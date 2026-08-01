/**
 * 채팅 고정 뷰포트 + 위로 무한 스크롤.
 *
 * 단위 테스트는 레이아웃 값이 없는 happy-dom에서 돈다 — 초기 하단 정렬,
 * 프리펜드 후 보던 위치 유지 같은 실제 스크롤 기하는 진짜 브라우저에서만 검증된다.
 */
import { expect, test } from '@playwright/test';
import type { components } from '../src/shared/api/generated/schema';
import { mockApi, ok, okList } from './fixtures/api';
import { CLINICIAN, CONVERSATION } from './fixtures/data';

type Message = components['schemas']['MessageResponseDto'];

const TOTAL = 60;
const PAGE_SIZE = 30;

/** 시간순 n번째(1부터) 메시지 — 패딩 라벨이라 부분일치 충돌이 없다 */
function message(n: number): Message {
  const label = String(n).padStart(3, '0');
  return {
    id: `msg-${label}`,
    role: n % 2 === 1 ? 'USER' : 'ASSISTANT',
    content: `${label}번째 메시지`,
    status: 'COMPLETED',
    citations: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

test('처음엔 최신이 하단 정렬로 보이고, 위로 스크롤하면 과거가 보던 위치를 유지한 채 붙는다', async ({
  page,
}) => {
  const api = await mockApi(page, {
    'GET /api/v1/auth/me': ok(CLINICIAN),
    'GET /api/v1/conversations': okList([CONVERSATION]),
    'GET /api/v1/conversations/:conversationId/messages': ({ searchParams }) => {
      expect(searchParams.order).toBe('desc');
      // desc 페이징: 첫 페이지 = 최신 30개(60..31), 커서 페이지 = 과거 30개(30..1)
      const range = searchParams.cursor
        ? Array.from({ length: PAGE_SIZE }, (_, i) => PAGE_SIZE - i)
        : Array.from({ length: PAGE_SIZE }, (_, i) => TOTAL - i);
      const hasNext = !searchParams.cursor;
      return {
        json: {
          success: true,
          code: 'SUCCESS',
          message: '요청에 성공하였습니다.',
          data: range.map(message),
          page: { size: PAGE_SIZE, hasNext, nextCursor: hasNext ? 'cursor-031' : null },
          timestamp: '2026-01-01T00:00:00.000Z',
          traceId: 'e2e-trace',
        },
      };
    },
  });

  await page.goto(`/assistant?conversation=${CONVERSATION.id}`);

  const container = page.getByTestId('chat-messages');
  await expect(container.getByText('060번째 메시지')).toBeVisible();

  // 화면 전체는 고정 — 문서 레벨 세로 스크롤이 생기면 안 된다
  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  expect(pageOverflow).toBeLessThanOrEqual(0);

  // 초기 진입 = 최신(하단) 정렬
  const initial = await container.evaluate((el) => ({
    gapToBottom: el.scrollHeight - el.scrollTop - el.clientHeight,
    scrollable: el.scrollHeight > el.clientHeight,
    scrollbarWidth: getComputedStyle(el).scrollbarWidth,
  }));
  expect(initial.scrollable).toBe(true);
  expect(initial.gapToBottom).toBeLessThanOrEqual(2);
  expect(initial.scrollbarWidth).toBe('none'); // 보이지 않는 스크롤바

  // 첫 페이지 경계: 31번은 있고 30번은 아직 없다
  await expect(container.getByText('031번째 메시지')).toBeAttached();
  await expect(container.getByText('030번째 메시지')).not.toBeAttached();

  // 최상단으로 스크롤 → 과거 페이지 로드
  await container.evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect(container.getByText('001번째 메시지')).toBeAttached();

  // 프리펜드 보정 — 보던 지점(구 최상단 근처)이 유지되므로 scrollTop이 0에 머물지 않는다
  const adjusted = await container.evaluate((el) => el.scrollTop);
  expect(adjusted).toBeGreaterThan(100);

  // 요청 계약: 두 번 모두 order=desc, 두 번째만 커서
  const messageCalls = api.callsTo('GET', '/api/v1/conversations/:conversationId/messages');
  expect(messageCalls.map((call) => call.searchParams.order)).toEqual(['desc', 'desc']);
  expect(messageCalls.map((call) => call.searchParams.cursor ?? null)).toEqual([
    null,
    'cursor-031',
  ]);

  expect(api.unhandled).toEqual([]);
});
