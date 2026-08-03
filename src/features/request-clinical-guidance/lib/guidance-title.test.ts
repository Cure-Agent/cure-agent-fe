import { describe, expect, it } from 'vitest';

import { buildGuidanceTitle } from './guidance-title';

describe('buildGuidanceTitle', () => {
  it('케이스 라벨과 월/일 시:분으로 제목을 만든다', () => {
    expect(buildGuidanceTitle('CASE-001', new Date(2026, 7, 4, 14, 30))).toBe(
      'CASE-001 임상 참고 (8/4 14:30)',
    );
  });

  it('월·일·시에 0을 덧대지 않고 분만 채운다', () => {
    expect(buildGuidanceTitle('CASE-042', new Date(2026, 0, 9, 9, 5))).toBe(
      'CASE-042 임상 참고 (1/9 9:05)',
    );
  });

  it('자정도 24가 아니라 0시로 적는다', () => {
    expect(buildGuidanceTitle('CASE-007', new Date(2026, 11, 25, 0, 0))).toBe(
      'CASE-007 임상 참고 (12/25 0:00)',
    );
  });

  it('같은 환자를 같은 날 다시 시작해도 시각으로 갈린다', () => {
    const first = buildGuidanceTitle('CASE-001', new Date(2026, 7, 4, 9, 15));
    const second = buildGuidanceTitle('CASE-001', new Date(2026, 7, 4, 16, 40));
    expect(first).not.toBe(second);
  });
});
