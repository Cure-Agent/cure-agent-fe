/**
 * 표시 언어 판정의 입력 두 개(`navigator.language`·localStorage)를 테스트에서 고정하는 헬퍼.
 *
 * 판정 규칙은 담지 않는다 — 오직 환경만 세운다. 규칙을 여기 넣으면 오라클이 구현을 따라간다.
 *
 * `setup-dom.ts`가 유닛 테스트 기본 로케일을 `ko-KR`로 고정하므로, **언어를 다루는 테스트는
 * 두 입력을 반드시 명시적으로 세운다** — 환경 기본값에 기대면 무엇을 검증하는지 흐려진다.
 */

/** navigator.language를 이 테스트 동안 고정한다. */
export function stubNavigatorLanguage(language: string): void {
  Object.defineProperty(globalThis.navigator, 'language', {
    configurable: true,
    get: () => language,
  });
}

/** localStorage에 저장된 표시 언어 선택을 세운다. `null`이면 「고른 적 없음」. */
export function stubStoredUiLang(key: string, value: string | null): void {
  if (value === null) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  globalThis.localStorage?.setItem(key, value);
}
