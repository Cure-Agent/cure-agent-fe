// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { resolveResponseLang } from './response-lang';

/**
 * docs/specs/42 FE 수용 기준 32-a~d 동결 테스트. 구현 중 수정 금지.
 * 표시 언어 입력은 한국어 선택으로 고정해, 답변 언어가 오직 질문 본문을 따르는지도 함께 지킨다.
 */

beforeEach(() => {
  stubNavigatorLanguage('en-US');
  stubStoredUiLang(UI_LANG_STORAGE_KEY, 'ko');
});

describe('입력 문장의 답변 언어 판정 (수용 기준 32-a~d)', () => {
  it('기준 32-a·b: 한국어 문장은 ko, 영문 문장은 en으로 판정한다', () => {
    expect(resolveResponseLang('만성 요통에 침 치료가 도움이 되나요?')).toBe('ko');
    expect(resolveResponseLang('Can acupuncture help adults with chronic low back pain?')).toBe(
      'en',
    );
  });

  it('기준 32-c: 라틴 문자가 섞여도 한글이 하나라도 있는 임상 질의는 ko다', () => {
    expect(resolveResponseLang('ADHD 소아·청소년에서 1차 치료는 무엇인가요?')).toBe('ko');
    // 판정기가 모든 입력을 한국어로 보내는 공허한 구현이 아닌지도 같은 경계에서 확인한다.
    expect(resolveResponseLang('Which treatment should be considered first for children?')).toBe(
      'en',
    );
  });

  it('기준 32-d: 숫자·기호뿐이라 판정할 글자가 없으면 기존 한국어 경로로 떨어진다', () => {
    expect(resolveResponseLang('2026 · 42%?!')).toBe('ko');
    // 기본값과 실제 영문 판정을 구분해야 숫자·기호 폴백의 의미가 보존된다.
    expect(resolveResponseLang('What about treatment number 2?')).toBe('en');
  });
});
