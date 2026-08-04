// @vitest-environment happy-dom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/shared/test/render';
import type { Clinician } from '../api/auth.api';
import { ProfilePanel } from './profile-panel';

const ME: Clinician = {
  id: 'clinician-1',
  email: 'doctor@cure.test',
  displayName: '김한의',
  clinic: { id: 'clinic-1', name: '서울한의원' },
  verificationStatus: 'VERIFIED',
};

describe('ProfilePanel', () => {
  it('온보딩에서 정해진 계정 정보를 항목별로 보여준다', () => {
    renderWithProviders(<ProfilePanel me={ME} />);

    for (const label of ['이름', '이메일', '소속', '면허 인증']) {
      expect(screen.getByText(label)).toBeVisible();
    }
    expect(screen.getByText('김한의')).toBeVisible();
    // 소셜 계정 이메일이 계정 동일성의 기준이라 반드시 확인할 수 있어야 한다
    expect(screen.getByText('doctor@cure.test')).toBeVisible();
    expect(screen.getByText('서울한의원')).toBeVisible();
  });

  it('수정 API가 없으므로 값을 바꾸는 컨트롤을 두지 않는다', () => {
    renderWithProviders(<ProfilePanel me={ME} />);

    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it.each([
    ['VERIFIED', '인증 완료'],
    ['PENDING', '확인 중'],
    ['REJECTED', '인증 반려'],
  ] as const)('면허 인증 상태 %s를 %s로 표시한다', (status, label) => {
    renderWithProviders(<ProfilePanel me={{ ...ME, verificationStatus: status }} />);

    expect(screen.getByText(label)).toBeVisible();
  });
});
