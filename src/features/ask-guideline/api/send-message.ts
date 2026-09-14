/** postStream 래퍼 — ChatPanel이 사용한다. 테스트에서 vi.mock 대상. */
import type { ResponseLang } from '../lib/response-lang';
import type { components, paths } from '@/shared/api/generated/schema';
import { postStream, type StreamEvent } from '@/shared/api/stream-client';

/** 대화의 성격 — 전송 경로를 가르는 축이다 (BE docs/specs/52). 계약의 enum을 그대로 쓴다 */
export type ConversationType = components['schemas']['ConversationDetailResponseDto']['type'];

/**
 * 에이전트 경로의 요청 본문 — BE OpenAPI의 문서 전용 경로에서 생성된 타입이다 (spec 52).
 * 수기 DTO가 아니라 `paths[...]`에서 꺼내므로, 에이전트 요청 모양이 바뀌면 계약 동기화가
 * 여기서 먼저 깨진다.
 */
type AgentStreamContract =
  paths['/api/v1/agent/conversations/{conversationId}/messages/stream']['post']['requestBody']['content']['application/json'];
/** `responseLang`은 계약에 default가 있어 생성 타입이 필수로 그린다 — 전송 시엔 비워도 같은 요청이다 */
type AgentStreamBody = Omit<AgentStreamContract, 'responseLang'> &
  Partial<Pick<AgentStreamContract, 'responseLang'>>;

export interface SendMessageArgs {
  conversationId: string;
  /**
   * 대화 타입 (BE docs/specs/52). GUIDELINE_QA면 에이전트 경로, PATIENT_GUIDANCE면 오늘의
   * BE 채팅 경로로 간다. 아직 모르면(대화 단건 조회 전) 오늘 경로다.
   */
  conversationType?: ConversationType;
  content: string;
  /** 재시도 시 새 값을 생성한다 (crypto.randomUUID) */
  clientRequestId: string;
  /** PATIENT_GUIDANCE 경로에만 실린다 — 에이전트는 받지 않는다 (spec 52 「filters」) */
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
  const { conversationId, conversationType, content, clientRequestId, filters, responseLang, onEvent, signal } =
    args;

  /**
   * 일반 대화는 **무조건** 에이전트를 부른다 — 되돌림은 이 분기 한 줄의 재배포다 (spec 52
   * 「전환 방식」). 두 경로는 같은 오리진이고 nginx(운영)·rewrites(로컬)가 `/api/v1/agent/`만
   * 에이전트로 보낸다. 모르는 타입(조회 전)은 오늘 경로다 — 새 경로를 지어내지 않는다.
   */
  if (conversationType === 'GUIDELINE_QA') {
    const body: AgentStreamBody = {
      content,
      clientRequestId,
      // 없으면 키를 싣지 않는다 — 계약의 기본값이 'ko'라, 안 보내는 것이 오늘 요청과 같다
      ...(responseLang ? { responseLang } : {}),
    };
    await postStream(`/api/v1/agent/conversations/${conversationId}/messages/stream`, body, {
      onEvent,
      signal,
    });
    return;
  }

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
