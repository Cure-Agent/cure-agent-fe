// @vitest-environment happy-dom
// 빈 대화의 예시 질의문 — 입력창 위에 뜨고, 누르면 전송하지 않고 입력창을 채운다
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '../api/send-message';
import type { MessageDto } from '../model/stream-state.model';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { GENERAL_SUGGESTED_PROMPTS } from '../lib/suggested-prompts';

const sendMessageStreamMock = vi.hoisted(() =>
  vi.fn<(args: SendMessageArgs) => Promise<void>>(),
);

vi.mock('../api/send-message', () => ({
  sendMessageStream: sendMessageStreamMock,
}));

import { ChatPanel } from './chat-panel';

useMswServer();

beforeEach(() => {
  sendMessageStreamMock.mockReset();
});

const PAGE = { size: 50, hasNext: false, nextCursor: null };

const CASE_001_PROMPT =
  '골다공증 환자에게 골밀도나 통증 개선을 목적으로 침 치료를 고려할 때, 유침 시간은 보통 어느 정도로 잡는 것이 적절한가요?';

function mockMessages(items: MessageDto[]): void {
  server.use(
    http.get('/api/v1/conversations/conversation-1/messages', () =>
      HttpResponse.json(envelope(items, PAGE)),
    ),
  );
}

function mockConversation(
  extra: { type: 'GUIDELINE_QA' | 'PATIENT_GUIDANCE'; patientId?: string },
): void {
  server.use(
    http.get('/api/v1/conversations/conversation-1', () =>
      HttpResponse.json(
        envelope({
          id: 'conversation-1',
          title: '새 대화',
          status: 'ACTIVE',
          lastMessageAt: '2026-08-28T10:00:00.000Z',
          createdAt: '2026-08-28T10:00:00.000Z',
          ...extra,
        }),
      ),
    ),
  );
}

function mockPatient(diagnoses: string[]): void {
  server.use(
    http.get('/api/v1/patients/patient-1', () =>
      HttpResponse.json(
        envelope({
          id: 'patient-1',
          caseLabel: 'CASE-001',
          status: 'ACTIVE',
          version: 1,
          diagnoses,
          medications: ['알렌드로네이트'],
          allergies: ['아토피'],
        }),
      ),
    ),
  );
}

describe('ChatPanel 예시 질의문', () => {
  it('빈 일반 대화에는 일반 질의문 3개가 입력창 위에 뜬다', async () => {
    mockMessages([]);
    mockConversation({ type: 'GUIDELINE_QA' });

    renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    const list = await screen.findByRole('list', { name: '예시 질의문' });
    const items = within(list).getAllByRole('button');
    expect(items.map((item) => item.textContent)).toEqual([...GENERAL_SUGGESTED_PROMPTS]);
  });

  it('환자 맞춤 대화에는 그 환자의 진단에 맞는 질의문이 뜬다', async () => {
    mockMessages([]);
    mockConversation({ type: 'PATIENT_GUIDANCE', patientId: 'patient-1' });
    mockPatient(['골다공증']);

    renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    expect(await screen.findByRole('button', { name: CASE_001_PROMPT })).toBeTruthy();
    // 환자 질의문이 떴다면 일반 질의문은 함께 뜨지 않는다
    expect(screen.queryByRole('button', { name: GENERAL_SUGGESTED_PROMPTS[0] })).toBeNull();
  });

  it('누르면 전송하지 않고 입력창을 채운다 — 고쳐 던질 수 있어야 한다', async () => {
    mockMessages([]);
    mockConversation({ type: 'PATIENT_GUIDANCE', patientId: 'patient-1' });
    mockPatient(['골다공증']);

    const user = userEvent.setup();
    renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    await user.click(await screen.findByRole('button', { name: CASE_001_PROMPT }));

    expect(screen.getByLabelText('질문 입력')).toHaveValue(CASE_001_PROMPT);
    expect(sendMessageStreamMock).not.toHaveBeenCalled();
  });

  it('이미 대화가 오간 방에는 뜨지 않는다 — 입력창 위 자리는 답변의 것이다', async () => {
    mockMessages([
      {
        id: 'assistant-message-1',
        role: 'ASSISTANT',
        content: '침 치료를 고려합니다.',
        status: 'COMPLETED',
        citations: [],
        createdAt: '2026-08-28T10:00:00.000Z',
      },
    ]);
    mockConversation({ type: 'GUIDELINE_QA' });

    renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    expect(await screen.findByText('침 치료를 고려합니다.')).toBeTruthy();
    expect(screen.queryByRole('list', { name: '예시 질의문' })).toBeNull();
  });

  it('질문을 보내면 그 즉시 사라진다', async () => {
    mockMessages([]);
    mockConversation({ type: 'GUIDELINE_QA' });
    sendMessageStreamMock.mockImplementation(async () => {});

    const user = userEvent.setup();
    renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    await user.click(await screen.findByRole('button', { name: GENERAL_SUGGESTED_PROMPTS[0] }));
    await user.click(screen.getByRole('button', { name: '전송' }));

    await waitFor(() =>
      expect(screen.queryByRole('list', { name: '예시 질의문' })).toBeNull(),
    );
  });
});
