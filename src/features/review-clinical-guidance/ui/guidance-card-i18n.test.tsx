// @vitest-environment happy-dom

/**
 * 참고안 카드의 환자 프로필 필드명 — `patientFactors`(딛은 값)와 `missingInformation`(빠진 값)이
 * 함께 쓰는 닫힌 어휘가 표시 언어를 따르는지 본다.
 *
 * 두 목록은 BE에서 **같은 목록의 여집합**으로 만들어진다(§33). 한쪽만 번역되면 영문 화면에서
 * 「무엇을 딛었는가」와 「무엇이 빠졌는가」가 다른 언어로 갈려 나란히 읽히지 않는다.
 */
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';
import { useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { GuidanceCard } from './guidance-card';

useMswServer();

function setLanguageInputs(navigatorLanguage: string, stored: string | null): void {
  stubNavigatorLanguage(navigatorLanguage);
  stubStoredUiLang(UI_LANG_STORAGE_KEY, stored);
}

const guidance = {
  id: 'g-42',
  patientId: 'p-42',
  patientProfileSnapshotId: 'snap-42',
  summary: '골다공증 침 치료 참고안',
  safetyAlerts: [],
  // 여집합 관계 그대로 — 딛은 값 둘, 빠진 값 둘
  missingInformation: ['허리둘레', '알레르기 이력'],
  reviewStatus: 'DRAFT' as const,
  generatedAt: '2026-08-03T10:00:00.000Z',
  considerations: [
    {
      title: '침 치료 유침 시간',
      rationale: '유침 시간은 30~45분간 시행하는 것이 적절하다는 근거가 있습니다.',
      citations: [],
      applicability: 'APPLICABLE' as const,
      patientFactors: ['진단명', '투약 목록'],
    },
  ],
};

beforeEach(() => {
  setLanguageInputs('ko-KR', null);
});

describe('GuidanceCard 환자 프로필 필드명', () => {
  it('영문 화면에서 환자 근거 배지가 영어로 나온다 — 영어 라벨 옆에 한국어 배지가 남지 않는다', () => {
    setLanguageInputs('en-US', null);
    renderWithProviders(<GuidanceCard guidance={guidance} />);

    expect(screen.getByText('Patient evidence')).toBeTruthy();
    expect(screen.getByText('Diagnoses')).toBeTruthy();
    expect(screen.getByText('Medications')).toBeTruthy();
    expect(screen.queryByText('진단명')).toBeNull();
    expect(screen.queryByText('투약 목록')).toBeNull();
  });

  it('같은 어휘를 쓰는 누락 정보도 함께 영어로 나온다 — 두 목록의 언어가 갈리지 않는다', () => {
    setLanguageInputs('en-US', null);
    renderWithProviders(<GuidanceCard guidance={guidance} />);

    expect(screen.getByText('Missing information')).toBeTruthy();
    expect(screen.getByText('Waist circumference')).toBeTruthy();
    expect(screen.getByText('Allergy history')).toBeTruthy();
    expect(screen.queryByText('허리둘레')).toBeNull();
    expect(screen.queryByText('알레르기 이력')).toBeNull();
  });

  it('한국어 화면은 오늘 그대로다 — BE가 보낸 문자열과 한 글자도 다르지 않다', () => {
    setLanguageInputs('ko-KR', null);
    renderWithProviders(<GuidanceCard guidance={guidance} />);

    expect(screen.getByText('진단명')).toBeTruthy();
    expect(screen.getByText('투약 목록')).toBeTruthy();
    expect(screen.getByText('허리둘레')).toBeTruthy();
    expect(screen.getByText('알레르기 이력')).toBeTruthy();
  });

  /** BE가 어휘를 넓히면 FE가 모르는 값이 온다 — 배지 자리가 비는 것이 최악이다 */
  it('어휘 밖의 필드명은 지우지 않고 원문 그대로 남긴다', () => {
    setLanguageInputs('en-US', null);
    renderWithProviders(
      <GuidanceCard
        guidance={{
          ...guidance,
          missingInformation: ['흡연력'],
          considerations: [{ ...guidance.considerations[0], patientFactors: ['가족력'] }],
        }}
      />,
    );

    expect(screen.getByText('가족력')).toBeTruthy();
    expect(screen.getByText('흡연력')).toBeTruthy();
  });
});
