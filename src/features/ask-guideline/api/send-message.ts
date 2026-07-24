/** postStream 래퍼 — ChatPanel이 사용한다. 테스트에서 vi.mock 대상. */
import type { StreamEvent } from '@/shared/api/stream-client';

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

export function sendMessageStream(_args: SendMessageArgs): Promise<void> {
  throw new Error('NOT_IMPLEMENTED');
}
