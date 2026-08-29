/** postStream 래퍼 — ChatPanel이 사용한다. 테스트에서 vi.mock 대상. */
import type { ResponseLang } from '../lib/response-lang';
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
  /** 답변 언어 — 입력 문장에서 유도한다 (BE docs/specs/42) */
  responseLang?: ResponseLang;
  onEvent: (event: StreamEvent) => void;
  signal?: AbortSignal;
}

export async function sendMessageStream(args: SendMessageArgs): Promise<void> {
  const { conversationId, content, clientRequestId, filters, responseLang, onEvent, signal } = args;
  await postStream(
    `/api/v1/conversations/${conversationId}/messages/stream`,
    {
      content,
      clientRequestId,
      ...(filters ? { filters } : {}),
      // 없으면 키를 싣지 않는다 — 계약의 기본값이 'ko'라, 안 보내는 것이 오늘 요청과 같다
      ...(responseLang ? { responseLang } : {}),
    },
    { onEvent, signal },
  );
}
