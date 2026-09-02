// @vitest-environment happy-dom

import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setUiLang, UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { RequestGuidanceButton } from './request-guidance-button';

useMswServer();

function setLanguageInputs(navigatorLanguage: string, stored: string | null): void {
  stubNavigatorLanguage(navigatorLanguage);
  stubStoredUiLang(UI_LANG_STORAGE_KEY, stored);
}

function mockConversationCreation(captureBody: (body: unknown) => void): void {
  server.use(
    http.post('/api/v1/conversations', async ({ request }) => {
      captureBody(await request.json());
      return HttpResponse.json(
        envelope({
          id: 'conversation-guidance-1',
          type: 'PATIENT_GUIDANCE',
          patientId: 'patient-1',
          title: 'created guidance title',
          status: 'ACTIVE',
          lastMessageAt: '2026-09-02T00:00:00.000Z',
        }),
        { status: 201 },
      );
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('RequestGuidanceButton 생성 제목의 표시 언어 배선', () => {
  it('한국어 화면에서 생성 요청 body에 한국어 환자 맞춤 제목을 싣는다', async () => {
    setLanguageInputs('ko-KR', 'ko');
    const user = userEvent.setup();
    let requestBody: unknown;
    mockConversationCreation((body) => {
      requestBody = body;
    });

    renderWithProviders(
      <RequestGuidanceButton
        patientId="patient-1"
        caseLabel="CASE-001"
        onStarted={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '환자 맞춤 대화 시작' }));

    await waitFor(() => {
      expect(requestBody).toEqual({
        type: 'PATIENT_GUIDANCE',
        patientId: 'patient-1',
        title: expect.stringMatching(/^CASE-001 임상 참고 \(\d+\/\d+ \d+:\d{2}\)$/),
      });
    });
  });

  it('영문 화면에서 생성 요청 body에 한국어 문구가 없는 영문 환자 맞춤 제목을 싣는다', async () => {
    setLanguageInputs('en-US', 'en');
    const user = userEvent.setup();
    let requestBody: unknown;
    mockConversationCreation((body) => {
      requestBody = body;
    });

    renderWithProviders(
      <RequestGuidanceButton
        patientId="patient-1"
        caseLabel="CASE-001"
        onStarted={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Start patient-specific conversation' }),
    );

    await waitFor(() => {
      expect(requestBody).toEqual({
        type: 'PATIENT_GUIDANCE',
        patientId: 'patient-1',
        title: expect.stringMatching(/^CASE-001 Clinical guidance \(\d+\/\d+ \d+:\d{2}\)$/),
      });
      expect((requestBody as { title: string }).title).not.toContain('임상 참고');
    });
  });

  it('한국어로 렌더한 뒤 영어로 바꾸면 mutate 시점의 영어 제목을 전송한다', async () => {
    setLanguageInputs('ko-KR', 'ko');
    const user = userEvent.setup();
    let requestBody: unknown;
    mockConversationCreation((body) => {
      requestBody = body;
    });

    renderWithProviders(
      <RequestGuidanceButton
        patientId="patient-1"
        caseLabel="CASE-001"
        onStarted={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '환자 맞춤 대화 시작' })).toBeInTheDocument();

    act(() => {
      setUiLang('en');
    });
    await user.click(
      await screen.findByRole('button', { name: 'Start patient-specific conversation' }),
    );

    await waitFor(() => {
      expect(requestBody).toEqual({
        type: 'PATIENT_GUIDANCE',
        patientId: 'patient-1',
        title: expect.stringMatching(/^CASE-001 Clinical guidance \(\d+\/\d+ \d+:\d{2}\)$/),
      });
      expect((requestBody as { title: string }).title).not.toContain('임상 참고');
    });
  });
});
