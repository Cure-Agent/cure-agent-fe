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
  updatedAt: '2026-07-24T00:00:00.000Z',
  weightKg: 65,
  diagnoses: ['고혈압'],
  medications: ['약A'],
  allergies: [],
  clinicalNotes: '초기 메모',
  version: 3,
};

describe('보관된 환자 상세', () => {
  it('보관 상태면 체중·임상 메모 입력과 저장 버튼이 모두 비활성화된다', async () => {
    server.use(
      http.get('/api/v1/patients/patient-1', () =>
        HttpResponse.json(envelope(archivedPatient)),
      ),
    );

    renderWithProviders(<PatientDetailPanel patientId="patient-1" />);

    const weightInput = (await screen.findByLabelText('체중(kg)')) as HTMLInputElement;
    const notesInput = screen.getByLabelText('임상 메모') as HTMLTextAreaElement;
    const saveButton = screen.getByRole('button', { name: '저장' }) as HTMLButtonElement;

    expect(weightInput.disabled).toBe(true);
    expect(notesInput.disabled).toBe(true);
    expect(saveButton.disabled).toBe(true);
  });
});
