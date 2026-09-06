/**
 * SSE 스트리밍 중간 상태 reducer (FE 분리본 §4 — TanStack Query 밖에서 관리).
 * 입력은 §8 ConversationStreamEvent. 중복·역행 seq delta는 무시한다.
 */
import type { components } from '@/shared/api/generated/schema';
import type { StreamEvent } from '@/shared/api/stream-client';
import { messagesFor } from '@/shared/i18n/messages';
import { resolveUiLang } from '@/shared/i18n/ui-lang';

export type EvidenceDetail = components['schemas']['EvidenceDetailResponseDto'];
export type MessageDto = components['schemas']['MessageResponseDto'];
export type GuidanceDto = components['schemas']['ClinicalGuidanceResponseDto'];
export type AnswerCitation = components['schemas']['AnswerCitationResponseDto'];
/** 메시지가 자기 언어를 말하는 축 (§44) — 계약의 `MessageResponseDto.responseLang`과 같은 값 */
export type MessageLang = NonNullable<MessageDto['responseLang']>;

export type StreamPhase =
  | 'idle'
  | 'accepted'
  | 'retrieving'
  /**
   * `answer.started`부터 첫 델타까지 (BE docs/specs/46). `streaming`으로 올리면 본문이
   * 아직 없는데 본문 렌더로 넘어가므로 그 사이에 단계를 하나 둔다.
   */
  | 'generating'
  | 'streaming'
  | 'completed'
  | 'abstained'
  | 'error';

/**
 * `retrieval.progress`가 말하는 **끝난 단계** (BE docs/specs/46).
 * 리랭크가 꺼진 구성에서는 `reranked`가 오지 않고, 기권 경로는 도달한 단계까지만 온다 —
 * 「보낸 진행은 실제로 일어난 일」이 그 계약의 불변식이다.
 */
export type RetrievalStage = 'embedded' | 'searched' | 'reranked';

export interface StreamError {
  code: string;
  message: string;
  retryable: boolean;
  traceId: string;
}

export interface StreamState {
  phase: StreamPhase;
  requestId: string | null;
  userMessageId: string | null;
  assistantMessageId: string | null;
  evidence: EvidenceDetail[];
  /**
   * `answer.started`가 싣는 **최종 근거 수** (BE docs/specs/47).
   *
   * 근거 배열과 별도의 축인 이유는 도착 순서가 뒤집혔기 때문이다 — `answer.started`가
   * 근거 프레임보다 **앞**에 오므로, 그 시점의 `evidence`는 아직 비어 있는데도 화면은
   * 「근거 N건을 바탕으로」의 N을 말해야 한다. 싣지 않는 BE에서는 null로 남고 화면이
   * `evidence.length`로 되돌아간다.
   */
  evidenceCount: number | null;
  /** 마지막으로 도착한 `retrieval.progress`의 단계 — 진행 이벤트가 없는 BE에서는 null로 남는다 */
  retrievalStage: RetrievalStage | null;
  /** `stage=searched`가 싣는 후보 수. 다른 stage에는 실리지 않으므로 대개 null이다 */
  retrievalCandidates: number | null;
  /** answer.delta 누적 본문 */
  content: string;
  /** 다음에 기대하는 seq — 불일치 delta는 무시 */
  nextSeq: number;
  /** completed/abstained의 최종 메시지 */
  message: MessageDto | null;
  /**
   * 전송 즉시 화면에 그리는 내 질문 — 서버는 본문을 되돌려주지 않는다(§8 message.accepted는 id만).
   * id는 처음엔 clientRequestId, message.accepted에서 서버 userMessageId로 교체된다.
   */
  pendingUser: MessageDto | null;
  /** PATIENT_GUIDANCE completed의 임상 참고안 (spec 10 — additive) */
  guidance: GuidanceDto | null;
  /**
   * 이번 스트림의 **응답 언어** — 방금 보낸 질의에서 유도한 값이다 (BE docs/specs/44).
   * 종결 메시지가 도착하기 전까지 화면이 딛는 값이고, 도착한 뒤에는 `message.responseLang`이
   * 같은 자리를 잇는다. 재조회 경로에는 저장된 메시지가 자기 언어를 말한다.
   */
  responseLang: MessageLang;
  error: StreamError | null;
}

export const initialStreamState: StreamState = {
  phase: 'idle',
  requestId: null,
  userMessageId: null,
  assistantMessageId: null,
  evidence: [],
  evidenceCount: null,
  retrievalStage: null,
  retrievalCandidates: null,
  content: '',
  nextSeq: 0,
  message: null,
  pendingUser: null,
  guidance: null,
  responseLang: 'ko',
  error: null,
};

export type StreamAction =
  | { type: 'event'; event: StreamEvent }
  | { type: 'send'; message: MessageDto; responseLang: MessageLang }
  | { type: 'streamFailed'; message: string }
  | { type: 'reset' };

export function streamReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case 'reset':
      return initialStreamState;
    case 'send':
      // 이전 스트림의 잔여(본문·오류)를 지우고 내 질문부터 띄운다.
      // 서버 accept 전이지만 phase를 올려 전송 버튼도 이때부터 잠근다(연타 방지).
      // `responseLang`은 초기화에 쓸려 나가면 안 된다 — 종결 메시지가 오기 전까지 스트리밍
      // 근거가 딛고 설 유일한 언어값이다 (§44).
      return {
        ...initialStreamState,
        phase: 'accepted',
        pendingUser: action.message,
        responseLang: action.responseLang,
      };
    case 'streamFailed':
      // 이미 종결된 스트림의 사후 실패(네트워크 정리 등)는 무시.
      // idle은 대화 전환 reset 뒤 도착한 옛 스트림의 실패 — 새 대화에 오류를 남기지 않는다.
      if (
        state.phase === 'idle' ||
        state.phase === 'completed' ||
        state.phase === 'abstained' ||
        state.phase === 'error'
      ) {
        return state;
      }
      return {
        ...state,
        phase: 'error',
        error: {
          code: 'STREAM_DISCONNECTED',
          message: action.message,
          retryable: true,
          traceId: '',
        },
      };
    case 'event':
      return applyEvent(state, action.event);
  }
}

const RETRIEVAL_STAGES: readonly string[] = ['embedded', 'searched', 'reranked'];

/** 계약이 아는 stage만 통과시킨다. 모르는 값·없는 값은 `null` — 호출부가 이벤트째 무시한다 */
function toRetrievalStage(value: unknown): RetrievalStage | null {
  return typeof value === 'string' && RETRIEVAL_STAGES.includes(value)
    ? (value as RetrievalStage)
    : null;
}

function applyEvent(state: StreamState, event: StreamEvent): StreamState {
  switch (event.eventType) {
    case 'message.accepted': {
      // 재시도 대비 초기화하되, 이미 그려둔 내 질문은 서버 id로 갱신만 한다
      const userMessageId = (event.userMessageId as string) ?? null;
      return {
        ...initialStreamState,
        phase: 'accepted',
        requestId: (event.requestId as string) ?? null,
        userMessageId,
        assistantMessageId: (event.assistantMessageId as string) ?? null,
        pendingUser:
          state.pendingUser && userMessageId
            ? { ...state.pendingUser, id: userMessageId }
            : state.pendingUser,
        // 이 초기화는 재시도 대비다 — 방금 보낸 질의의 언어까지 되돌리면 안 된다
        responseLang: state.responseLang,
      };
    }
    case 'retrieval.started':
      return { ...state, phase: 'retrieving' };
    case 'retrieval.progress': {
      const stage = toRetrievalStage(event.stage);
      // 모르는 stage는 진행이 아니라 미지의 문자열이다. 무시해야 BE가 단계를 늘려도
      // 화면이 「없는 진행」을 지어내지 않는다 (spec 46 기준 27 · architecture.md §3 전방 호환).
      if (!stage) return state;
      return {
        ...state,
        phase: 'retrieving',
        retrievalStage: stage,
        // `candidates`는 `searched`에만 실린다 — 매번 다시 읽어야 지난 단계의 후보 수가
        // 다음 단계 문구에 새지 않는다.
        retrievalCandidates: typeof event.candidates === 'number' ? event.candidates : null,
      };
    }
    case 'retrieval.evidence': {
      // 큰 프레임을 근거 1건씩으로 쪼갠 신규 이벤트 (BE docs/specs/47) — 일찍 도착한
      // 바이트가 **완결된 프레임**이 되어 카드를 하나씩 그릴 수 있게 한다.
      //
      // `index`는 재배치 키가 아니라 검산용이다: 같은 스트림의 프레임은 발신 순서대로
      // 도착하므로 이어붙이면 그 순서가 곧 리랭크 순위다. `index`를 배열 위치로 쓰면
      // 값이 하나라도 건너뛰었을 때 배열에 구멍이 생겨 `length`가 거짓말을 한다.
      const arrived = event.evidence as EvidenceDetail | undefined;
      if (!arrived) return state;
      // phase를 건드리지 않는다 — 이 프레임은 `answer.started` **뒤**에 오므로
      // `retrieving`으로 되돌리면 화면이 「답변 작성 중」에서 「검색 중」으로 뒷걸음질친다.
      return { ...state, evidence: [...state.evidence, arrived] };
    }
    case 'retrieval.completed': {
      /*
        신규 BE는 여기에 evidence를 싣지 않는다 (spec 47 기준 11) — 이미 근거 프레임으로
        다 보냈기 때문이다. **그래서 덮어쓰지 않고 있을 때만 받는다**: 무조건 대입하면
        키가 없는 신규 프레임이 앞서 모은 카드를 통째로 지운다.

        배열이 실려 오는 경로는 구버전 BE다. FE가 먼저 배포되므로(spec 47 배포 순서)
        이 갈래가 살아 있는 동안이 실제 운영 구간이고, 이 한 줄이 그 구간의 안전이다.
      */
      const legacyBatch = event.evidence;
      const hasLegacyBatch = Array.isArray(legacyBatch) && legacyBatch.length > 0;
      return {
        ...state,
        // `answer.started`가 이 프레임보다 앞에 오므로 generating은 유지한다.
        phase: state.phase === 'generating' ? state.phase : 'retrieving',
        evidence: hasLegacyBatch ? (legacyBatch as EvidenceDetail[]) : state.evidence,
      };
    }
    case 'answer.started':
      // evidence를 지우지 않는다 — 이 이벤트는 evidence 배열을 싣지 않고(spec 47 기준 3),
      // 근거는 뒤따르는 `retrieval.evidence` 프레임이 채운다.
      return {
        ...state,
        phase: 'generating',
        // 건수만 정수로 실려 온다. 이 시점의 `evidence`는 아직 비어 있으므로
        // 「근거 N건을 바탕으로」의 N은 여기서만 나온다. 싣지 않는 BE에서는 null로 두어
        // 화면이 `evidence.length`로 되돌아가게 한다.
        evidenceCount: typeof event.evidenceCount === 'number' ? event.evidenceCount : null,
      };
    case 'answer.delta': {
      if (event.seq !== state.nextSeq) return state; // 중복·역행 seq 무시
      return {
        ...state,
        phase: 'streaming',
        content: state.content + ((event.delta as string) ?? ''),
        nextSeq: state.nextSeq + 1,
      };
    }
    case 'answer.completed':
      return {
        ...state,
        phase: 'completed',
        message: (event.message as MessageDto) ?? null,
        guidance: (event.guidance as GuidanceDto | undefined) ?? null,
      };
    case 'answer.abstained':
      return {
        ...state,
        phase: 'abstained',
        // 이벤트의 `reason`은 읽지 않는다 — 같은 문장이 `message.abstainReason`에도
        // 실려 오는데(BE spec 43 기준 11), 그쪽만이 재조회에서도 살아남는다. 반쪽만 채워지는
        // 사본을 상태에 두면 나중에 그것을 그리는 순간 spec 43이 고친 갈라짐이 되살아난다.
        message: (event.message as MessageDto) ?? null,
      };
    case 'error':
      return {
        ...state,
        phase: 'error',
        error: {
          code: (event.code as string) ?? 'UNKNOWN',
          message: (event.message as string) ?? messagesFor(resolveUiLang()).genericError,
          retryable: Boolean(event.retryable),
          traceId: (event.traceId as string) ?? '',
        },
      };
    default:
      // enum 전방 호환 (architecture.md §1): 모르는 이벤트는 무시
      return state;
  }
}
