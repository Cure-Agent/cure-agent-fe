// @vitest-environment happy-dom
/**
 * 화면의 실제 요소가 둘러보기를 밀고 나가는지 — 이 배선이 끊기면 안내는 첫 단계에 굳는다.
 *
 * 진행 카드(`OnboardingTour`)를 실제 화면 컴포넌트와 **함께** 띄워 확인한다. 상태만 단언하면
 * `completeTourStep` 호출이 빠진 자리를 잡지 못하고, 카드만 단언하면 앵커 이름이 어긋난 것을
 * 잡지 못한다.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '@/features/ask-guideline/api/send-message';
import { ConversationList } from '@/features/manage-conversation/ui/conversation-list';
import { PatientListPanel } from '@/features/manage-patient/ui/patient-list-panel';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { TOUR_HIGHLIGHT_CLASS, TOUR_STORAGE_KEY, startTourPath } from '../model/tour-state';
import { OnboardingTour } from './onboarding-tour';

const sendMessageStreamMock = vi.hoisted(() => vi.fn<(args: SendMessageArgs) => Promise<void>>());
vi.mock('@/features/ask-guideline/api/send-message', () => ({
  sendMessageStream: sendMessageStreamMock,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/assistant',
}));

import { ChatPanel } from '@/features/ask-guideline/ui/chat-panel';

useMswServer();

const PAGE = { size: 50, hasNext: false, nextCursor: null };

beforeEach(() => {
  localStorage.clear();
  sendMessageStreamMock.mockReset();
  sendMessageStreamMock.mockResolvedValue(undefined);
});

describe('「새 대화」가 첫 단계를 넘긴다', () => {
  it('만들고 나면 안내가 예시 질의문 단계로 옮겨간다', async () => {
    server.use(
      http.get('/api/v1/conversations', () => HttpResponse.json(envelope([], PAGE))),
      http.post('/api/v1/conversations', () =>
        HttpResponse.json(
          envelope({
            id: 'conversation-1',
            type: 'GUIDELINE_QA',
            title: '새 대화',
            status: 'ACTIVE',
            lastMessageAt: '2026-08-31T00:00:00.000Z',
          }),
        ),
      ),
    );

    const user = userEvent.setup();
    startTourPath('general');
    renderWithProviders(
      <>
        <ConversationList selectedId={null} onSelect={vi.fn()} onDeleted={vi.fn()} />
        <OnboardingTour />
      </>,
    );

    const newConversation = await screen.findByRole('button', { name: '새 대화' });
    // 지금 단계라 강조가 붙어 있다
    expect(newConversation.className).toContain(TOUR_HIGHLIGHT_CLASS);

    await user.click(newConversation);

    expect(await screen.findByText('예시 질의문 고르기')).toBeTruthy();
    // 넘어간 단계의 강조는 거둔다 — 링이 남으면 이미 끝난 일을 계속 가리킨다
    await waitFor(() => expect(newConversation.className).not.toContain(TOUR_HIGHLIGHT_CLASS));
  });
});

describe('예시 질의문과 전송이 다음 단계를 넘긴다', () => {
  function mockEmptyConversation(): void {
    server.use(
      http.get('/api/v1/conversations/conversation-1/messages', () =>
        HttpResponse.json(envelope([], PAGE)),
      ),
      http.get('/api/v1/conversations/conversation-1', () =>
        HttpResponse.json(
          envelope({
            id: 'conversation-1',
            type: 'GUIDELINE_QA',
            title: '새 대화',
            status: 'ACTIVE',
            lastMessageAt: '2026-08-31T00:00:00.000Z',
            createdAt: '2026-08-31T00:00:00.000Z',
          }),
        ),
      ),
    );
  }

  it('예시를 고르면 전송 단계로, 보내면 답변 단계로 넘어간다', async () => {
    mockEmptyConversation();
    localStorage.setItem(TOUR_STORAGE_KEY, 'general:1'); // 예시 질의문 고르기부터

    const user = userEvent.setup();
    renderWithProviders(
      <>
        <ChatPanel conversationId="conversation-1" />
        <OnboardingTour />
      </>,
    );

    const prompts = await screen.findByRole('list', { name: '예시 질의문' });
    expect(prompts.className).toContain(TOUR_HIGHLIGHT_CLASS);

    await user.click(screen.getAllByRole('listitem')[0].querySelector('button')!);
    expect(await screen.findByText('질문 보내기')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '전송' }));
    expect(await screen.findByText('답변과 근거 확인')).toBeTruthy();
  });

  /**
   * 마지막 단계만은 사용자가 끝낼 수 없다 — 답변은 기다리는 것이라 종결이 곧 완료다.
   * 이것이 걸리지 않으면 답을 다 읽은 화면에 「아직 1단계 남음」이 남는다.
   */
  it('답변이 종결되면 스스로 완료로 넘어간다', async () => {
    mockEmptyConversation();
    localStorage.setItem(TOUR_STORAGE_KEY, 'general:3'); // 답변 확인 단계
    sendMessageStreamMock.mockImplementation(async (args) => {
      args.onEvent({
        eventType: 'message.accepted',
        requestId: 'request-1',
        userMessageId: 'user-message-1',
        assistantMessageId: 'assistant-message-1',
      });
      args.onEvent({
        eventType: 'answer.completed',
        message: {
          id: 'assistant-message-1',
          role: 'ASSISTANT',
          content: '침 치료를 고려합니다.',
          status: 'COMPLETED',
          citations: [],
          createdAt: '2026-08-31T00:00:00.000Z',
        },
      });
    });

    const user = userEvent.setup();
    renderWithProviders(
      <>
        <ChatPanel conversationId="conversation-1" />
        <OnboardingTour />
      </>,
    );

    await user.type(await screen.findByLabelText('질문 입력'), '요통 치료 방법을 알려주세요.');
    await user.click(screen.getByRole('button', { name: '전송' }));

    expect(await screen.findByText('둘러보기를 마쳤습니다')).toBeTruthy();
  });
});

describe('환자 목록이 환자 맞춤 경로의 단계를 넘긴다', () => {
  it('환자를 고르면 맞춤 대화 시작 단계로 넘어간다', async () => {
    server.use(
      http.get('/api/v1/patients', () =>
        HttpResponse.json(
          envelope(
            [
              {
                id: 'patient-1',
                caseLabel: 'CASE-001',
                status: 'ACTIVE',
                updatedAt: '2026-08-31T00:00:00.000Z',
              },
            ],
            PAGE,
          ),
        ),
      ),
    );

    const user = userEvent.setup();
    localStorage.setItem(TOUR_STORAGE_KEY, 'patient:1'); // 환자 고르기부터
    renderWithProviders(
      <>
        <PatientListPanel onSelect={vi.fn()} />
        <OnboardingTour />
      </>,
    );

    await user.click(await screen.findByRole('button', { name: 'CASE-001' }));

    expect(await screen.findByText('환자 맞춤 대화 시작')).toBeTruthy();
  });
});
