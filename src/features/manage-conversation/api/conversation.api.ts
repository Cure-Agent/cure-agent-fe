'use client';

/** 대화 목록·생성·메시지 훅 (docs/specs/08) */
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
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

export function useConversations(_cursor?: string): UseQueryResult<ConversationPage> {
  throw new Error('NOT_IMPLEMENTED');
}

export function useCreateConversation(): UseMutationResult<ConversationSummary, Error, void> {
  throw new Error('NOT_IMPLEMENTED');
}

/** conversationId가 null이면 비활성 */
export function useMessages(_conversationId: string | null): UseQueryResult<MessagePage> {
  throw new Error('NOT_IMPLEMENTED');
}
