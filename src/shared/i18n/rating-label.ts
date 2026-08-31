/**
 * 권고등급·근거수준 라벨의 표시 언어 (BE docs/specs/44).
 *
 * BE가 렌더하지 않는 이유는 이것이 **코퍼스에서 파싱된 값**이기 때문이다 — BE가 다시 해석하면
 * §18의 「추출된 사실은 원문 그대로 둔다」와 어긋난다. 대신 프로덕션 전량이 6종뿐인 **닫힌 어휘**라
 * FE 문구표로 닫힌다 (`profileFieldLabel`과 같은 규율: 자유 문장은 BE, 유한한 어휘는 FE).
 *
 * 표의 키가 `code`가 아니라 **한국어 라벨**인 이유는 같은 `code`(`A`·`B`)가 지침마다 다른 체계를
 * 가리킬 수 있기 때문이다 — 뜻을 지고 있는 쪽은 라벨이다.
 */
import type { UiLang } from './ui-lang';

/**
 * 프로덕션 전량(2026-08-31 관측): 중등도 권고 1242 · 약한 권고 1017 · 전문가 합의 권고 132 ·
 * 강한 권고 99 · 권고하지 않음 12 · 권고 보류 6.
 */
const RATING_LABELS_EN: Record<string, string> = {
  '강한 권고': 'Strong recommendation',
  '중등도 권고': 'Moderate recommendation',
  '약한 권고': 'Weak recommendation',
  '전문가 합의 권고': 'Expert consensus recommendation',
  '권고하지 않음': 'Not recommended',
  '권고 보류': 'Recommendation withheld',
};

/**
 * 등급 라벨을 콘텐츠 언어로 옮긴다.
 *
 * **모르는 값은 원문 그대로 남긴다.** DTO 주석대로 등급 체계가 문서마다 달라 새 라벨이 올 수
 * 있는데, 그때 배지 자리가 비는 것이 최악이다. `code`가 함께 보이므로 대조는 깨지지 않는다.
 */
export function ratingLabel(label: string, lang: UiLang): string {
  if (lang === 'ko') return label;
  return RATING_LABELS_EN[label] ?? label;
}
