// docs/specs/10 수용 기준 10~12 동결 테스트 — 구현 중 수정 금지
// @vitest-environment happy-dom

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  envelope,
  errorEnvelope,
  server,
  useMswServer,
} from '../../../shared/test/msw';
import { renderWithProviders } from '../../../shared/test/render';
import { GuidanceCard } from './guidance-card';

const draftGuidance = {
  id: 'g-1',
  patientId: 'p-1',
  patientProfileSnapshotId: 'snap-1',
  summary: '만성 요통 관리 참고안',
  considerations: [
    {
      title: '요통 지침 — 침치료',
      rationale: '침 치료를 시행할 것을 권고한다',
      citations: [],
    },
  ],
  safetyAlerts: [
    {
      severity: 'WARNING' as const,
      description: '환자에게 페니실린 알레르기 병력이 있습니다.',
      citations: [],
    },
  ],
  missingInformation: ['허리둘레'],
  reviewStatus: 'DRAFT' as const,
  generatedAt: '2026-07-24T10:00:00.000Z',
};

useMswServer();

describe('GuidanceCard', () => {
  it('임상 참고안의 내용과 검토 대기 상태를 렌더링한다', () => {
    renderWithProviders(<GuidanceCard guidance={draftGuidance} />);

    expect(screen.getByText('만성 요통 관리 참고안')).toBeInTheDocument();
    expect(screen.getByText('요통 지침 — 침치료')).toBeInTheDocument();
    expect(
      screen.getByText('침 치료를 시행할 것을 권고한다'),
    ).toBeInTheDocument();
    expect(screen.getByText('WARNING')).toBeInTheDocument();
    expect(
      screen.getByText('환자에게 페니실린 알레르기 병력이 있습니다.'),
    ).toBeInTheDocument();
    expect(screen.getByText('허리둘레')).toBeInTheDocument();
    expect(screen.getByText('검토 대기')).toBeInTheDocument();
  });

  it('수정 의견으로 검토를 확정하고 수정 반영 상태를 렌더링한다', async () => {
    const user = userEvent.setup();
    let requestBody: unknown;

    server.use(
      http.post(
        '/api/v1/clinical-guidance/:guidanceId/reviews',
        async ({ request }) => {
          requestBody = await request.json();

          return HttpResponse.json(
            envelope({
              ...draftGuidance,
              reviewStatus: 'MODIFIED',
            }),
            { status: 200 },
          );
        },
      ),
    );

    renderWithProviders(<GuidanceCard guidance={draftGuidance} />);

    await user.click(screen.getByRole('radio', { name: 'MODIFIED' }));
    await user.type(
      screen.getByLabelText('검토 의견'),
      '용량 조정 필요',
    );
    await user.click(screen.getByRole('button', { name: '검토 확정' }));

    await waitFor(() => {
      expect(requestBody).toEqual({
        decision: 'MODIFIED',
        note: '용량 조정 필요',
      });
    });
    expect(await screen.findByText('수정 반영')).toBeInTheDocument();
  });

  it('이미 검토가 끝난 임상 참고안의 서버 오류 메시지를 렌더링한다', async () => {
    const user = userEvent.setup();

    server.use(
      http.post(
        '/api/v1/clinical-guidance/:guidanceId/reviews',
        () =>
          HttpResponse.json(
            errorEnvelope(
              'GUIDANCE_ALREADY_REVIEWED',
              '이미 검토가 완료된 항목입니다.',
            ),
            { status: 409 },
          ),
      ),
    );

    renderWithProviders(<GuidanceCard guidance={draftGuidance} />);

    await user.click(screen.getByRole('radio', { name: 'MODIFIED' }));
    await user.type(
      screen.getByLabelText('검토 의견'),
      '용량 조정 필요',
    );
    await user.click(screen.getByRole('button', { name: '검토 확정' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '이미 검토가 완료된 항목입니다.',
    );
  });
});
