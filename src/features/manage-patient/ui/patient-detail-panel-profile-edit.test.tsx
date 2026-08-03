// @vitest-environment happy-dom
// ACTIVE 환자 — 신장·진단·복용약·알레르기까지 프로필 수정 대상이다
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { describe, expect, it } from 'vitest';
import { PatientDetailPanel } from './patient-detail-panel';

useMswServer();

const activePatient = {
  id: 'patient-1',
  caseLabel: '김환자',
  status: 'ACTIVE' as const,
  heightCm: 170,
  weightKg: 65,
  diagnoses: ['고혈압'],
  medications: ['약A'],
  allergies: ['꽃가루'],
  clinicalNotes: '초기 메모',
  version: 3,
};

describe('환자 프로필 수정', () => {
  it('로드된 상세 값으로 입력 칸이 채워진다', async () => {
    server.use(
      http.get('/api/v1/patients/patient-1', () => HttpResponse.json(envelope(activePatient))),
    );

    renderWithProviders(<PatientDetailPanel patientId="patient-1" />);

    expect(((await screen.findByLabelText('신장(cm)')) as HTMLInputElement).value).toBe('170');
    expect((screen.getByLabelText('진단(쉼표 구분)') as HTMLInputElement).value).toBe('고혈압');
    expect((screen.getByLabelText('복용약(쉼표 구분)') as HTMLInputElement).value).toBe('약A');
    expect((screen.getByLabelText('알레르기(쉼표 구분)') as HTMLInputElement).value).toBe('꽃가루');
  });

  it('수정한 신장·진단·복용약·알레르기가 PATCH body에 실린다', async () => {
    let receivedBody: unknown;

    server.use(
      http.get('/api/v1/patients/patient-1', () => HttpResponse.json(envelope(activePatient))),
      http.patch('/api/v1/patients/patient-1', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(envelope({ ...activePatient, version: 4 }));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientDetailPanel patientId="patient-1" />);

    const heightInput = await screen.findByLabelText('신장(cm)');
    await user.clear(heightInput);
    await user.type(heightInput, '172');

    const diagnosesInput = screen.getByLabelText('진단(쉼표 구분)');
    await user.clear(diagnosesInput);
    await user.type(diagnosesInput, '고혈압, 만성 요통');

    const medicationsInput = screen.getByLabelText('복용약(쉼표 구분)');
    await user.clear(medicationsInput);
    await user.type(medicationsInput, '약B');

    // 빈 입력은 빈 배열로 — 알레르기 없음을 서버에 반영한다
    await user.clear(screen.getByLabelText('알레르기(쉼표 구분)'));

    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(receivedBody).toEqual(
        expect.objectContaining({
          version: activePatient.version,
          heightCm: 172,
          diagnoses: ['고혈압', '만성 요통'],
          medications: ['약B'],
          allergies: [],
        }),
      ),
    );
  });
});
