/** 대화 제목의 표시 해석 — 서버가 준 문자열을 그대로 그릴지, 자리표시자로 볼지 가른다 */

/**
 * BE가 제목 없는 대화에 넣어 두는 기본 제목 (`conversation.service.ts`의 `DEFAULT_TITLE`).
 *
 * 계약에 「제목이 아직 비어 있다」는 축이 없어(`ConversationSummaryResponseDto`에
 * `titleSource`가 없다) FE가 이 상수를 문자열로 알 수밖에 없다. BE가 상수를 바꾸면
 * 화면이 깨지지는 않고 **한국어 기본 제목이 다시 보일 뿐**이다.
 */
export const BE_DEFAULT_CONVERSATION_TITLE = '새 대화';

/**
 * 목록에 그릴 제목.
 *
 * 기본 제목은 대화의 이름이 아니라 「아직 이름이 없다」는 상태 표시라 화면 언어를 따라간다.
 * 첫 질문이 수락되면 BE가 질의 원문으로 제목을 확정하므로, 그때부터는 그 문자열을 그대로 쓴다.
 *
 * TODO(stub): 시그니처만 세운 스텁이다. 본문은 동결 이후 구현이 채운다.
 */
export function resolveConversationTitle(title: string, untitledLabel: string): string {
  void title;
  void untitledLabel;
  return '';
}
