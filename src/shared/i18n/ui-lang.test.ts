// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { UI_LANG_STORAGE_KEY, resolveUiLang, setUiLang } from './ui-lang';

/**
 * docs/specs/42 FE 수용 기준 28~29 동결 테스트. 구현 중 수정 금지.
 */

function setLanguageInputs(navigatorLanguage: string, stored: string | null): void {
  stubNavigatorLanguage(navigatorLanguage);
  stubStoredUiLang(UI_LANG_STORAGE_KEY, stored);
}

beforeEach(() => {
  setLanguageInputs('ko-KR', null);
});

describe('표시 언어 판정 (수용 기준 28~29)', () => {
  it('기준 28-a·c: 저장값이 없으면 ko-KR은 한국어, en-US는 영어로 시작한다', () => {
    setLanguageInputs('ko-KR', null);
    expect(resolveUiLang()).toBe('ko');

    setLanguageInputs('en-US', null);
    expect(resolveUiLang()).toBe('en');
  });

  it('기준 28-b·d: 지역 없는 ko도 한국어이고, ko 계열이 아닌 제3 로케일은 영어다', () => {
    setLanguageInputs('ko', null);
    expect(resolveUiLang()).toBe('ko');

    setLanguageInputs('ja-JP', null);
    expect(resolveUiLang()).toBe('en');
  });

  it('기준 29-a·b: 저장된 선택은 브라우저 자동 판정을 양방향으로 이긴다', () => {
    setLanguageInputs('en-US', 'ko');
    expect(resolveUiLang()).toBe('ko');

    setLanguageInputs('ko-KR', 'en');
    expect(resolveUiLang()).toBe('en');
  });

  it('기준 29-c: 영어를 고르면 그 선택이 저장되어 다음 판정에도 남는다', () => {
    setLanguageInputs('ko-KR', null);

    setUiLang('en');

    expect(resolveUiLang()).toBe('en');
    expect(localStorage.getItem(UI_LANG_STORAGE_KEY)).toBe('en');
  });

  it('기준 29-d: 지원하지 않는 저장값은 무시하고 브라우저 언어로 안전하게 돌아간다', () => {
    setLanguageInputs('en-US', 'fr');
    expect(resolveUiLang()).toBe('en');

    setLanguageInputs('en-US', '');
    expect(resolveUiLang()).toBe('en');
  });
});
