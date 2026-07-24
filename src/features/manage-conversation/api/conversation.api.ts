'use client';

/** 대화 목록·생성·메시지 훅 (docs/specs/08) */
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/shared/api/api-client';
import { unwrap, unwrapPage } from '@/shared/api/api-error';
import type { components } from '@/shared/api/generated/schema';

export type ConversationSummary = components['schemas']['ConversationSummaryResponseDto'];
export type MessageDto = components['schemas']['MessageResponseDto'];

export interface PageInfo {
  size: number;
  hasNext: boolean;
  nextCursor: string | null;
}

export interface ConversationPage {
  items: ConversationSummary[];
  page: PageInfo;
}

export interface MessagePage {
  items: MessageDto[];
  page: PageInfo;
}

export const CONVERSATIONS_KEY = ['conversations'] as const;
export const messagesKey = (conversationId: string | null) =>
  ['messages', conversationId] as const;

export function useConversations(cursor?: string): UseQueryResult<ConversationPage> {
  return useQuery({
    queryKey: [...CONVERSATIONS_KEY, { cursor: cursor ?? null }],
    queryFn: async () => {
      const result = await api.GET('/api/v1/conversations', {
        params: { query: cursor ? { cursor } : {} },
      });
      const { items, page } = unwrapPage<ConversationSummary>(result);
      return { items, page };
    },
  });
}

/** 히스토리 목록 — 제목 부분일치 검색 지원 (docs/specs/11 기준 6·9) */
export function useConversationHistory(params: {
  query?: string;
}): UseQueryResult<ConversationPage> {
  return useQuery({
    queryKey: [...CONVERSATIONS_KEY, 'history', { query: params.query ?? null }],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (params.query) query.query = params.query;
      const result = await api.GET('/api/v1/conversations', { params: { query } });
      const { items, page } = unwrapPage<ConversationSummary>(result);
      return { items, page };
    },
  });
}

/** 대화명 변경 (docs/specs/11 기준 7) */
export function useRenameConversation(
  conversationId: string | null,
): UseMutationResult<ConversationSummary, Error, { title: string }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ title }) => {
      if (!conversationId) throw new Error('대화가 선택되지 않았습니다.');
      return unwrap<ConversationSummary>(
        await api.PATCH('/api/v1/conversations/{conversationId}', {
          params: { path: { conversationId } },
          body: { title },
        }),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

/** 대화 보관 (docs/specs/11 기준 8 — 멱등) */
export function useArchiveConversation(
  conversationId: string | null,
): UseMutationResult<null, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!conversationId) throw new Error('대화가 선택되지 않았습니다.');
      return unwrap<null>(
        await api.POST('/api/v1/conversations/{conversationId}/archive', {
          params: { path: { conversationId } },
        }),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

export function useCreateConversation(): UseMutationResult<ConversationSummary, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap<ConversationSummary>(
        await api.POST('/api/v1/conversations', { body: { type: 'GUIDELINE_QA' } }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

/** conversationId가 null이면 비활성 */
export function useMessages(conversationId: string | null): UseQueryResult<MessagePage> {
  return useQuery({
    queryKey: messagesKey(conversationId),
    enabled: conversationId !== null,
    queryFn: async () => {
      const result = await api.GET('/api/v1/conversations/{conversationId}/messages', {
        params: { path: { conversationId: conversationId as string } },
      });
      const { items, page } = unwrapPage<MessageDto>(result);
      return { items, page };
    },
  });
}
