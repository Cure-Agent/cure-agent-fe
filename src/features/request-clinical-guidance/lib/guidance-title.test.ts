import { describe, expect, it } from 'vitest';
import { buildGuidanceTitle } from './guidance-title';

describe('buildGuidanceTitle 환자 맞춤 대화 제목', () => {
  it('한국어 제목에 케이스 라벨과 로컬 월·일·시각을 넣는다', () => {
    expect(buildGuidanceTitle('CASE-001', 'ko', new Date(2026, 7, 4, 14, 30))).toBe(
      'CASE-001 임상 참고 (8/4 14:30)',
    );
  });

  it('영문 제목에 영어 문구와 로컬 월·일·시각을 넣는다', () => {
    expect(buildGuidanceTitle('CASE-001', 'en', new Date(2026, 7, 4, 14, 30))).toBe(
      'CASE-001 Clinical guidance (8/4 14:30)',
    );
  });

  it('한국어 제목은 월·일·시에 0을 덧대지 않고 분만 두 자리로 채운다', () => {
    expect(buildGuidanceTitle('CASE-042', 'ko', new Date(2026, 0, 9, 9, 5))).toBe(
      'CASE-042 임상 참고 (1/9 9:05)',
    );
  });

  it('영문 제목도 월·일·시에 0을 덧대지 않고 분만 두 자리로 채운다', () => {
    expect(buildGuidanceTitle('CASE-042', 'en', new Date(2026, 0, 9, 9, 5))).toBe(
      'CASE-042 Clinical guidance (1/9 9:05)',
    );
  });

  it('자정은 24시가 아니라 0시로 표시한다', () => {
    expect(buildGuidanceTitle('CASE-007', 'ko', new Date(2026, 11, 25, 0, 0))).toBe(
      'CASE-007 임상 참고 (12/25 0:00)',
    );
  });

  it('같은 환자를 같은 날 다른 시각에 시작하면 서로 다른 한국어 제목을 만든다', () => {
    const morning = buildGuidanceTitle('CASE-001', 'ko', new Date(2026, 7, 4, 9, 15));
    const afternoon = buildGuidanceTitle('CASE-001', 'ko', new Date(2026, 7, 4, 16, 40));

    expect(morning).toBe('CASE-001 임상 참고 (8/4 9:15)');
    expect(afternoon).toBe('CASE-001 임상 참고 (8/4 16:40)');
    expect(morning).not.toBe(afternoon);
  });

  it('케이스 라벨은 번역하지 않고 한국어·영문 제목 맨 앞에 그대로 둔다', () => {
    const now = new Date(2026, 2, 1, 10, 11);
    const korean = buildGuidanceTitle('CASE-042', 'ko', now);
    const english = buildGuidanceTitle('CASE-042', 'en', now);

    expect(korean).toBe('CASE-042 임상 참고 (3/1 10:11)');
    expect(english).toBe('CASE-042 Clinical guidance (3/1 10:11)');
    expect(korean.startsWith('CASE-042')).toBe(true);
    expect(english.startsWith('CASE-042')).toBe(true);
  });
});
