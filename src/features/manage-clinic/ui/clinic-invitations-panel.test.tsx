// @vitest-environment happy-dom
// 초대 관리 (BE spec 35) — 발급 응답의 token이 링크를 볼 수 있는 유일한 기회다
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { ClinicInvitationsPanel } from './clinic-invitations-panel';

useMswServer();

const emptyList = http.get('/api/v1/clinic/invitations', () =>
  HttpResponse.json(envelope([], { size: 20, hasNext: false, nextCursor: null })),
);

const PENDING = {
  id: 'inv-1',
  status: 'PENDING' as const,
  expiresAt: '2026-08-12T00:00:00Z',
  acceptedAt: null,
  acceptedByDisplayName: null,
  createdAt: '2026-08-05T00:00:00Z',
};

const ACCEPTED = {
  id: 'inv-2',
  status: 'ACCEPTED' as const,
  expiresAt: '2026-08-10T00:00:00Z',
  acceptedAt: '2026-08-06T00:00:00Z',
  acceptedByDisplayName: '이한의',
  createdAt: '2026-08-03T00:00:00Z',
};

describe('초대 관리', () => {
  it('발급하면 전달할 링크를 즉시 보여주고 다시 볼 수 없음을 알린다', async () => {
    server.use(
      emptyList,
      http.post('/api/v1/clinic/invitations', () =>
        HttpResponse.json(
          envelope({
            id: 'inv-1',
            status: 'PENDING',
            expiresAt: '2026-08-12T00:00:00Z',
            acceptedAt: null,
            acceptedByDisplayName: null,
            createdAt: '2026-08-05T00:00:00Z',
            token: 'inv-1.secret',
          }),
          { status: 201 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<ClinicInvitationsPanel />);

    await user.click(screen.getByRole('button', { name: '초대 링크 만들기' }));

    const link = (await screen.findByLabelText('초대 링크')) as HTMLInputElement;
    expect(link.value).toContain('/invite/inv-1.secret');
    // 해시만 저장하므로 재열람 API가 없다 — 화면이 그 사실을 밝혀야 한다
    expect(screen.getByText(/화면을 벗어나면 다시 볼 수 없어/)).toBeVisible();
  });

  it('보낸 초대의 상태를 구분해 보여준다', async () => {
    server.use(
      http.get('/api/v1/clinic/invitations', () =>
        HttpResponse.json(
          envelope([PENDING, ACCEPTED], { size: 20, hasNext: false, nextCursor: null }),
        ),
      ),
    );

    renderWithProviders(<ClinicInvitationsPanel />);

    expect(await screen.findByText('대기 중')).toBeVisible();
    expect(screen.getByText('합류함')).toBeVisible();
    expect(screen.getByText(/이한의 합류/)).toBeVisible();
  });

  it('아직 쓰이지 않은 초대만 취소할 수 있다', async () => {
    let revokedId: string | null = null;
    server.use(
      http.get('/api/v1/clinic/invitations', () =>
        HttpResponse.json(
          envelope([PENDING, ACCEPTED], { size: 20, hasNext: false, nextCursor: null }),
        ),
      ),
      http.delete('/api/v1/clinic/invitations/:invitationId', ({ params }) => {
        revokedId = params.invitationId as string;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<ClinicInvitationsPanel />);

    const revokeButtons = await screen.findAllByRole('button', { name: '취소' });
    expect(revokeButtons).toHaveLength(1);

    await user.click(revokeButtons[0]);

    await waitFor(() => expect(revokedId).toBe('inv-1'));
  });
});
