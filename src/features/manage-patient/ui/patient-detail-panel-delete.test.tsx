// @vitest-environment happy-dom
// 환자 상세에서의 삭제 (BE spec 34) — 지운 상세로 돌아갈 수 없게 목록으로 replace한다
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { PatientDetailPanel } from './patient-detail-panel';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

useMswServer();

const activePatient = {
  id: 'patient-1',
  caseLabel: 'CASE-001',
  status: 'ACTIVE' as const,
  heightCm: 170,
  weightKg: 65,
  diagnoses: ['고혈압'],
  medications: ['약A'],
  allergies: ['꽃가루'],
  clinicalNotes: '초기 메모',
  version: 3,
};

const DELETE_SCOPE = '이 환자의 대화까지 영구 삭제됩니다. 되돌릴 수 없습니다.';

describe('환자 상세 삭제', () => {
  beforeEach(() => replaceMock.mockClear());

  it('환자 삭제 버튼은 확인을 먼저 띄우고, 대화까지 지워지는 범위를 밝힌다', async () => {
    let deleteCalled = false;
    server.use(
      http.get('/api/v1/patients/patient-1', () => HttpResponse.json(envelope(activePatient))),
      http.delete('/api/v1/patients/patient-1', () => {
        deleteCalled = true;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientDetailPanel patientId="patient-1" />);

    await user.click(await screen.findByRole('button', { name: '환자 삭제' }));

    expect(await screen.findByText(DELETE_SCOPE)).toBeTruthy();
    expect(deleteCalled).toBe(false);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('취소하면 삭제하지 않고 상세로 돌아간다', async () => {
    server.use(
      http.get('/api/v1/patients/patient-1', () => HttpResponse.json(envelope(activePatient))),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientDetailPanel patientId="patient-1" />);

    await user.click(await screen.findByRole('button', { name: '환자 삭제' }));
    await user.click(await screen.findByRole('button', { name: '취소' }));

    expect(screen.queryByText(DELETE_SCOPE)).toBeNull();
    expect(screen.getByRole('button', { name: '환자 삭제' })).toBeTruthy();
  });

  it('확인하면 DELETE를 호출하고 환자 목록으로 replace한다', async () => {
    let deleteCalled = false;
    server.use(
      http.get('/api/v1/patients/patient-1', () => HttpResponse.json(envelope(activePatient))),
      http.delete('/api/v1/patients/patient-1', () => {
        deleteCalled = true;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientDetailPanel patientId="patient-1" />);

    await user.click(await screen.findByRole('button', { name: '환자 삭제' }));
    await user.click(await screen.findByRole('button', { name: '삭제' }));

    await waitFor(() => expect(deleteCalled).toBe(true));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/patients'));
    // 삭제된 상세는 404다 — 이동 전에 조회 실패 화면을 그리지 않는다
    expect(screen.queryByText('환자 정보를 불러오지 못했습니다')).toBeNull();
  });
});
