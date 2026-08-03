// @vitest-environment happy-dom
// 목록 행에서 바로 보관 — 상세 패널에 들어가지 않고 정리한다 / 보관 직후 되돌리기
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { PatientListPanel } from './patient-list-panel';

useMswServer();

const page = { size: 20, hasNext: false, nextCursor: null };

function patient(id: string, caseLabel: string, status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE') {
  return { id, caseLabel, status };
}

describe('환자 목록 보관 액션', () => {
  it('행의 보관 버튼으로 archive를 호출하고, 사라진 행을 되돌리기로 복구한다', async () => {
    let status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE';
    let unarchiveCalled = false;

    server.use(
      http.get('/api/v1/patients', ({ request }) => {
        const requested = new URL(request.url).searchParams.get('status');
        // 활성 필터에서 보관되면 목록에서 빠진다
        const items =
          requested === 'ACTIVE' && status === 'ARCHIVED'
            ? []
            : [patient('patient-1', 'CASE-001', status)];
        return HttpResponse.json(envelope(items, { ...page, size: items.length }));
      }),
      http.post('/api/v1/patients/patient-1/archive', () => {
        status = 'ARCHIVED';
        return HttpResponse.json(envelope(null));
      }),
      http.post('/api/v1/patients/patient-1/unarchive', () => {
        unarchiveCalled = true;
        status = 'ACTIVE';
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientListPanel onSelect={vi.fn()} />);

    // 기본 전체 필터에서 활성 필터로 좁혀야 보관 시 행이 사라지는 경로를 탄다
    await user.click(await screen.findByRole('button', { name: '활성' }));
    await user.click(await screen.findByRole('button', { name: 'CASE-001 보관' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'CASE-001' })).toBeNull());

    await user.click(await screen.findByRole('button', { name: '되돌리기' }));

    await waitFor(() => expect(unarchiveCalled).toBe(true));
    expect(await screen.findByRole('button', { name: 'CASE-001' })).toBeTruthy();
  });

  it('보관된 행은 보관 해제 버튼을 노출한다', async () => {
    let unarchiveCalled = false;

    server.use(
      http.get('/api/v1/patients', () =>
        HttpResponse.json(envelope([patient('patient-2', 'CASE-002', 'ARCHIVED')], page)),
      ),
      http.post('/api/v1/patients/patient-2/unarchive', () => {
        unarchiveCalled = true;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientListPanel onSelect={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'CASE-002 보관 해제' }));

    await waitFor(() => expect(unarchiveCalled).toBe(true));
  });

  it('보관 버튼을 눌러도 행 선택(상세 이동)은 일어나지 않는다', async () => {
    const onSelect = vi.fn();

    server.use(
      http.get('/api/v1/patients', () =>
        HttpResponse.json(envelope([patient('patient-3', 'CASE-003')], page)),
      ),
      http.post('/api/v1/patients/patient-3/archive', () =>
        HttpResponse.json(envelope(null)),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientListPanel onSelect={onSelect} />);

    await user.click(await screen.findByRole('button', { name: 'CASE-003 보관' }));

    await screen.findByRole('button', { name: '되돌리기' });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
