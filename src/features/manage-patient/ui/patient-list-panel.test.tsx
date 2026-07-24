// @vitest-environment happy-dom
// docs/specs/09 수용 기준 10 동결 테스트 — 구현 중 수정 금지
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { PatientListPanel } from './patient-list-panel';

useMswServer();

describe('환자 목록', () => {
  it('기준 10: caseLabel을 렌더하고 검색 제출 시 query 파라미터로 재조회한다', async () => {
    const initialPatient = {
      id: 'patient-initial',
      caseLabel: '초기 환자',
      status: 'ACTIVE' as const,
      updatedAt: '2026-07-01T00:00:00.000Z',
    };
    const searchedPatient = {
      id: 'patient-searched',
      caseLabel: '김환자',
      status: 'ACTIVE' as const,
      updatedAt: '2026-07-02T00:00:00.000Z',
    };
    const requestedQueries: Array<string | null> = [];

    server.use(
      http.get('/api/v1/patients', ({ request }) => {
        const query = new URL(request.url).searchParams.get('query');
        requestedQueries.push(query);
        const items = query === '김환자' ? [searchedPatient] : [initialPatient];

        return HttpResponse.json(
          envelope(items, {
            size: items.length,
            hasNext: false,
            nextCursor: null,
          }),
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientListPanel onSelect={vi.fn()} />);

    expect(
      await screen.findByRole('button', { name: initialPatient.caseLabel }),
    ).toBeTruthy();

    await user.type(screen.getByLabelText('환자 검색'), '김환자');
    await user.click(screen.getByRole('button', { name: '검색' }));

    expect(
      await screen.findByRole('button', { name: searchedPatient.caseLabel }),
    ).toBeTruthy();
    await waitFor(() => expect(requestedQueries).toContain('김환자'));
  });
});
