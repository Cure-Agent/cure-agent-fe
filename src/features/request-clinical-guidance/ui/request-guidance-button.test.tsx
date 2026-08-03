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
            title: 'CASE-001 임상 참고 (8/4 14:30)',
            lastMessagePreview: null,
          }),
          { status: 201 },
        );
      }),
    );

    renderWithProviders(
      <RequestGuidanceButton patientId="p-1" caseLabel="CASE-001" onStarted={onStarted} />,
    );

    await user.click(
      screen.getByRole('button', { name: '환자 맞춤 대화 시작' }),
    );

    // 제목까지 생성 요청이 싣는다 — 첫 질의가 없어 서버 자동 제목이 걸리지 않기 때문이다.
    // 실제 시각으로 단언하면 분 경계에서 깨지므로 여기서는 형태만 본다.
    // 값 자체는 guidance-title 테스트가 고정 날짜로 검증한다.
    await waitFor(() => {
      expect(requestBody).toEqual({
        type: 'PATIENT_GUIDANCE',
        patientId: 'p-1',
        title: expect.stringMatching(/^CASE-001 임상 참고 \(\d+\/\d+ \d+:\d{2}\)$/),
      });
    });
    await waitFor(() => {
      expect(onStarted).toHaveBeenCalledWith('conv-guid-1');
    });
  });
});
