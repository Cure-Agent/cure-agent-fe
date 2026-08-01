// @vitest-environment happy-dom
// 임상 참고안 인용 근거 — 검토 항목·안전 경고의 [n] 클릭 시 근거 전문을 펼친다
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ClinicalGuidance } from '../api/review-clinical-guidance';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { GuidanceCard } from './guidance-card';

useMswServer();

const citation = {
  marker: 1,
  evidenceId: 'ev-1',
  guidelineTitle: '요통 한의표준임상진료지침',
  guidelineVersion: '2.0',
  sectionPath: ['치료', '침치료'],
  quote: '침 치료를 고려할 수 있다.',
  sourceUrl: 'https://example.test/guidelines/g-1',
};

const guidance: ClinicalGuidance = {
  id: 'guid-1',
  patientId: 'p-1',
  patientProfileSnapshotId: 'snap-1',
  summary: '침 치료 병행을 고려할 수 있습니다.',
  considerations: [
    {
      title: '침 치료 병행',
      rationale: '만성 요통에 침 치료 권고 근거가 있습니다.',
      citations: [citation],
    },
  ],
  safetyAlerts: [
    {
      severity: 'WARNING',
      description: '항응고제 복용 중 자락요법은 주의가 필요합니다.',
      citations: [{ ...citation, marker: 2, evidenceId: 'ev-2' }],
    },
  ],
  missingInformation: [],
  reviewStatus: 'ACCEPTED',
  generatedAt: '2026-07-24T10:00:00.000Z',
};

describe('GuidanceCard 인용 근거 전문', () => {
  it('검토 항목의 [n] 클릭 시 근거 전문을 펼친다', async () => {
    server.use(
      http.get('/api/v1/evidence/ev-1', () =>
        HttpResponse.json(
          envelope({
            id: 'ev-1',
            guidelineId: 'g-1',
            guidelineVersionId: 'gv-1',
            guidelineTitle: '요통 한의표준임상진료지침',
            version: '2.0',
            sectionPath: ['치료', '침치료'],
            recommendationText: '만성 요통 환자에게 침 치료를 시행할 것을 권고한다.',
            excerpt: '침 치료는 만성 요통의 통증 감소에 효과적이다.',
            sourceUrl: 'https://example.test/guidelines/g-1',
          }),
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<GuidanceCard guidance={guidance} />);

    await user.click(screen.getByRole('button', { name: '[1]' }));

    expect(await screen.findByText('권고문 원문')).toBeTruthy();
    expect(
      screen.getByText('만성 요통 환자에게 침 치료를 시행할 것을 권고한다.'),
    ).toBeTruthy();

    // 다시 클릭하면 접힌다
    await user.click(screen.getByRole('button', { name: '[1]' }));
    expect(screen.queryByText('권고문 원문')).toBeNull();
  });

  it('안전 경고의 인용 칩도 렌더된다', () => {
    renderWithProviders(<GuidanceCard guidance={guidance} />);
    expect(screen.getByRole('button', { name: '[2]' })).toBeTruthy();
  });
});
