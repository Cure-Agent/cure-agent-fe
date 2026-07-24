/** postStream 래퍼 — ChatPanel이 사용한다. 테스트에서 vi.mock 대상. */
import { postStream, type StreamEvent } from '@/shared/api/stream-client';

export interface SendMessageArgs {
  conversationId: string;
  content: string;
  /** 재시도 시 새 값을 생성한다 (crypto.randomUUID) */
  clientRequestId: string;
  filters?: {
    guidelineIds?: string[];
    recommendationGrades?: string[];
    evidenceLevels?: string[];
  };
  onEvent: (event: StreamEvent) => void;
  signal?: AbortSignal;
}

export async function sendMessageStream(args: SendMessageArgs): Promise<void> {
  const { conversationId, content, clientRequestId, filters, onEvent, signal } = args;
  await postStream(
    `/api/v1/conversations/${conversationId}/messages/stream`,
    { content, clientRequestId, ...(filters ? { filters } : {}) },
    { onEvent, signal },
  );
}
