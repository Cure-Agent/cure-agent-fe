// @vitest-environment happy-dom

/**
 * 적용 판단·환자 근거 렌더 (BE docs/specs/33).
 * 두 필드는 구조화 경로에서만 실리는 선택 필드라, **없을 때 조용히 빠지는 것**까지가 계약이다 —
 * 결정적 폴백으로 조립된 참고안과 기존에 저장된 참고안에는 이 필드가 없다.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useMswServer } from '../../../shared/test/msw';
import { renderWithProviders } from '../../../shared/test/render';
import { GuidanceCard } from './guidance-card';

const baseGuidance = {
  id: 'g-33',
  patientId: 'p-33',
  patientProfileSnapshotId: 'snap-33',
  summary: '골다공증 침 치료 참고안',
  safetyAlerts: [],
  missingInformation: [],
  reviewStatus: 'DRAFT' as const,
  generatedAt: '2026-08-03T10:00:00.000Z',
};

const structuredGuidance = {
  ...baseGuidance,
  considerations: [
    {
      title: '침 치료 유침 시간',
      rationale: '유침 시간은 30~45분간 시행하는 것이 적절하다는 근거가 있습니다.',
      citations: [],
      applicability: 'APPLICABLE' as const,
      patientFactors: ['진단명'],
    },
    {
      title: '침과 통상적 치료 병행',
      rationale: '통상적 치료와 병행한 침 치료가 권고되며, 환자에게 알렌드로네이트 투약이 있습니다.',
      citations: [],
      applicability: 'CAUTION' as const,
      patientFactors: ['진단명', '투약 목록'],
    },
    {
      title: '적용 대상 아님',
      rationale: '근거의 대상 질환과 환자 진단명이 만나지 않습니다.',
      citations: [],
      applicability: 'NOT_APPLICABLE' as const,
      patientFactors: ['진단명'],
    },
  ],
};

/** 결정적 폴백 경로 — 구조화 필드가 아예 없는 참고안 */
const fallbackGuidance = {
  ...baseGuidance,
  considerations: [
    {
      title: '요통 진료지침 — 치료 > 침치료',
      rationale: '만성 요통 환자에게 침 치료를 권고한다',
      citations: [],
    },
  ],
};

useMswServer();

describe('GuidanceCard 적용 판단', () => {
  it('세 가지 적용 판단을 한국어 배지로 렌더링한다', () => {
    renderWithProviders(<GuidanceCard guidance={structuredGuidance} />);

    expect(screen.getByText('적용')).toBeInTheDocument();
    expect(screen.getByText('주의')).toBeInTheDocument();
    expect(screen.getByText('해당없음')).toBeInTheDocument();
  });

  it('각 판단이 딛고 선 환자 근거 필드를 렌더링한다', () => {
    renderWithProviders(<GuidanceCard guidance={structuredGuidance} />);

    expect(screen.getAllByText('환자 근거')).toHaveLength(3);
    expect(screen.getAllByText('진단명')).toHaveLength(3);
    expect(screen.getByText('투약 목록')).toBeInTheDocument();
  });

  it('제목·근거 문장은 배지와 함께 그대로 보인다', () => {
    renderWithProviders(<GuidanceCard guidance={structuredGuidance} />);

    expect(screen.getByText('침 치료 유침 시간')).toBeInTheDocument();
    expect(
      screen.getByText('유침 시간은 30~45분간 시행하는 것이 적절하다는 근거가 있습니다.'),
    ).toBeInTheDocument();
  });

  it('구조화 필드가 없는 폴백 참고안에서는 배지와 환자 근거를 그리지 않는다', () => {
    renderWithProviders(<GuidanceCard guidance={fallbackGuidance} />);

    // 폴백 경로가 기존과 똑같이 보이는 것이 계약이다 — 빈 배지 자리가 생기면 안 된다
    expect(screen.queryByText('환자 근거')).not.toBeInTheDocument();
    expect(screen.queryByText('적용')).not.toBeInTheDocument();
    expect(screen.queryByText('주의')).not.toBeInTheDocument();
    expect(screen.queryByText('해당없음')).not.toBeInTheDocument();
    expect(screen.getByText('요통 진료지침 — 치료 > 침치료')).toBeInTheDocument();
  });
});
