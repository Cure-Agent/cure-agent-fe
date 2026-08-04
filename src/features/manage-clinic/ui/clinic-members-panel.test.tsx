// @vitest-environment happy-dom
// 구성원 목록과 개설자 이양 (BE spec 35·36) — 목록은 전원, 이양은 개설자 전용이다
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { envelope, errorEnvelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { ClinicMembersPanel } from './clinic-members-panel';

useMswServer();

const OWNER = { id: 'me', displayName: '김한의', isOwner: true, joinedAt: '2026-07-01T00:00:00Z' };
const COLLEAGUE = {
  id: 'colleague',
  displayName: '이한의',
  isOwner: false,
  joinedAt: '2026-07-20T00:00:00Z',
};

const membersHandler = (members: unknown[]) =>
  http.get('/api/v1/clinic/members', () => HttpResponse.json(envelope(members)));

const TRANSFER_BUTTON = '개설자 권한 넘기기';

describe('구성원 목록', () => {
  it('동료를 개설자 배지와 합류일과 함께 보여준다', async () => {
    server.use(membersHandler([OWNER, COLLEAGUE]));

    renderWithProviders(<ClinicMembersPanel meId="me" />);

    expect(await screen.findByText('김한의')).toBeVisible();
    expect(screen.getByText('이한의')).toBeVisible();
    expect(screen.getByText('개설자')).toBeVisible();
    expect(screen.getByText('나')).toBeVisible();
  });
});

describe('개설자 이양', () => {
  it('개설자가 아니면 이양 진입점을 두지 않는다', async () => {
    server.use(membersHandler([{ ...OWNER, isOwner: false }, { ...COLLEAGUE, isOwner: true }]));

    renderWithProviders(<ClinicMembersPanel meId="me" />);

    await screen.findByText('이한의');
    expect(screen.queryByRole('button', { name: TRANSFER_BUTTON })).toBeNull();
  });

  it('넘길 상대가 없는 1인 클리닉에서도 진입점을 두지 않는다', async () => {
    server.use(membersHandler([OWNER]));

    renderWithProviders(<ClinicMembersPanel meId="me" />);

    await screen.findByText('김한의');
    expect(screen.queryByRole('button', { name: TRANSFER_BUTTON })).toBeNull();
  });

  it('탈퇴하지 않고도 권한만 넘길 수 있다', async () => {
    let transferredTo: string | null = null;
    server.use(
      membersHandler([OWNER, COLLEAGUE]),
      http.post('/api/v1/clinic/owner/transfer', async ({ request }) => {
        const body = (await request.json()) as { toClinicianId: string };
        transferredTo = body.toClinicianId;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<ClinicMembersPanel meId="me" />);

    await user.click(await screen.findByRole('button', { name: TRANSFER_BUTTON }));
    await user.click(await screen.findByRole('radio', { name: /이한의/ }));
    await user.click(screen.getByRole('button', { name: '권한 넘기기' }));

    await waitFor(() => expect(transferredTo).toBe('colleague'));
    expect(await screen.findByText(/이한의님에게 개설자 권한을 넘겼습니다/)).toBeVisible();
  });

  it('자기 자신은 이양 대상이 아니다', async () => {
    server.use(membersHandler([OWNER, COLLEAGUE]));

    const user = userEvent.setup();
    renderWithProviders(<ClinicMembersPanel meId="me" />);

    await user.click(await screen.findByRole('button', { name: TRANSFER_BUTTON }));

    expect(await screen.findByRole('radio', { name: /이한의/ })).toBeVisible();
    expect(screen.queryByRole('radio', { name: /김한의/ })).toBeNull();
  });

  it('상대를 고르기 전에는 넘길 수 없다', async () => {
    server.use(membersHandler([OWNER, COLLEAGUE]));

    const user = userEvent.setup();
    renderWithProviders(<ClinicMembersPanel meId="me" />);

    await user.click(await screen.findByRole('button', { name: TRANSFER_BUTTON }));

    expect(await screen.findByRole('button', { name: '권한 넘기기' })).toBeDisabled();
  });

  it('실패하면 서버 문구를 보여주고 성공으로 넘어가지 않는다', async () => {
    server.use(
      membersHandler([OWNER, COLLEAGUE]),
      http.post('/api/v1/clinic/owner/transfer', () =>
        HttpResponse.json(errorEnvelope('NOT_FOUND', '대상을 찾을 수 없습니다.'), { status: 404 }),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<ClinicMembersPanel meId="me" />);

    await user.click(await screen.findByRole('button', { name: TRANSFER_BUTTON }));
    await user.click(await screen.findByRole('radio', { name: /이한의/ }));
    await user.click(screen.getByRole('button', { name: '권한 넘기기' }));

    expect(await screen.findByText('대상을 찾을 수 없습니다.')).toBeVisible();
    expect(screen.queryByText(/권한을 넘겼습니다/)).toBeNull();
  });
});
