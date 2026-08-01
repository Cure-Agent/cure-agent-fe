'use client';

/** 대화 목록·생성·메시지 훅 (docs/specs/08) */
import {
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  useInfiniteQuery,
  useMutation,
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

/** 최신순 + 커서 — 하단 무한 스크롤용 페이지 누적 */
export function useConversations(): UseInfiniteQueryResult<InfiniteData<ConversationPage>> {
  return useInfiniteQuery({
    queryKey: [...CONVERSATIONS_KEY, 'list'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const result = await api.GET('/api/v1/conversations', {
        params: { query: pageParam ? { cursor: pageParam } : {} },
      });
      const { items, page } = unwrapPage<ConversationSummary>(result);
      return { items, page };
    },
    getNextPageParam: (lastPage) => (lastPage.page.hasNext ? lastPage.page.nextCursor : undefined),
  });
}

/** 히스토리 목록 — 제목 부분일치 검색 지원 (docs/specs/11 기준 6·9) */
export function useConversationHistory(params: {
  query?: string;
}): UseInfiniteQueryResult<InfiniteData<ConversationPage>> {
  return useInfiniteQuery({
    queryKey: [...CONVERSATIONS_KEY, 'history', { query: params.query ?? null }],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const query: Record<string, string> = {};
      if (params.query) query.query = params.query;
      if (pageParam) query.cursor = pageParam;
      const result = await api.GET('/api/v1/conversations', { params: { query } });
      const { items, page } = unwrapPage<ConversationSummary>(result);
      return { items, page };
    },
    getNextPageParam: (lastPage) => (lastPage.page.hasNext ? lastPage.page.nextCursor : undefined),
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

/**
 * conversationId가 null이면 비활성.
 * order=desc — 첫 페이지가 최신, fetchNextPage가 과거로 간다 (채팅 위로 무한 스크롤).
 * 페이지 안 정렬도 최신→과거이므로 시간순 렌더는 flatMessagesChronological로 뒤집는다.
 */
export function useMessages(
  conversationId: string | null,
): UseInfiniteQueryResult<InfiniteData<MessagePage>> {
  return useInfiniteQuery({
    queryKey: messagesKey(conversationId),
    enabled: conversationId !== null,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const query: { order: 'desc'; cursor?: string } = { order: 'desc' };
      if (pageParam) query.cursor = pageParam;
      const result = await api.GET('/api/v1/conversations/{conversationId}/messages', {
        params: { path: { conversationId: conversationId as string }, query },
      });
      const { items, page } = unwrapPage<MessageDto>(result);
      return { items, page };
    },
    getNextPageParam: (lastPage) => (lastPage.page.hasNext ? lastPage.page.nextCursor : undefined),
  });
}

/** desc 페이지 누적(최신→과거)을 화면용 시간순(과거→최신)으로 편다 */
export function flatMessagesChronological(data: InfiniteData<MessagePage> | undefined): MessageDto[] {
  if (!data) return [];
  return data.pages.flatMap((page) => page.items).reverse();
}
