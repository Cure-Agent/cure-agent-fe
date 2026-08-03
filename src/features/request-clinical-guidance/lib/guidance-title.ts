/** 환자 맞춤 대화의 기본 제목 — 생성 시점에 확정한다 */

/**
 * "CASE-001 임상 참고 (8/4 14:30)".
 *
 * 서버는 기본 제목인 대화에 첫 질문이 수락될 때만 제목을 확정한다. 환자 맞춤 대화는
 * 사용자가 질문을 던지지 않고 시작하므로 그 트리거가 걸리지 않아 "새 대화"로 남는다 —
 * 그래서 생성 요청이 직접 제목을 싣는다.
 *
 * 같은 환자를 하루에 여러 번 시작해도 갈리도록 시각까지 넣는다. 로케일에 흔들리지 않게
 * 직접 조립하며, 목록 항목이 한 줄 truncate라 연도는 뺀다. 분만 두 자리로 채운다 —
 * 9:5는 읽히지 않지만 09:05는 앞의 케이스 라벨이 쓸 글자를 뺏는다.
 */
export function buildGuidanceTitle(caseLabel: string, now: Date = new Date()): string {
  const date = `${now.getMonth() + 1}/${now.getDate()}`;
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  return `${caseLabel} 임상 참고 (${date} ${time})`;
}
