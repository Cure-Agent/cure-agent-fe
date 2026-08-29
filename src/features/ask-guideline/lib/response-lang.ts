/**
 * 입력 문장 → 답변 언어(`responseLang`) 유도 (BE docs/specs/42).
 *
 * **UI 언어에서 유도하지 않는다.** 예시 질의문은 「표시된 문장이 그대로 전송된다」가 계약이라
 * (spec 41 기준 27) 화면에 보이는 문장과 전송되는 문장이 같고, 그러면 질의 언어와 답변 언어는
 * 저절로 일치한다. 한국어 화면에서 영문을 붙여넣어 던져도 답은 영어로 와야 하는 이유가 이것이다.
 *
 * BE가 문자열로 추론하지 않는 이유는 짧은 질의·혼합 언어에서 판정이 흔들리기 때문이고,
 * 그래서 판정의 소유자가 FE다 — 사람이 방금 무슨 언어로 썼는지는 입력창이 가장 잘 안다.
 */
export type ResponseLang = 'ko' | 'en';

export function resolveResponseLang(_text: string): ResponseLang {
  void _text;
  return 'ko';
}
