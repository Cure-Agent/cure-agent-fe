// @vitest-environment happy-dom
// 새로고침 후 임상 참고안 카드 복원 — 저장된 메시지의 guidanceId로 카드를 다시 그린다
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '../api/send-message';
import type { GuidanceDto, MessageDto } from '../model/stream-state.model';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';

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

const guidance: GuidanceDto = {
  id: 'guid-1',
  patientId: 'p-1',
  patientProfileSnapshotId: 'snap-1',
  summary: '침 치료 병행을 고려할 수 있습니다.',
  considerations: [],
  safetyAlerts: [],
  missingInformation: [],
  reviewStatus: 'ACCEPTED',
  generatedAt: '2026-07-24T10:00:00.000Z',
};

const guidanceMessage: MessageDto = {
  id: 'assistant-message-1',
  role: 'ASSISTANT',
  content: '환자 상태를 고려한 답변입니다.',
  status: 'COMPLETED',
  answerKind: 'CLINICAL_GUIDANCE',
  guidanceId: 'guid-1',
  citations: [],
  createdAt: '2026-07-24T10:00:00.000Z',
};

describe('ChatPanel 임상 참고안 복원', () => {
  it('저장된 CLINICAL_GUIDANCE 메시지의 guidanceId로 카드를 복원한다', async () => {
    server.use(
      http.get('/api/v1/conversations/conversation-1/messages', () =>
        HttpResponse.json(envelope([guidanceMessage], PAGE)),
      ),
      http.get('/api/v1/clinical-guidance/guid-1', () =>
        HttpResponse.json(envelope(guidance)),
      ),
    );

    renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    expect(await screen.findByText('임상 참고안')).toBeTruthy();
    expect(screen.getByText('침 치료 병행을 고려할 수 있습니다.')).toBeTruthy();
    // 서버의 현재 검토 상태를 그대로 보여준다 (스트림 시점의 DRAFT가 아니라)
    expect(screen.getByText('승인됨')).toBeTruthy();
  });

  it('스트림 직후에는 카드가 중복 표시되지 않는다', async () => {
    let persisted: MessageDto[] = [];
    server.use(
      http.get('/api/v1/conversations/conversation-2/messages', () =>
        HttpResponse.json(envelope(persisted, PAGE)),
      ),
      http.get('/api/v1/clinical-guidance/guid-1', () =>
        HttpResponse.json(envelope(guidance)),
      ),
    );

    sendMessageStreamMock.mockImplementation(async (args) => {
      args.onEvent({
        eventType: 'message.accepted',
        requestId: 'request-1',
        userMessageId: 'user-message-1',
        assistantMessageId: 'assistant-message-1',
      });
      // 서버 저장 완료 시점 — 이후 refetch는 guidanceId가 실린 메시지를 돌려준다
      persisted = [guidanceMessage];
      args.onEvent({
        eventType: 'answer.completed',
        message: guidanceMessage,
        guidance: { ...guidance, reviewStatus: 'DRAFT' },
      });
    });

    const user = userEvent.setup();
    renderWithProviders(<ChatPanel conversationId="conversation-2" />);

    await user.type(screen.getByLabelText('질문 입력'), '이 환자에게 침 치료가 가능한가요?');
    await user.click(screen.getByRole('button', { name: '전송' }));

    // 저장된 메시지가 refetch로 반영된 뒤에도 카드는 스트림 카드 하나만 남는다
    await screen.findByText('환자 상태를 고려한 답변입니다.');
    await waitFor(() => {
      expect(screen.getAllByText('임상 참고안')).toHaveLength(1);
    });
  });
});
