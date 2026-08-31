/**
 * 권고등급·근거수준 라벨의 표시 언어 (BE docs/specs/44).
 *
 * BE가 렌더하지 않는 이유는 이것이 **코퍼스에서 파싱된 값**이기 때문이다 — BE가 다시 해석하면
 * §18의 「추출된 사실은 원문 그대로 둔다」와 어긋난다. 대신 프로덕션 전량이 6종뿐인 **닫힌 어휘**라
 * FE 문구표로 닫힌다 (`profileFieldLabel`과 같은 규율).
 *
 * 체계가 문서마다 달라 새 라벨이 올 수 있으므로 **모르는 값은 원문으로 남긴다** — 배지 자리가
 * 비는 것이 최악이고, `code`(`B`)가 그대로 보이므로 대조는 깨지지 않는다.
 */
import type { UiLang } from './ui-lang';

/** 스텁 — 문구표는 구현 단계에서 채운다 */
export function ratingLabel(label: string, _lang: UiLang): string {
  return label;
}
