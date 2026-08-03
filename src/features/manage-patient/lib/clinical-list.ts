/** 진단·복용약·알레르기 — 서버는 문자열 배열, 입력은 쉼표 구분 한 줄이다 */

/** 쉼표 구분 문자열 → trim된 배열 (빈 입력은 빈 배열) */
export function parseList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** 배열 → 입력 칸에 되돌려 놓을 쉼표 구분 문자열 */
export function formatList(items: string[] | undefined): string {
  return (items ?? []).join(', ');
}
