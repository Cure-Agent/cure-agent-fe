'use client';

/** 대화 목록·생성·메시지 훅 (docs/specs/08) */
import {
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type UseQueryResult,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/shared/api/api-client';
import { unwrap, unwrapPage } from '@/shared/api/api-error';
import type { components } from '@/shared/api/generated/schema';

export type ConversationSummary = components['schemas']['ConversationSummaryResponseDto'];
export type ConversationDetail = components['schemas']['ConversationDetailResponseDto'];
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
export const conversationKey = (conversationId: string | null) =>
  [...CONVERSATIONS_KEY, 'detail', conversationId] as const;
export const messagesKey = (conversationId: string | null) =>
  ['messages', conversationId] as const;

/**
 * 대화 단건 — 목록을 거치지 않고 `?conversation={id}`로 바로 들어온 화면이 대화의 성격
 * (type·연결된 환자)을 알 수 있는 유일한 경로다. conversationId가 null이면 비활성.
 */
export function useConversation(
  conversationId: string | null,
): UseQueryResult<ConversationDetail> {
  return useQuery({
    queryKey: conversationKey(conversationId),
    enabled: conversationId !== null,
    queryFn: async () =>
      unwrap<ConversationDetail>(
        await api.GET('/api/v1/conversations/{conversationId}', {
          params: { path: { conversationId: conversationId as string } },
        }),
      ),
  });
}

/**
 * 최신순 + 커서(하단 무한 스크롤) + 제목 부분일치 검색 (docs/specs/11 기준 6).
 * status 미지정은 전체 조회다 — 보관된 대화를 감추려면 호출부가 명시적으로 ACTIVE를 넘겨야 한다.
 */
export function useConversations(params?: {
  query?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
}): UseInfiniteQueryResult<InfiniteData<ConversationPage>> {
  const search = params?.query;
  const status = params?.status;
  return useInfiniteQuery({
    queryKey: [...CONVERSATIONS_KEY, 'list', { query: search ?? null, status: status ?? null }],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const query: Record<string, string> = {};
      if (search) query.query = search;
      if (status) query.status = status;
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

/** 보관·보관 해제 공통 (docs/specs/11 기준 8 — 양쪽 다 멱등) */
function useStatusMutation(
  conversationId: string | null,
  path:
    | '/api/v1/conversations/{conversationId}/archive'
    | '/api/v1/conversations/{conversationId}/unarchive',
): UseMutationResult<null, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!conversationId) throw new Error('대화가 선택되지 않았습니다.');
      return unwrap<null>(await api.POST(path, { params: { path: { conversationId } } }));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

/** 대화 보관 */
export function useArchiveConversation(
  conversationId: string | null,
): UseMutationResult<null, Error, void> {
  return useStatusMutation(conversationId, '/api/v1/conversations/{conversationId}/archive');
}

/** 대화 보관 해제 */
export function useUnarchiveConversation(
  conversationId: string | null,
): UseMutationResult<null, Error, void> {
  return useStatusMutation(conversationId, '/api/v1/conversations/{conversationId}/unarchive');
}

/**
 * 대화 삭제 (BE spec 34). 멱등이고 서버에 restore가 없다 —
 * `deletedAt`은 복구 유예가 아니라 파기 예약이므로 보관처럼 되돌리기 배너를 붙이지 않는다.
 * 보관과 직교해서 ARCHIVED 대화도 그대로 지워진다.
 */
export function useDeleteConversation(
  conversationId: string | null,
): UseMutationResult<null, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!conversationId) throw new Error('대화가 선택되지 않았습니다.');
      return unwrap<null>(
        await api.DELETE('/api/v1/conversations/{conversationId}', {
          params: { path: { conversationId } },
        }),
      );
    },
    onSuccess: () => {
      // 지워진 대화의 메시지는 재조회해도 404다 — 무효화가 아니라 캐시에서 버린다
      if (conversationId) queryClient.removeQueries({ queryKey: messagesKey(conversationId) });
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
  options?: {
    /**
     * 이 화면이 스트림을 붙들고 있지 **않을** 때만 true. SSE가 살아 있으면 폴링은 군더더기다 —
     * 같은 답변을 두 경로로 기다리게 된다.
     */
    pollUnfinishedAnswer?: boolean;
  },
): UseInfiniteQueryResult<InfiniteData<MessagePage>> {
  const pollUnfinishedAnswer = options?.pollUnfinishedAnswer ?? false;
  return useInfiniteQuery({
    queryKey: messagesKey(conversationId),
    enabled: conversationId !== null,
    /**
     * 이 목록만은 전역 기본값(30초 fresh)을 따르지 않는다. 대화의 메시지는 **화면을 떠나 있는
     * 동안 서버에서 자라는** 유일한 목록이기 때문이다 — 답변 스트림은 화면이 없어도 끝까지
     * 돌아 행을 커밋한다. 기본값을 그대로 두면 30초 안에 돌아온 사람은 떠날 때의 목록을 다시
     * 보게 되고, 그 사이 도착한 답변은 다음 재조회까지 화면에 닿지 못한다.
     * 대화를 열 때마다 한 번 더 읽는 값이라 비용은 첫 진입과 같다.
     */
    staleTime: 0,
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
    /**
     * 연결이 사라진 화면(새로고침·다른 탭)이 답변의 끝을 알 방법은 재조회뿐이다 — BE에
     * 스트림 재접속 경로가 없다. 스스로 멈추는 폴링이다: 답변 행이 종결되면 조건이 거짓이 되고,
     * 상한을 넘긴 행도 마찬가지다. 탭이 뒤로 가면 `refetchIntervalInBackground` 기본값(false)이,
     * 화면을 떠나면 observer 해제가 멈춘다.
     *
     * (`queryFn` 뒤에 두는 이유는 타입 추론이다 — 앞에 두면 응답 타입이 확정되기 전에 콜백이
     * 문맥 타입을 잡아 `unknown`으로 굳는다.)
     */
    refetchInterval: (query) => {
      if (!pollUnfinishedAnswer) return false;
      const unfinished = findUnfinishedAnswer(flatMessagesChronological(query.state.data));
      return unfinished && !unfinished.abandoned ? UNFINISHED_ANSWER_POLL_MS : false;
    },
  });
}

/** 미완성 답변을 기다리는 재조회 주기 */
export const UNFINISHED_ANSWER_POLL_MS = 3_000;
/**
 * 이보다 오래 `STREAMING`인 행은 서버가 끝내지 못한 것으로 본다. 답변은 길어야 1분 안에
 * 끝나므로, 그보다 오래 남아 있으면 기다림이 아니라 방치다 — 안내가 영원히 남고 폴링도
 * 멈추지 않는다. 화면을 언제 열었든 판정이 같도록 **횟수가 아니라 행의 나이**로 끊는다.
 */
export const ABANDONED_ANSWER_AFTER_MS = 2 * 60_000;

export interface UnfinishedAnswer {
  message: MessageDto;
  /** 상한을 넘겨 더 기다리지 않는 상태 — 실패로 단정하지는 않는다 */
  abandoned: boolean;
}

/**
 * 서버가 아직 쓰고 있는 답변 행. 스트림을 놓친 화면(새로고침·다른 탭·다른 기기)이
 * 「답변이 오는 중」임을 알 수 있는 유일한 신호다.
 */
export function findUnfinishedAnswer(
  items: MessageDto[],
  now: number = Date.now(),
): UnfinishedAnswer | null {
  const message = items.find((item) => item.status === 'STREAMING');
  if (!message) return null;
  const age = now - new Date(message.createdAt).getTime();
  // 시각을 읽을 수 없으면 방치로 본다 — 끝없이 기다리는 쪽이 더 나쁘다
  return { message, abandoned: !Number.isFinite(age) || age >= ABANDONED_ANSWER_AFTER_MS };
}

/** desc 페이지 누적(최신→과거)을 화면용 시간순(과거→최신)으로 편다 */
export function flatMessagesChronological(data: InfiniteData<MessagePage> | undefined): MessageDto[] {
  if (!data) return [];
  return data.pages.flatMap((page) => page.items).reverse();
}
