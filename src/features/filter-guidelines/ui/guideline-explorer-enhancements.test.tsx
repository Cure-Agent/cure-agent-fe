// @vitest-environment happy-dom
// 지침 탐색 개선: 커서 페이징 · SUPERSEDED 배지 · 권고문 전문 보기
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type {
  EvidenceDetail,
  EvidenceSummary,
  GuidelineDetail,
  GuidelineSummary,
} from '../api/guideline.api';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { GuidelineDetailPanel } from './guideline-detail-panel';
import { GuidelineListPanel } from './guideline-list-panel';

useMswServer();

function guidelineSummary(id: string, title: string): GuidelineSummary {
  return {
    id,
    title,
    publisher: '한국한의약진흥원',
    currentVersion: '1.0',
    publishedAt: '2025-01-01T00:00:00.000Z',
    status: 'ACTIVE',
  };
}

const baseDetail: GuidelineDetail = {
  id: 'guideline-1',
  title: '요통 한의표준임상진료지침',
  publisher: '한국한의약진흥원',
  currentVersion: '2.0',
  publishedAt: '2026-01-01T00:00:00.000Z',
  status: 'ACTIVE',
  sourceUrl: 'https://example.test/guidelines/guideline-1',
};

const evidenceItem: EvidenceSummary = {
  id: 'evidence-1',
  sectionPath: ['2', '치료', '침치료'],
  recommendationNumber: 'R1',
  excerpt: '만성 요통 환자에게 침 치료를 고려할 수 있다.',
};

describe('지침 목록 커서 페이징', () => {
  it('hasNext면 더 보기 버튼을 노출하고, 클릭 시 cursor로 다음 페이지를 이어 붙인다', async () => {
    const requestedCursors: Array<string | null> = [];
    server.use(
      http.get('/api/v1/guidelines', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        requestedCursors.push(cursor);
        if (cursor === 'cursor-2') {
          return HttpResponse.json(
            envelope([guidelineSummary('g-2', '두 번째 페이지 지침')], {
              size: 1,
              hasNext: false,
              nextCursor: null,
            }),
          );
        }
        return HttpResponse.json(
          envelope([guidelineSummary('g-1', '첫 번째 페이지 지침')], {
            size: 1,
            hasNext: true,
            nextCursor: 'cursor-2',
          }),
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<GuidelineListPanel onSelect={vi.fn()} />);

    expect(await screen.findByRole('button', { name: '첫 번째 페이지 지침' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '더 보기' }));

    // 두 페이지가 모두 표시되고, 더 이상 다음 페이지가 없으면 버튼이 사라진다
    expect(await screen.findByRole('button', { name: '두 번째 페이지 지침' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '첫 번째 페이지 지침' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
    await waitFor(() => expect(requestedCursors).toContain('cursor-2'));
  });
});

describe('지침 상세', () => {
  it('SUPERSEDED 지침이면 구판 배지를 표시한다', async () => {
    server.use(
      http.get('/api/v1/guidelines/guideline-1', () =>
        HttpResponse.json(envelope({ ...baseDetail, status: 'SUPERSEDED' })),
      ),
      http.get('/api/v1/guidelines/guideline-1/evidence', () =>
        HttpResponse.json(envelope([], { size: 0, hasNext: false, nextCursor: null })),
      ),
    );

    renderWithProviders(<GuidelineDetailPanel guidelineId="guideline-1" />);

    expect(await screen.findByText('구판 — 최신 버전 아님')).toBeTruthy();
  });

  it('ACTIVE 지침에는 구판 배지를 표시하지 않는다', async () => {
    server.use(
      http.get('/api/v1/guidelines/guideline-1', () => HttpResponse.json(envelope(baseDetail))),
      http.get('/api/v1/guidelines/guideline-1/evidence', () =>
        HttpResponse.json(envelope([], { size: 0, hasNext: false, nextCursor: null })),
      ),
    );

    renderWithProviders(<GuidelineDetailPanel guidelineId="guideline-1" />);

    expect(await screen.findByText(baseDetail.title)).toBeTruthy();
    expect(screen.queryByText('구판 — 최신 버전 아님')).toBeNull();
  });

  it('권고문 카드를 펼치면 evidence 상세를 조회해 원문 전문을 표시한다', async () => {
    const evidenceDetail: EvidenceDetail = {
      id: 'evidence-1',
      guidelineId: 'guideline-1',
      guidelineVersionId: 'version-1',
      guidelineTitle: baseDetail.title,
      version: '2.0',
      sectionPath: ['2', '치료', '침치료'],
      recommendationNumber: 'R1',
      recommendationText: '만성 요통 환자에게 침 치료를 시행할 것을 권고한다. (전문)',
      excerpt: '만성 요통 환자에게 침 치료를 고려할 수 있다. 발췌 전문입니다.',
      pageStart: 42,
      pageEnd: 43,
      sourceUrl: 'https://example.test/guidelines/guideline-1',
    };
    server.use(
      http.get('/api/v1/guidelines/guideline-1', () => HttpResponse.json(envelope(baseDetail))),
      http.get('/api/v1/guidelines/guideline-1/evidence', () =>
        HttpResponse.json(envelope([evidenceItem], { size: 1, hasNext: false, nextCursor: null })),
      ),
      http.get('/api/v1/evidence/evidence-1', () => HttpResponse.json(envelope(evidenceDetail))),
    );

    const user = userEvent.setup();
    renderWithProviders(<GuidelineDetailPanel guidelineId="guideline-1" />);

    await user.click(await screen.findByRole('button', { name: /전문 보기/ }));

    expect(await screen.findByText(evidenceDetail.recommendationText!)).toBeTruthy();
    expect(screen.getByText(evidenceDetail.excerpt)).toBeTruthy();
    expect(screen.getByText('원문 p.42–43')).toBeTruthy();
  });

  it('evidence 목록도 hasNext면 더 보기로 다음 페이지를 이어 붙인다', async () => {
    const secondPageItem: EvidenceSummary = {
      id: 'evidence-2',
      sectionPath: ['3', '치료', '약침치료'],
      recommendationNumber: 'R2',
      excerpt: '두 번째 페이지 권고문 발췌.',
    };
    server.use(
      http.get('/api/v1/guidelines/guideline-1', () => HttpResponse.json(envelope(baseDetail))),
      http.get('/api/v1/guidelines/guideline-1/evidence', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (cursor === 'ev-cursor-2') {
          return HttpResponse.json(
            envelope([secondPageItem], { size: 1, hasNext: false, nextCursor: null }),
          );
        }
        return HttpResponse.json(
          envelope([evidenceItem], { size: 1, hasNext: true, nextCursor: 'ev-cursor-2' }),
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<GuidelineDetailPanel guidelineId="guideline-1" />);

    expect(await screen.findByText(evidenceItem.excerpt)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '더 보기' }));

    expect(await screen.findByText(secondPageItem.excerpt)).toBeTruthy();
    expect(screen.getByText(evidenceItem.excerpt)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
  });
});
