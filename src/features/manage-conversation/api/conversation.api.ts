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
