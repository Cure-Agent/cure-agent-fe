/** 대화 제목의 표시 해석 — 서버가 준 문자열을 그대로 그릴지, 자리표시자로 볼지 가른다 */

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

/**
 * 목록에 그릴 제목.
 *
 * 기본 제목은 대화의 이름이 아니라 「아직 이름이 없다」는 **상태 표시**라 화면 언어를 따라가고,
 * 언어를 바꾸면 같이 바뀐다. 첫 질문이 수락되면 BE가 질의 원문으로 제목을 확정하므로,
 * 그때부터는 저장된 문자열을 그대로 쓴다 — 질의 언어로 굳은 이름을 화면 언어로 번역하면
 * 검색어와 화면이 어긋난다.
 *
 * **완전일치만 치환한다.** 사람이 직접 "새 대화 정리"라고 이름 붙였거나 앞뒤 공백이 다르면
 * 그건 자리표시자가 아니라 그 사람이 고른 이름이다 — 다듬거나 부분일치로 삼키지 않는다.
 */
export function resolveConversationTitle(title: string, untitledLabel: string): string {
  return title === BE_DEFAULT_CONVERSATION_TITLE ? untitledLabel : title;
}
