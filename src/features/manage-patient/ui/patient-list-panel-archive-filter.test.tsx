// @vitest-environment happy-dom
// 보관 필터 — 기본은 status=ACTIVE, "보관된 환자 포함" 토글 시 status 없이 전체 조회
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { PatientListPanel } from './patient-list-panel';

useMswServer();

const activePatient = {
  id: 'patient-active',
  caseLabel: '활성 환자',
  status: 'ACTIVE' as const,
  updatedAt: '2026-07-01T00:00:00.000Z',
};
const archivedPatient = {
  id: 'patient-archived',
  caseLabel: '보관 환자',
  status: 'ARCHIVED' as const,
  updatedAt: '2026-07-02T00:00:00.000Z',
};

describe('환자 목록 보관 필터', () => {
  it('기본은 status=ACTIVE로 조회하고, 보관 포함 체크 시 status 없이 재조회한다', async () => {
    const requestedStatuses: Array<string | null> = [];

    server.use(
      http.get('/api/v1/patients', ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        requestedStatuses.push(status);
        const items =
          status === 'ACTIVE' ? [activePatient] : [activePatient, archivedPatient];

        return HttpResponse.json(
          envelope(items, { size: items.length, hasNext: false, nextCursor: null }),
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientListPanel onSelect={vi.fn()} />);

    expect(
      await screen.findByRole('button', { name: activePatient.caseLabel }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: archivedPatient.caseLabel })).toBeNull();
    expect(requestedStatuses).toContain('ACTIVE');

    await user.click(screen.getByLabelText('보관된 환자 포함'));

    expect(
      await screen.findByRole('button', { name: archivedPatient.caseLabel }),
    ).toBeTruthy();
    await waitFor(() => expect(requestedStatuses).toContain(null));
  });
});
