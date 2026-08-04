// @vitest-environment happy-dom
// 환자 삭제 (BE spec 34) — 그 환자의 대화까지 함께 지워지므로 범위를 밝히고 확인을 받는다
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { CONVERSATIONS_KEY } from '@/features/manage-conversation/api/conversation.api';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { PatientListPanel } from './patient-list-panel';

useMswServer();

const page = { size: 20, hasNext: false, nextCursor: null };

function patient(id: string, caseLabel: string, status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE') {
  return { id, caseLabel, status };
}

const DELETE_SCOPE = '이 환자의 대화까지 영구 삭제됩니다. 되돌릴 수 없습니다.';

describe('환자 목록 삭제 액션', () => {
  it('삭제 버튼은 확인을 먼저 띄우고, 대화까지 지워지는 범위를 밝힌다', async () => {
    let deleteCalled = false;
    server.use(
      http.get('/api/v1/patients', () =>
        HttpResponse.json(envelope([patient('patient-1', 'CASE-001')], page)),
      ),
      http.delete('/api/v1/patients/patient-1', () => {
        deleteCalled = true;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientListPanel onSelect={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'CASE-001 삭제' }));

    expect(await screen.findByText(DELETE_SCOPE)).toBeTruthy();
    expect(deleteCalled).toBe(false);
  });

  it('취소하면 삭제하지 않고 카드로 돌아간다', async () => {
    let deleteCalled = false;
    server.use(
      http.get('/api/v1/patients', () =>
        HttpResponse.json(envelope([patient('patient-1', 'CASE-001')], page)),
      ),
      http.delete('/api/v1/patients/patient-1', () => {
        deleteCalled = true;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientListPanel onSelect={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'CASE-001 삭제' }));
    await user.click(await screen.findByRole('button', { name: '취소' }));

    expect(screen.queryByText(DELETE_SCOPE)).toBeNull();
    expect(await screen.findByRole('button', { name: 'CASE-001' })).toBeTruthy();
    expect(deleteCalled).toBe(false);
  });

  it('확인하면 DELETE를 호출하고 목록에서 사라진다 — 되돌리기 경로는 없다', async () => {
    let deleted = false;
    server.use(
      http.get('/api/v1/patients', () => {
        const items = deleted ? [] : [patient('patient-1', 'CASE-001')];
        return HttpResponse.json(envelope(items, { ...page, size: items.length }));
      }),
      http.delete('/api/v1/patients/patient-1', () => {
        deleted = true;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientListPanel onSelect={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'CASE-001 삭제' }));
    await user.click(await screen.findByRole('button', { name: '삭제' }));

    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'CASE-001' })).toBeNull());
    expect(screen.queryByRole('button', { name: '되돌리기' })).toBeNull();
  });

  it('환자를 지우면 대화 목록 캐시도 낡은 것으로 표시한다 — 서버가 대화까지 끄기 때문', async () => {
    server.use(
      http.get('/api/v1/patients', () =>
        HttpResponse.json(envelope([patient('patient-1', 'CASE-001')], page)),
      ),
      http.delete('/api/v1/patients/patient-1', () => HttpResponse.json(envelope(null))),
    );

    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<PatientListPanel onSelect={vi.fn()} />);
    const conversationListKey = [...CONVERSATIONS_KEY, 'list', { query: null, status: 'ACTIVE' }];
    queryClient.setQueryData(conversationListKey, { pages: [], pageParams: [] });

    await user.click(await screen.findByRole('button', { name: 'CASE-001 삭제' }));
    await user.click(await screen.findByRole('button', { name: '삭제' }));

    await waitFor(() =>
      expect(queryClient.getQueryState(conversationListKey)?.isInvalidated).toBe(true),
    );
  });

  it('보관된 환자도 그대로 삭제된다 — 보관과 삭제는 직교한다', async () => {
    let deleted = false;
    server.use(
      http.get('/api/v1/patients', () => {
        const items = deleted ? [] : [patient('patient-2', 'CASE-002', 'ARCHIVED')];
        return HttpResponse.json(envelope(items, { ...page, size: items.length }));
      }),
      http.delete('/api/v1/patients/patient-2', () => {
        deleted = true;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<PatientListPanel onSelect={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'CASE-002 삭제' }));
    await user.click(await screen.findByRole('button', { name: '삭제' }));

    await waitFor(() => expect(deleted).toBe(true));
  });
});
