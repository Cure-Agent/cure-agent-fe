// mobile-chat-layout 수용 기준 동결 테스트. 구현 중 수정 금지.
import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/shared/api/generated/schema';
import { mockApi, ok, okList } from './fixtures/api';
import {
  ASSISTANT_MESSAGE,
  CLINICIAN,
  CONVERSATION,
  EVIDENCE,
  USER_MESSAGE,
} from './fixtures/data';

type Conversation = components['schemas']['ConversationSummaryResponseDto'];

const EMPTY_CONVERSATION: Conversation = {
  ...CONVERSATION,
  id: 'conv-empty',
  title: '무릎 통증 상담',
};
const NEW_CONVERSATION: Conversation = {
  ...CONVERSATION,
  id: 'conv-new',
  title: '새 대화',
  type: 'GUIDELINE_QA',
};
const SCROLL_CONVERSATIONS: Conversation[] = Array.from({ length: 40 }, (_, index) => {
  const label = String(index + 1).padStart(2, '0');
  return { ...CONVERSATION, id: `conv-scroll-${label}`, title: `대화 ${label}` };
});

async function mockAssistant(page: Page, initial: Conversation[] = [CONVERSATION]) {
  let conversations = [...initial];
  return mockApi(page, {
    'GET /api/v1/auth/me': ok(CLINICIAN),
    'GET /api/v1/conversations': () => okList(conversations),
    'POST /api/v1/conversations': () => {
      conversations = [NEW_CONVERSATION, ...conversations];
      return ok(NEW_CONVERSATION);
    },
    'GET /api/v1/conversations/:conversationId': ({ params }) =>
      ok(conversations.find((conversation) => conversation.id === params.conversationId)),
    // 저장 메시지는 최신 답변부터 내려온다. 나머지 시드 대화에는 메시지가 없다.
    'GET /api/v1/conversations/:conversationId/messages': ({ params }) =>
      okList(params.conversationId === CONVERSATION.id ? [ASSISTANT_MESSAGE, USER_MESSAGE] : []),
    'GET /api/v1/guidelines': okList([]),
  });
}

async function openMobileConversation(page: Page) {
  await page.goto('/assistant');
  await page.getByRole('button', { name: CONVERSATION.title, exact: true }).tap();
  await expect(page.getByRole('button', { name: '대화 목록으로', exact: true })).toBeVisible();
}

async function openEvidenceSheet(page: Page) {
  await openMobileConversation(page);
  await page.getByRole('button', { name: '[1]', exact: true }).tap();
  await expect(page.getByRole('dialog', { name: '인용 근거', exact: true })).toBeVisible();
}

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.describe('모바일 목록과 채팅방', () => {
  test('A-1: 목록에서 대화를 열면 제목·뒤로가기·입력창과 대화 URL이 나타난다', async ({ page }) => {
    const api = await mockAssistant(page);
    await page.goto('/assistant');
    await expect(page.getByRole('button', { name: '새 대화', exact: true })).toBeVisible();
    const row = page.getByRole('button', { name: CONVERSATION.title, exact: true });
    await expect(row).toBeVisible();

    await row.tap();

    await expect(page.getByRole('button', { name: '대화 목록으로', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: CONVERSATION.title, exact: true })).toBeVisible();
    const composer = page.getByRole('textbox', { name: '질문 입력', exact: true });
    await expect(composer).toBeVisible();
    await expect(composer).toBeInViewport();
    await expect(page.getByRole('button', { name: '새 대화', exact: true })).toBeHidden();
    await expect(page).toHaveURL('/assistant?conversation=conv-1');
    expect(api.unhandled).toEqual([]);
  });

  test('A-2: 채팅방의 뒤로가기는 입력창을 숨기고 목록 URL로 돌아온다', async ({ page }) => {
    const api = await mockAssistant(page);
    await openMobileConversation(page);

    await page.getByRole('button', { name: '대화 목록으로', exact: true }).tap();

    await expect(page.getByRole('button', { name: '새 대화', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '대화 목록으로', exact: true })).toBeHidden();
    await expect(page.getByRole('textbox', { name: '질문 입력', exact: true })).toBeHidden();
    await expect(page).toHaveURL('/assistant');
    expect(api.unhandled).toEqual([]);
  });

  test('A-3: 돌아온 목록에서 방금 연 대화의 이름 변경·보관·삭제에 접근한다', async ({ page }) => {
    const api = await mockAssistant(page);
    await openMobileConversation(page);
    await page.getByRole('button', { name: '대화 목록으로', exact: true }).tap();
    await expect(page.getByRole('button', { name: '새 대화', exact: true })).toBeVisible();

    const selectedRow = page.getByRole('listitem').filter({
      has: page.getByRole('button', { name: CONVERSATION.title, exact: true }),
    });
    await expect(selectedRow.getByRole('button', { name: '이름 변경', exact: true })).toBeVisible();
    await expect(selectedRow.getByRole('button', { name: '보관', exact: true })).toBeVisible();
    await expect(selectedRow.getByRole('button', { name: '삭제', exact: true })).toBeVisible();
    expect(api.unhandled).toEqual([]);
  });

  test('A-4: 목록으로 돌아온 직후 앞으로가기로 같은 채팅방을 복원한다', async ({ page }) => {
    const api = await mockAssistant(page);
    await openMobileConversation(page);
    await page.getByRole('button', { name: '대화 목록으로', exact: true }).tap();
    await expect(page).toHaveURL('/assistant');
    await expect(page.getByRole('button', { name: '새 대화', exact: true })).toBeVisible();

    await page.goForward();

    await expect(page).toHaveURL('/assistant?conversation=conv-1');
    await expect(page.getByRole('button', { name: '대화 목록으로', exact: true })).toBeVisible();
    expect(api.unhandled).toEqual([]);
  });

  test('A-5: 브라우저 뒤로가기는 어시스턴트를 떠나지 않고 목록을 보여준다', async ({ page }) => {
    const api = await mockAssistant(page);
    await openMobileConversation(page);

    await page.goBack();

    await expect(page.getByRole('button', { name: '새 대화', exact: true })).toBeVisible();
    await expect(page).toHaveURL('/assistant');
    await expect(page.getByRole('button', { name: '대화 목록으로', exact: true })).toBeHidden();
    expect(api.unhandled).toEqual([]);
  });

  test('A-6: 딥링크로 채팅방에 진입해도 뒤로가기는 어시스턴트 목록으로 간다', async ({ page }) => {
    const api = await mockAssistant(page);
    // 진입 이전 페이지가 있어도 채팅방 버튼은 그 페이지로 나가면 안 된다.
    await page.goto('/guidelines');
    await expect(page.getByRole('heading', { name: '지침 탐색', exact: true })).toBeVisible();
    await page.goto('/assistant?conversation=conv-1');

    await expect(page.getByRole('button', { name: '대화 목록으로', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: CONVERSATION.title, exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '질문 입력', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '새 대화', exact: true })).toBeHidden();

    await page.getByRole('button', { name: '대화 목록으로', exact: true }).tap();

    await expect(page.getByRole('button', { name: '새 대화', exact: true })).toBeVisible();
    await expect(page).toHaveURL('/assistant');
    expect(api.unhandled).toEqual([]);
  });

  test('A-7: 새 대화를 만들면 생성된 채팅방과 입력창으로 바로 진입한다', async ({ page }) => {
    const api = await mockAssistant(page);
    await page.goto('/assistant');

    await page.getByRole('button', { name: '새 대화', exact: true }).tap();

    await expect(page.getByRole('button', { name: '대화 목록으로', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '질문 입력', exact: true })).toBeInViewport();
    await expect(page).toHaveURL('/assistant?conversation=conv-new');
    expect(api.unhandled).toEqual([]);
  });

  test('A-8: 아래쪽 대화를 열었다 돌아와도 목록 스크롤 위치를 유지한다', async ({ page }) => {
    const api = await mockAssistant(page, SCROLL_CONVERSATIONS);
    await page.goto('/assistant');
    await expect(page.getByRole('button', { name: '대화 01', exact: true })).toBeInViewport();
    const row = page.getByRole('button', { name: '대화 35', exact: true });
    await expect(row).toBeAttached();
    await expect(row).not.toBeInViewport();
    await row.scrollIntoViewIfNeeded();
    await expect(row).toBeInViewport();
    await row.tap();
    await expect(page.getByRole('button', { name: '대화 목록으로', exact: true })).toBeVisible();

    await page.getByRole('button', { name: '대화 목록으로', exact: true }).tap();

    // 이 뒤에는 클릭·scrollIntoView를 하지 않는다. 자동 스크롤로 결함을 가리지 않는다.
    await expect(page.getByRole('button', { name: '새 대화', exact: true })).toBeVisible();
    await expect(row).toBeInViewport();
    expect(api.unhandled).toEqual([]);
  });
});

test.describe('모바일 근거 시트', () => {
  test('B-1: 인용을 탭하면 근거 시트 안에 해당 활성 카드가 나타난다', async ({ page }) => {
    const api = await mockAssistant(page);
    await openEvidenceSheet(page);

    const sheet = page.getByRole('dialog', { name: '인용 근거', exact: true });
    await expect(sheet.getByText(EVIDENCE.guidelineTitle, { exact: true })).toBeVisible();
    await expect(sheet.locator('li[aria-current="true"]')).toContainText(EVIDENCE.guidelineTitle);
    expect(api.unhandled).toEqual([]);
  });

  test('B-2: 시트 안의 닫기 버튼으로 근거 시트를 닫는다', async ({ page }) => {
    const api = await mockAssistant(page);
    await openEvidenceSheet(page);
    const sheet = page.getByRole('dialog', { name: '인용 근거', exact: true });

    await sheet.getByRole('button', { name: '인용 근거 닫기', exact: true }).tap();

    await expect(sheet).toBeHidden();
    expect(api.unhandled).toEqual([]);
  });

  test('B-3: 닫은 근거 시트를 채팅방 헤더에서 다시 연다', async ({ page }) => {
    const api = await mockAssistant(page);
    await openEvidenceSheet(page);
    const sheet = page.getByRole('dialog', { name: '인용 근거', exact: true });
    await sheet.getByRole('button', { name: '인용 근거 닫기', exact: true }).tap();
    await expect(sheet).toBeHidden();

    await page.getByRole('button', { name: '인용 근거 보기', exact: true }).tap();

    await expect(sheet).toBeVisible();
    expect(api.unhandled).toEqual([]);
  });

  test('B-4: 화면 위쪽 배경을 누르면 근거 시트를 닫는다', async ({ page }) => {
    const api = await mockAssistant(page);
    await openEvidenceSheet(page);

    await page.getByTestId('evidence-sheet-backdrop').tap({ position: { x: 10, y: 10 } });

    await expect(page.getByRole('dialog', { name: '인용 근거', exact: true })).toBeHidden();
    expect(api.unhandled).toEqual([]);
  });

  test('B-5: 근거 시트에서 브라우저 뒤로가기를 하면 목록 위에 시트가 남지 않는다', async ({ page }) => {
    const api = await mockAssistant(page);
    await openEvidenceSheet(page);

    await page.goBack();

    await expect(page.getByRole('button', { name: '새 대화', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog', { name: '인용 근거', exact: true })).toBeHidden();
    expect(api.unhandled).toEqual([]);
  });

  test('B-6: 빈 대화에는 목록으로 돌아가기만 있고 근거 열기는 없다', async ({ page }) => {
    const api = await mockAssistant(page, [EMPTY_CONVERSATION]);
    await page.goto('/assistant');
    await page.getByRole('button', { name: EMPTY_CONVERSATION.title, exact: true }).tap();

    await expect(page.getByRole('button', { name: '대화 목록으로', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '질문 입력', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '인용 근거 보기', exact: true })).toBeHidden();
    expect(api.unhandled).toEqual([]);
  });
});

test('C-11: 모바일 메뉴에서 지침으로 이동하면 드로어가 닫힌다', async ({ page }) => {
  const api = await mockAssistant(page);
  await page.goto('/assistant');
  await page.getByRole('button', { name: '메뉴 열기', exact: true }).tap();
  const drawer = page.getByRole('dialog', { name: '메뉴', exact: true });
  await expect(drawer).toBeVisible();

  await drawer.getByRole('link', { name: '지침', exact: true }).tap();

  await expect(page).toHaveURL('/guidelines');
  await expect(page.getByRole('heading', { name: '지침 탐색', exact: true })).toBeVisible();
  await expect(drawer).toBeHidden();
  expect(api.unhandled).toEqual([]);
});

test.describe('데스크톱', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('A-10: 대화 선택은 대화 id를 URL에 반영한다', async ({ page }) => {
    const api = await mockAssistant(page);
    await page.goto('/assistant');

    await page.getByRole('button', { name: CONVERSATION.title, exact: true }).click();

    await expect(page).toHaveURL('/assistant?conversation=conv-1');
    expect(api.unhandled).toEqual([]);
  });

  // M1: 데스크톱 선택을 pushState로 바꾸면 history.length가 증가한다.
  test('[가드] G-1: 데스크톱 대화 선택은 히스토리를 늘리지 않는다', async ({ page }) => {
    const api = await mockAssistant(page);
    await page.goto('/assistant');
    const row = page.getByRole('button', { name: CONVERSATION.title, exact: true });
    await expect(row).toBeVisible();
    const before = await page.evaluate(() => history.length);

    await row.click();
    await expect(page.getByRole('textbox', { name: '질문 입력', exact: true })).toBeVisible();

    const after = await page.evaluate(() => history.length);
    expect(after).toBe(before);
    expect(api.unhandled).toEqual([]);
  });

  // M2: 데스크톱에 모바일 뒤로가기 버튼을 노출하면 실패한다.
  test('[가드] G-2: 데스크톱 채팅에는 목록으로 돌아가기 버튼이 보이지 않는다', async ({ page }) => {
    const api = await mockAssistant(page);
    await page.goto('/assistant');
    await page.getByRole('button', { name: CONVERSATION.title, exact: true }).click();
    await expect(page.getByRole('textbox', { name: '질문 입력', exact: true })).toBeVisible();

    await expect(page.getByRole('button', { name: '대화 목록으로', exact: true })).toBeHidden();
    expect(api.unhandled).toEqual([]);
  });

  // M3: 데스크톱에서 선택 후 목록을 숨기면 실패한다.
  test('[가드] G-3: 데스크톱은 목록·채팅·근거 패널을 함께 보여준다', async ({ page }) => {
    const api = await mockAssistant(page);
    await page.goto('/assistant');
    await page.getByRole('button', { name: CONVERSATION.title, exact: true }).click();
    await expect(page.getByRole('textbox', { name: '질문 입력', exact: true })).toBeVisible();

    await expect(page.getByRole('button', { name: '새 대화', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '인용 근거', exact: true })).toBeVisible();
    expect(api.unhandled).toEqual([]);
  });

  // M4: 데스크톱 인용 클릭으로 dialog를 띄우면 실패한다.
  test('[가드] G-4: 데스크톱 인용은 시트 대신 오른쪽 패널의 카드를 활성화한다', async ({ page }) => {
    const api = await mockAssistant(page);
    await page.goto('/assistant');
    await page.getByRole('button', { name: CONVERSATION.title, exact: true }).click();

    await page.getByRole('button', { name: '[1]', exact: true }).click();

    await expect(page.locator('li[aria-current="true"]')).toContainText(EVIDENCE.guidelineTitle);
    await expect(page.getByRole('dialog', { name: '인용 근거', exact: true })).toBeHidden();
    expect(api.unhandled).toEqual([]);
  });

  // M5: 데스크톱에 메뉴 열기 버튼을 노출하면 실패한다.
  test('[가드] G-5: 데스크톱은 메뉴 열기 대신 사이드바의 지침 링크를 보여준다', async ({ page }) => {
    const api = await mockAssistant(page);
    await page.goto('/assistant');
    // 근거 패널도 complementary이므로 지침 링크가 있는 사이드바로 한정한다.
    const sidebar = page.getByRole('complementary').filter({
      has: page.getByRole('link', { name: '지침', exact: true }),
    });
    await expect(sidebar.getByRole('link', { name: '지침', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '메뉴 열기', exact: true })).toBeHidden();
    expect(api.unhandled).toEqual([]);
  });
});
