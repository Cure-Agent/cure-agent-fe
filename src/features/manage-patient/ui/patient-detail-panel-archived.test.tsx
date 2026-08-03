// @vitest-environment happy-dom
// 보관된 환자 — 프로필 수정 필드 접근 자체를 차단한다
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { PatientDetailPanel } from './patient-detail-panel';

useMswServer();

const archivedPatient = {
  id: 'patient-1',
  caseLabel: '김환자',
  status: 'ARCHIVED' as const,
  heightCm: 170,
  weightKg: 65,
  diagnoses: ['고혈압'],
  medications: ['약A'],
  allergies: [],
  clinicalNotes: '초기 메모',
  version: 3,
};

/** 보관 상태에서 잠겨야 하는 프로필 칸 전부 */
const PROFILE_FIELDS = [
  '신장(cm)',
  '체중(kg)',
  '진단(쉼표 구분)',
  '복용약(쉼표 구분)',
  '알레르기(쉼표 구분)',
  '임상 메모',
];

describe('보관된 환자 상세', () => {
  it('보관 상태면 프로필 입력 칸과 저장 버튼이 모두 비활성화된다', async () => {
    server.use(
      http.get('/api/v1/patients/patient-1', () =>
        HttpResponse.json(envelope(archivedPatient)),
      ),
    );

    renderWithProviders(<PatientDetailPanel patientId="patient-1" />);

    await screen.findByLabelText('체중(kg)');
    for (const label of PROFILE_FIELDS) {
      const field = screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;
      expect(field.disabled, label).toBe(true);
    }
    expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('보관 상태여도 잠긴 칸에 기존 프로필 값이 그대로 남아 열람된다', async () => {
    server.use(
      http.get('/api/v1/patients/patient-1', () =>
        HttpResponse.json(envelope(archivedPatient)),
      ),
    );

    renderWithProviders(<PatientDetailPanel patientId="patient-1" />);

    expect(((await screen.findByLabelText('신장(cm)')) as HTMLInputElement).value).toBe('170');
    expect((screen.getByLabelText('진단(쉼표 구분)') as HTMLInputElement).value).toBe('고혈압');
    expect((screen.getByLabelText('복용약(쉼표 구분)') as HTMLInputElement).value).toBe('약A');
    expect((screen.getByLabelText('알레르기(쉼표 구분)') as HTMLInputElement).value).toBe('');
  });
});
