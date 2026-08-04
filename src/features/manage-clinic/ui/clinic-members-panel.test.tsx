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
/** 진입점의 이름이다 — 확인 패널의 실행 버튼은 대상 이름을 담아 「이한의님 내보내기」가 된다 */
const REMOVE_BUTTON = '내보내기';

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

describe('구성원 내보내기', () => {
  it('개설자가 아니면 내보내기 진입점을 두지 않는다', async () => {
    server.use(membersHandler([{ ...OWNER, isOwner: false }, { ...COLLEAGUE, isOwner: true }]));

    renderWithProviders(<ClinicMembersPanel meId="me" />);

    await screen.findByText('이한의');
    expect(screen.queryByRole('button', { name: REMOVE_BUTTON })).toBeNull();
  });

  it('자기 자신 행에는 내보내기를 두지 않는다', async () => {
    server.use(membersHandler([OWNER, COLLEAGUE]));

    renderWithProviders(<ClinicMembersPanel meId="me" />);

    await screen.findByText('이한의');
    // 내보낼 수 있는 것은 동료 한 명뿐이다 — 개설자 자신은 서버가 409로 막는다 (spec 38)
    expect(screen.getAllByRole('button', { name: REMOVE_BUTTON })).toHaveLength(1);
  });

  it('확인을 거치지 않으면 내보내지 않는다', async () => {
    let called = false;
    server.use(
      membersHandler([OWNER, COLLEAGUE]),
      http.delete('/api/v1/clinic/members/:clinicianId', () => {
        called = true;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<ClinicMembersPanel meId="me" />);

    await user.click(await screen.findByRole('button', { name: REMOVE_BUTTON }));
    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(called).toBe(false);
    expect(screen.queryByText(/내보냅니다/)).toBeNull();
  });

  it('계정이 남는다는 것과 초대 링크가 함께 취소된다는 것을 확인 단계에서 알린다', async () => {
    server.use(membersHandler([OWNER, COLLEAGUE]));

    const user = userEvent.setup();
    renderWithProviders(<ClinicMembersPanel meId="me" />);

    await user.click(await screen.findByRole('button', { name: REMOVE_BUTTON }));

    // 계정 삭제로 오해하면 되돌릴 수 없는 결정으로 착각한다 — 강퇴는 tombstone이 아니다
    expect(await screen.findByText(/이름·이메일·면허번호는 그대로 남습니다/)).toBeVisible();
    // 서버가 함께 처분하는 것이라 화면이 말하지 않으면 알 길이 없다 (spec 38 §5.8)
    expect(screen.getByText(/발급한 미사용 초대 링크가 함께 취소됩니다/)).toBeVisible();
  });

  it('확인하면 그 구성원을 내보내고 돌아올 길을 안내한다', async () => {
    let removedId: string | null = null;
    server.use(
      membersHandler([OWNER, COLLEAGUE]),
      http.delete('/api/v1/clinic/members/:clinicianId', ({ params }) => {
        removedId = params.clinicianId as string;
        return HttpResponse.json(envelope(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<ClinicMembersPanel meId="me" />);

    await user.click(await screen.findByRole('button', { name: REMOVE_BUTTON }));
    await user.click(screen.getByRole('button', { name: '이한의님 내보내기' }));

    await waitFor(() => expect(removedId).toBe('colleague'));
    // 행이 목록에서 사라지므로 무슨 일이 일어났는지는 배너만이 말해준다
    expect(await screen.findByText(/이한의님을 내보냈습니다/)).toBeVisible();
  });

  it('실패하면 서버 문구를 보여주고 내보냈다고 말하지 않는다', async () => {
    server.use(
      membersHandler([OWNER, COLLEAGUE]),
      http.delete('/api/v1/clinic/members/:clinicianId', () =>
        HttpResponse.json(errorEnvelope('NOT_FOUND', '대상을 찾을 수 없습니다.'), { status: 404 }),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<ClinicMembersPanel meId="me" />);

    await user.click(await screen.findByRole('button', { name: REMOVE_BUTTON }));
    await user.click(screen.getByRole('button', { name: '이한의님 내보내기' }));

    expect(await screen.findByText('대상을 찾을 수 없습니다.')).toBeVisible();
    expect(screen.queryByText(/내보냈습니다/)).toBeNull();
  });

  it('이양 확인과 내보내기 확인이 함께 열리지 않는다', async () => {
    server.use(membersHandler([OWNER, COLLEAGUE]));

    const user = userEvent.setup();
    renderWithProviders(<ClinicMembersPanel meId="me" />);

    await user.click(await screen.findByRole('button', { name: TRANSFER_BUTTON }));
    await user.click(screen.getByRole('button', { name: REMOVE_BUTTON }));

    // 무엇을 승인하는 중인지 흐려지면 안 된다
    expect(await screen.findByText(/내보냅니다/)).toBeVisible();
    expect(screen.queryByRole('radio')).toBeNull();
  });
});
