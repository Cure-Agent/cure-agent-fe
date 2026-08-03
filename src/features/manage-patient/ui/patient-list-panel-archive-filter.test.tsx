// @vitest-environment happy-dom
// 보관 상태 필터 — 기본은 status 없이 전체, 「활성 | 보관됨」 세그먼트 선택 시 해당 status로 재조회
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
};
const archivedPatient = {
  id: 'patient-archived',
  caseLabel: '보관 환자',
  status: 'ARCHIVED' as const,
};

describe('환자 목록 보관 상태 필터', () => {
  it('기본은 status 없이 전체를 조회하고, 세그먼트 선택 시 해당 status로 재조회한다', async () => {
    const requestedStatuses: Array<string | null> = [];

    server.use(
      http.get('/api/v1/patients', ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        requestedStatuses.push(status);
        const items =
          status === 'ACTIVE'
            ? [activePatient]
            : status === 'ARCHIVED'
              ? [archivedPatient]
              : [activePatient, archivedPatient];

        return HttpResponse.json(
          envelope(items, { size: items.length, hasNext: false, nextCursor: null }),
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientListPanel onSelect={vi.fn()} />);

    // 기본 전체: 활성·보관 환자가 모두 보인다
    expect(
      await screen.findByRole('button', { name: activePatient.caseLabel }),
    ).toBeTruthy();
    expect(
      await screen.findByRole('button', { name: archivedPatient.caseLabel }),
    ).toBeTruthy();
    expect(requestedStatuses).toContain(null);

    // 보관 선택 → status=ARCHIVED 재조회, 활성 환자가 사라진다
    await user.click(screen.getByRole('button', { name: '보관됨' }));
    await waitFor(() => expect(requestedStatuses).toContain('ARCHIVED'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: activePatient.caseLabel })).toBeNull(),
    );

    // 활성 선택 → status=ACTIVE 재조회, 보관 환자가 사라진다
    await user.click(screen.getByRole('button', { name: '활성' }));
    await waitFor(() => expect(requestedStatuses).toContain('ACTIVE'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: archivedPatient.caseLabel })).toBeNull(),
    );
  });
});
