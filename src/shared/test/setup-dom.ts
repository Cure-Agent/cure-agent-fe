// vitest 전역 셋업 — jest-dom matcher(toHaveTextContent 등) 등록
import '@testing-library/jest-dom/vitest';

/**
 * 유닛 테스트의 기본 로케일을 `ko-KR`로 고정한다 (BE docs/specs/42).
 *
 * 표시 언어가 `navigator.language`에서 유도되기 시작하면, 이 값을 고정하지 않는 한 화면 문구가
 * **러너 환경의 로케일에 따라 바뀐다** — happy-dom 기본값은 `en-US`라 한국어 문구를 단언하는
 * 기존 테스트가 통째로 환경 의존이 된다. 기본값을 여기서 못박고, 언어를 다루는 테스트는
 * `shared/test/ui-lang-env.ts`로 두 입력을 명시적으로 덮는다.
 */
if (typeof globalThis.navigator !== 'undefined') {
  Object.defineProperty(globalThis.navigator, 'language', {
    configurable: true,
    get: () => 'ko-KR',
  });
}
