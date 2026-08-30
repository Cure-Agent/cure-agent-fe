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

/**
 * 한국어로 판정하는 최소 한글 비율. 임상 질의는 「ADHD 소아·청소년에서…」처럼 라틴 문자가
 * 섞이므로 과반을 요구하면 한국어 질의가 영어로 오판되고, 그러면 **번역이 필요 없는 질의에
 * 영문 답변이 붙어** 한국어 경로가 조용히 바뀐다. 낮게 잡아 한국어 쪽으로 기울인다.
 *
 * BE의 `query-language.ts`와 같은 값이다 — 두 판정의 축은 다르지만(BE는 검색 번역 여부,
 * 여기는 답변 언어) 같은 문장을 서로 다르게 읽으면 진단이 어려워진다.
 */
const HANGUL_RATIO = 0.2;

/**
 * 범위를 `\u` 이스케이프로 적는다 — `[가-힣ㄱ-ㅎㅏ-ㅣ]`가 아니라.
 *
 * 번들러는 **문자열 리터럴만** `\uXXXX`로 이스케이프하고 정규식 리터럴은 원문 바이트를 그대로
 * 남긴다. 그래서 번들이 `charset=utf-8` 없이 서빙되면 브라우저가 Latin-1로 읽어 범위 양끝이
 * 뒤집히고, `SyntaxError`가 **번들 평가를 통째로 죽인다** — 디자인 시스템 재동기화의
 * `[BUNDLE_EXPORT]` 검사가 이 레포에서 실제로 그렇게 터졌다(2026-08-30, 14/14 export 소실).
 * 이스케이프로 적으면 소스가 전부 ASCII라 어느 인코딩으로 읽혀도 같은 정규식이다.
 *
 * 범위는 BE `query-language.ts`와 같다: 완성형 가–힣 · 자음 ㄱ–ㅎ · 모음 ㅏ–ㅣ.
 */
const HANGUL = /[\uAC00-\uD7A3\u3131-\u314E\u314F-\u3163]/g;
const LETTER = /[\uAC00-\uD7A3\u3131-\u314E\u314F-\u3163A-Za-z]/g;

export function resolveResponseLang(text: string): ResponseLang {
  const letters = text.match(LETTER)?.length ?? 0;
  // 숫자·기호뿐인 입력은 가릴 언어가 없다 — 오늘 경로인 한국어로 둔다
  if (letters === 0) return 'ko';

  const hangul = text.match(HANGUL)?.length ?? 0;
  return hangul / letters >= HANGUL_RATIO ? 'ko' : 'en';
}
