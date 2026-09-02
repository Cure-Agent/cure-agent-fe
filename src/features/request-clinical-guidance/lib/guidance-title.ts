/** 환자 맞춤 대화의 기본 제목 — 생성 시점에 확정한다 */
import { formatMessage, messagesFor } from '@/shared/i18n/messages';
import type { UiLang } from '@/shared/i18n/ui-lang';

/**
 * "CASE-001 임상 참고 (8/4 14:30)" / "CASE-001 Clinical guidance (8/4 14:30)".
 *
 * 서버는 기본 제목인 대화에 첫 질문이 수락될 때만 제목을 확정한다. 환자 맞춤 대화는
 * 사용자가 질문을 던지지 않고 시작하므로 그 트리거가 걸리지 않아 "새 대화"로 남는다 —
 * 그래서 생성 요청이 직접 제목을 싣는다.
 *
 * **언어를 인자로 받아 생성 시점에 굳힌다** — 서버에 나가는 문자열이라 값이 하나여야 하고,
 * 그 시점에 아직 질의문이 없으므로 쓸 수 있는 축은 화면 언어뿐이다. 이 대화에서 실제로 나갈
 * 질의문은 예시 질의문이고 「표시된 문장이 그대로 전송된다」가 계약이라(spec 41 기준 27)
 * 두 축은 사실상 같은 값이다.
 *
 * **다만 굳는 건 저장값이지 화면이 아니다.** 여기서 만든 `임상 참고`/`Clinical guidance`는
 * 사람이 고른 이름이 아니라 케이스 라벨과 시각 사이에 기계적으로 끼워 넣은 라벨이라,
 * 목록은 `manage-conversation/lib/conversation-title.ts`에서 이 틀을 되읽어 **그 라벨만**
 * 화면 언어로 다시 그린다. 케이스 라벨과 시각은 그 사람의 데이터라 손대지 않는다.
 *
 * 같은 환자를 하루에 여러 번 시작해도 갈리도록 시각까지 넣는다. 로케일에 흔들리지 않게
 * 직접 조립하며(두 언어가 같은 `M/D H:MM`을 쓴다), 목록 항목이 한 줄 truncate라 연도는 뺀다.
 * 분만 두 자리로 채운다 — 9:5는 읽히지 않지만 09:05는 앞의 케이스 라벨이 쓸 글자를 뺏는다.
 */
export function buildGuidanceTitle(
  caseLabel: string,
  lang: UiLang,
  now: Date = new Date(),
): string {
  const date = `${now.getMonth() + 1}/${now.getDate()}`;
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  return formatMessage(messagesFor(lang).guidanceTitleTemplate, {
    case: caseLabel,
    when: `${date} ${time}`,
  });
}
