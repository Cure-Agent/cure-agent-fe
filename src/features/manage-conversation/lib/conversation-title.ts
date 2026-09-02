/** 대화 제목의 표시 해석 — 서버가 준 문자열을 그대로 그릴지, 자리표시자로 볼지 가른다 */
import { formatMessage, messagesFor } from '@/shared/i18n/messages';
import type { UiLang } from '@/shared/i18n/ui-lang';

/** 목록이 아는 대화의 성격 — `ConversationSummaryResponseDto.type`과 같은 어휘다 */
export type ConversationKind = 'GUIDELINE_QA' | 'PATIENT_GUIDANCE';

/**
 * BE가 제목 없는 대화에 넣어 두는 기본 제목 (`conversation.service.ts`의 `DEFAULT_TITLE`).
 *
 * 계약에 「제목이 아직 비어 있다」는 축이 없어(`ConversationSummaryResponseDto`에
 * `titleSource`가 없다) FE가 이 상수를 문자열로 알 수밖에 없다. BE가 상수를 바꾸면
 * 화면이 깨지지는 않고 **한국어 기본 제목이 다시 보일 뿐**이다. 그 결합을 없애려면 BE가
 * `titleSource`를 응답에 싣거나 제목을 비워 보내야 하고, 그건 계약 변경이다.
 *
 * **생성 요청에 제목을 실어 우회하지 않는다.** BE는 `titleSource: dto.title ? 'USER' : 'DEFAULT'`로
 * 굳히고 자동 제목은 `DEFAULT`인 대화에만 걸리므로, FE가 제목을 실어 보내면 그 대화는 첫 질문의
 * 언어로 제목을 받지 못하고 자리표시자에 영영 머문다.
 */
export const BE_DEFAULT_CONVERSATION_TITLE = '새 대화';

/** 제목이 어느 언어로 저장됐든 알아보려면 지원 언어를 모두 훑어야 한다 */
const TITLE_LANGS: readonly UiLang[] = ['ko', 'en'];

/**
 * `guidanceTitleTemplate`의 자리에 끼울 패턴.
 *
 * `{when}`을 `M/D H:MM` 모양으로 **좁게** 잡는 것이 이 해석의 안전장치다 — 사람이
 * "CASE-001 임상 참고 (재검토)"라고 손수 이름 붙이면 여기서 걸러져 그대로 남는다.
 * `{case}`는 lazy라 뒤따르는 리터럴이 경계를 잡아 준다.
 */
const GUIDANCE_TITLE_SLOTS: Record<string, string> = {
  case: '(?<case>.+?)',
  when: '(?<when>\\d{1,2}/\\d{1,2} \\d{1,2}:\\d{2})',
};

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 그 언어의 환자 맞춤 제목 틀을 정규식으로 바꾼다.
 *
 * 틀을 문자열로 베껴 두 벌 관리하지 않고 **메시지 리소스에서 파생한다** — 문구를 고치면
 * 알아보는 쪽도 같이 따라와야 한 쪽만 바뀌는 일이 없다. 자리를 **이름 있는 그룹**으로 잡는 건
 * 어순 때문이다: 언어마다 `{case}`와 `{when}`의 순서가 뒤집힐 수 있어 위치로 세면 깨진다.
 */
const guidanceTitlePatterns = new Map<UiLang, RegExp>();

function guidanceTitlePattern(lang: UiLang): RegExp {
  const cached = guidanceTitlePatterns.get(lang);
  if (cached) return cached;

  const source = messagesFor(lang)
    .guidanceTitleTemplate.split(/(\{\w+\})/)
    .map((part) => {
      const slot = /^\{(\w+)\}$/.exec(part)?.[1];
      return slot && slot in GUIDANCE_TITLE_SLOTS
        ? GUIDANCE_TITLE_SLOTS[slot]
        : escapeRegExp(part);
    })
    .join('');
  const pattern = new RegExp(`^${source}$`);
  guidanceTitlePatterns.set(lang, pattern);
  return pattern;
}

/**
 * 환자 맞춤 대화의 기본 제목이면 화면 언어로 다시 조립한다 — 아니면 null.
 *
 * `PATIENT_GUIDANCE`일 때만 본다. 사람이 일반 대화에 우연히 같은 모양의 이름을 붙였다면
 * 그건 그 사람이 고른 이름이지 우리가 만든 라벨이 아니다.
 */
function retranslateGuidanceTitle(
  title: string,
  lang: UiLang,
  kind: ConversationKind | undefined,
): string | null {
  if (kind !== 'PATIENT_GUIDANCE') return null;

  for (const source of TITLE_LANGS) {
    const groups = guidanceTitlePattern(source).exec(title)?.groups;
    if (!groups) continue;
    return formatMessage(messagesFor(lang).guidanceTitleTemplate, {
      case: groups.case,
      when: groups.when,
    });
  }
  return null;
}

/**
 * 목록에 그릴 제목.
 *
 * 세 갈래다.
 *
 * - **BE 기본 제목**은 대화의 이름이 아니라 「아직 이름이 없다」는 **상태 표시**라 화면 언어를
 *   따라가고, 언어를 바꾸면 같이 바뀐다. 완전일치만 치환한다 — 사람이 직접 "새 대화 정리"라고
 *   이름 붙였거나 앞뒤 공백이 다르면 그건 자리표시자가 아니라 그 사람이 고른 이름이다.
 * - **환자 맞춤 대화의 기본 제목**(`buildGuidanceTitle`이 만든 `… 임상 참고 (…)`)도 같은 부류다.
 *   사람이 지은 이름이 아니라 FE가 케이스 라벨과 시각 사이에 기계적으로 끼워 넣은 라벨이라,
 *   화면 언어를 따라간다. 케이스 라벨과 시각은 그 사람의 데이터라 손대지 않고 **라벨만** 바꾼다.
 * - **첫 질문에서 확정된 제목**은 저장된 문자열을 그대로 쓴다 — 질의 언어로 굳은 이름을 화면
 *   언어로 번역하면 검색어와 화면이 어긋난다.
 *
 * 라벨을 다시 그리면 그 라벨에 한해 「보이는 문구로 검색」이 어긋난다(검색은 BE 제목 ILIKE다).
 * 그 값을 치르는 이유는, 라벨이 모든 환자 맞춤 대화에 똑같이 붙어 있어 검색어로서 변별력이
 * 없기 때문이다 — 실제로 찾는 축인 케이스 라벨은 제목에 그대로 남는다.
 */
export function resolveConversationTitle(
  title: string,
  lang: UiLang,
  kind?: ConversationKind,
): string {
  if (title === BE_DEFAULT_CONVERSATION_TITLE) return messagesFor(lang).untitledConversation;
  return retranslateGuidanceTitle(title, lang, kind) ?? title;
}
