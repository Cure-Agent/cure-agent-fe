// @vitest-environment happy-dom
// docs/specs/09 수용 기준 12·13 동결 테스트 — 구현 중 수정 금지
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  envelope,
  errorEnvelope,
  server,
  useMswServer,
} from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { PatientDetailPanel } from './patient-detail-panel';

useMswServer();

const activePatient = {
  id: 'patient-1',
  caseLabel: '김환자',
  status: 'ACTIVE' as const,
  updatedAt: '2026-07-24T00:00:00.000Z',
  weightKg: 65,
  diagnoses: ['고혈압'],
  medications: ['약A'],
  allergies: [],
  clinicalNotes: '초기 메모',
  version: 3,
};

describe('환자 상세 패널', () => {
  it('기준 12: 로드된 version을 PATCH body에 포함하고 충돌 서버 메시지를 alert로 렌더한다', async () => {
    let receivedBody: unknown;
    const conflictMessage = '다른 사용자가 환자 정보를 먼저 수정했습니다.';

    server.use(
      http.get('/api/v1/patients/patient-1', () =>
        HttpResponse.json(envelope(activePatient)),
      ),
      http.patch('/api/v1/patients/patient-1', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(
          {
            ...errorEnvelope('PATIENT_VERSION_CONFLICT', conflictMessage),
            data: { currentVersion: 4 },
          },
          { status: 409 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientDetailPanel patientId="patient-1" />);

    const weightInput = await screen.findByLabelText('체중(kg)');
    const notesInput = await screen.findByLabelText('임상 메모');
    await user.clear(weightInput);
    await user.type(weightInput, '67');
    await user.clear(notesInput);
    await user.type(notesInput, '수정 메모');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(receivedBody).toEqual(
        expect.objectContaining({ version: activePatient.version }),
      ),
    );
    expect((await screen.findByRole('alert')).textContent).toContain(conflictMessage);
  });

  it('기준 13: ACTIVE 환자의 보관 버튼을 누르면 archive API를 호출한다', async () => {
    let archiveRequestCount = 0;

    server.use(
      http.get('/api/v1/patients/patient-1', () =>
        HttpResponse.json(envelope(activePatient)),
      ),
      http.post('/api/v1/patients/patient-1/archive', () => {
        archiveRequestCount += 1;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientDetailPanel patientId="patient-1" />);

    await user.click(await screen.findByRole('button', { name: '보관' }));

    await waitFor(() => expect(archiveRequestCount).toBe(1));
  });
});
