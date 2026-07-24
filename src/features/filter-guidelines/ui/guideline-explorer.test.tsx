// @vitest-environment happy-dom
// docs/specs/08 수용 기준 10 동결 테스트 — 구현 중 수정 금지
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type {
  EvidenceSummary,
  GuidelineDetail,
  GuidelineSummary,
} from '../api/guideline.api';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { GuidelineDetailPanel } from './guideline-detail-panel';
import { GuidelineListPanel } from './guideline-list-panel';

useMswServer();

describe('지침 탐색', () => {
  it('기준 10: 검색어 제출 시 query 파라미터로 목록을 재조회한다', async () => {
    const initialGuidelines: GuidelineSummary[] = [
      {
        id: 'guideline-initial',
        title: '초기 임상진료지침',
        publisher: '한국한의약진흥원',
        currentVersion: '1.0',
        publishedAt: '2025-01-01T00:00:00.000Z',
        status: 'ACTIVE',
      },
    ];
    const searchedGuidelines: GuidelineSummary[] = [
      {
        id: 'guideline-low-back-pain',
        title: '요통 한의표준임상진료지침',
        publisher: '한국한의약진흥원',
        currentVersion: '2.0',
        publishedAt: '2026-01-01T00:00:00.000Z',
        status: 'ACTIVE',
      },
    ];
    const requestedQueries: Array<string | null> = [];

    server.use(
      http.get('/api/v1/guidelines', ({ request }) => {
        const query = new URL(request.url).searchParams.get('query');
        requestedQueries.push(query);
        const items = query === '요통' ? searchedGuidelines : initialGuidelines;

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
    renderWithProviders(<GuidelineListPanel onSelect={vi.fn()} />);

    expect(
      await screen.findByRole('button', { name: initialGuidelines[0].title }),
    ).toBeTruthy();

    await user.type(screen.getByLabelText('지침 검색'), '요통');
    await user.click(screen.getByRole('button', { name: '검색' }));

    expect(
      await screen.findByRole('button', { name: searchedGuidelines[0].title }),
    ).toBeTruthy();
    await waitFor(() => expect(requestedQueries).toContain('요통'));
  });

  it('기준 10: 상세 패널에서 지침의 evidence 목록을 렌더한다', async () => {
    const guideline: GuidelineDetail = {
      id: 'guideline-1',
      title: '요통 한의표준임상진료지침',
      publisher: '한국한의약진흥원',
      currentVersion: '2.0',
      publishedAt: '2026-01-01T00:00:00.000Z',
      status: 'ACTIVE',
      sourceUrl: 'https://example.test/guidelines/guideline-1',
    };
    const evidence: EvidenceSummary[] = [
      {
        id: 'evidence-1',
        sectionPath: ['2', '치료', '침치료'],
        recommendationNumber: 'R1',
        excerpt: '만성 요통 환자에게 침 치료를 고려할 수 있다.',
      },
      {
        id: 'evidence-2',
        sectionPath: ['3', '치료', '약침치료'],
        recommendationNumber: 'R2',
        excerpt: '환자 상태를 평가한 뒤 치료 방법을 선택한다.',
      },
    ];

    server.use(
      http.get('/api/v1/guidelines/guideline-1', () =>
        HttpResponse.json(envelope(guideline)),
      ),
      http.get('/api/v1/guidelines/guideline-1/evidence', () =>
        HttpResponse.json(
          envelope(evidence, {
            size: evidence.length,
            hasNext: false,
            nextCursor: null,
          }),
        ),
      ),
    );

    renderWithProviders(<GuidelineDetailPanel guidelineId="guideline-1" />);

    expect(await screen.findByText(guideline.title)).toBeTruthy();
    expect(await screen.findByText(evidence[0].excerpt)).toBeTruthy();
    expect(await screen.findByText(evidence[1].excerpt)).toBeTruthy();
  });
});
