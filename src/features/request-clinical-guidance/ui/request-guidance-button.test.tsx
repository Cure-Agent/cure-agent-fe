// docs/specs/10 수용 기준 9 동결 테스트 — 구현 중 수정 금지
// @vitest-environment happy-dom

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import {
  envelope,
  server,
  useMswServer,
} from '../../../shared/test/msw';
import { renderWithProviders } from '../../../shared/test/render';
import { RequestGuidanceButton } from './request-guidance-button';

useMswServer();

describe('RequestGuidanceButton', () => {
  it('환자 임상 참고 대화를 생성하고 생성된 대화 id를 전달한다', async () => {
    const user = userEvent.setup();
    const onStarted = vi.fn();
    let requestBody: unknown;

    server.use(
      http.post('/api/v1/conversations', async ({ request }) => {
        requestBody = await request.json();

        return HttpResponse.json(
          envelope({
            id: 'conv-guid-1',
            type: 'PATIENT_GUIDANCE',
            patientId: 'p-1',
            title: '새 대화',
            lastMessagePreview: null,
            updatedAt: '2026-07-24T10:00:00.000Z',
          }),
          { status: 201 },
        );
      }),
    );

    renderWithProviders(
      <RequestGuidanceButton patientId="p-1" onStarted={onStarted} />,
    );

    await user.click(
      screen.getByRole('button', { name: '임상 참고 대화 시작' }),
    );

    await waitFor(() => {
      expect(requestBody).toEqual({
        type: 'PATIENT_GUIDANCE',
        patientId: 'p-1',
      });
    });
    await waitFor(() => {
      expect(onStarted).toHaveBeenCalledWith('conv-guid-1');
    });
  });
});
