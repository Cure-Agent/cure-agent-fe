// @vitest-environment happy-dom
// 연결이 사라진 뒤(새로고침·다른 탭·다른 기기) 다시 연 화면 — 이어받을 스트림이 없으므로
// 서버 목록의 미완성 답변 행만이 「답변이 오는 중」임을 알려주는 유일한 신호다.
// BE에 스트림 재접속 경로가 없어, 끝을 아는 방법도 재조회뿐이다.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageArgs } from '../api/send-message';
import type { MessageDto } from '../model/stream-state.model';
import { resetAllStreams } from '../model/stream-store';
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
  resetAllStreams();
});

const PAGE = { size: 50, hasNext: false, nextCursor: null };
const QUESTION = '만성 요통에 침 치료가 효과적인가요?';
const IN_PROGRESS = '답변을 생성하는 중…';
const NOT_ARRIVED = '답변이 아직 도착하지 않았습니다.';
const ANSWER = '침 치료를 고려합니다.';

const userMessage: MessageDto = {
  id: 'user-message-1',
  role: 'USER',
  content: QUESTION,
  status: 'COMPLETED',
  citations: [],
  createdAt: new Date().toISOString(),
};

/** 서버가 아직 쓰고 있는 답변 행 — 본문은 종결 때 채워지므로 비어 있다 */
function streamingAnswer(ageMs = 0): MessageDto {
  return {
    id: 'assistant-message-1',
    role: 'ASSISTANT',
    content: '',
    status: 'STREAMING',
    citations: [],
    createdAt: new Date(Date.now() - ageMs).toISOString(),
  };
}

const completedAnswer: MessageDto = {
  id: 'assistant-message-1',
  role: 'ASSISTANT',
  content: ANSWER,
  status: 'COMPLETED',
  citations: [],
  createdAt: new Date().toISOString(),
};

describe('ChatPanel 미완성 답변 이어받기', () => {
  it('이어받을 스트림이 없어도 진행 중인 답변 자리를 비워 두지 않는다', async () => {
    server.use(
      http.get('/api/v1/conversations/conversation-1/messages', () =>
        HttpResponse.json(envelope([streamingAnswer(), userMessage], PAGE)),
      ),
    );

    renderWithProviders(<ChatPanel conversationId="conversation-1" />);

    expect(await screen.findByText(IN_PROGRESS)).toBeTruthy();
    // 미완성 행 자체는 여전히 그리지 않는다 — 빈 말풍선이 아니라 안내다
    expect(screen.getByText(QUESTION)).toBeTruthy();
  });

  it('답변이 끝나면 재조회가 따라잡아 안내가 답변으로 바뀐다', async () => {
    let persisted: MessageDto[] = [streamingAnswer(), userMessage];
    server.use(
      http.get('/api/v1/conversations/conversation-2/messages', () =>
        HttpResponse.json(envelope(persisted, PAGE)),
      ),
    );

    renderWithProviders(<ChatPanel conversationId="conversation-2" />);
    await screen.findByText(IN_PROGRESS);

    // 서버가 답변을 마감한다 — 사용자는 아무것도 하지 않는다
    persisted = [completedAnswer, userMessage];

    expect(await screen.findByText(ANSWER, {}, { timeout: 10_000 })).toBeTruthy();
    expect(screen.queryByText(IN_PROGRESS)).toBeNull();
  }, 15_000);

  it('상한을 넘긴 미완성 행은 기다리지 않고 다시 확인을 권한다', async () => {
    let calls = 0;
    server.use(
      http.get('/api/v1/conversations/conversation-3/messages', () => {
        calls += 1;
        // 3분 전에 시작된 답변 — 서버가 끝내지 못한 것으로 본다
        return HttpResponse.json(envelope([streamingAnswer(3 * 60_000), userMessage], PAGE));
      }),
    );

    renderWithProviders(<ChatPanel conversationId="conversation-3" />);

    expect(await screen.findByText(NOT_ARRIVED)).toBeTruthy();
    // 「생성 중」이라 말하지 않는다 — 오지 않는 답변을 기다리는 것처럼 보이면 안 된다
    expect(screen.queryByText(IN_PROGRESS)).toBeNull();

    const before = calls;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '다시 확인' }));

    // 「다시 확인」은 목록 재조회다 — 질문을 다시 보내지 않는다(중복 답변 방지)
    await waitFor(() => expect(calls).toBeGreaterThan(before));
    expect(sendMessageStreamMock).not.toHaveBeenCalled();
  });
});
