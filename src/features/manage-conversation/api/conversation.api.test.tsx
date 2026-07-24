// @vitest-environment happy-dom
// docs/specs/08 수용 기준 4 동결 테스트 — 구현 중 수정 금지
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { type ConversationSummary, useConversations } from './conversation.api';

useMswServer();

function createWrapper(): ({ children }: PropsWithChildren) => React.ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: PropsWithChildren): React.ReactElement {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useConversations', () => {
  it('기준 4: MSW 봉투 응답의 items와 page 정보를 노출한다', async () => {
    const conversations: ConversationSummary[] = [
      {
        id: 'conversation-1',
        type: 'GUIDELINE_QA',
        title: '요통 진료 상담',
        status: 'ACTIVE',
        updatedAt: '2026-07-24T00:00:00.000Z',
      },
      {
        id: 'conversation-2',
        type: 'GUIDELINE_QA',
        title: '불면 진료 상담',
        status: 'ACTIVE',
        updatedAt: '2026-07-24T01:00:00.000Z',
      },
    ];
    const page = {
      size: 2,
      hasNext: true,
      nextCursor: 'conversation-cursor-2',
    };

    server.use(
      http.get('/api/v1/conversations', () =>
        HttpResponse.json(envelope(conversations, page)),
      ),
    );

    const { result } = renderHook(() => useConversations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      items: conversations,
      page,
    });
    expect(result.current.data?.page.hasNext).toBe(true);
    expect(result.current.data?.page.nextCursor).toBe('conversation-cursor-2');
  });
});
