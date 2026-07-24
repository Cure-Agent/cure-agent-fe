// @vitest-environment happy-dom
// docs/specs/09 수용 기준 11 동결 테스트 — 구현 중 수정 금지
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { PatientCreateForm } from './patient-create-form';

useMswServer();

describe('환자 등록 폼', () => {
  it('기준 11: 쉼표 구분 입력을 배열로 담아 등록하고 onCreated를 호출한다', async () => {
    const createdPatient = {
      id: 'patient-created',
      caseLabel: '김환자',
      status: 'ACTIVE' as const,
      updatedAt: '2026-07-24T00:00:00.000Z',
      diagnoses: ['고혈압', '당뇨'],
      medications: ['약A', '약B'],
      allergies: ['꽃가루', '땅콩'],
      version: 1,
    };
    let receivedBody: unknown;

    server.use(
      http.post('/api/v1/patients', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(envelope(createdPatient), { status: 201 });
      }),
    );

    const onCreated = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<PatientCreateForm onCreated={onCreated} />);

    await user.type(screen.getByLabelText('케이스 라벨'), '김환자');
    await user.type(screen.getByLabelText('진단(쉼표 구분)'), '고혈압,당뇨');
    await user.type(screen.getByLabelText('복용약(쉼표 구분)'), '약A,약B');
    await user.type(screen.getByLabelText('알레르기(쉼표 구분)'), '꽃가루,땅콩');
    await user.click(screen.getByRole('button', { name: '등록' }));

    await waitFor(() =>
      expect(receivedBody).toEqual(
        expect.objectContaining({
          caseLabel: '김환자',
          diagnoses: ['고혈압', '당뇨'],
          medications: ['약A', '약B'],
          allergies: ['꽃가루', '땅콩'],
        }),
      ),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });
});
