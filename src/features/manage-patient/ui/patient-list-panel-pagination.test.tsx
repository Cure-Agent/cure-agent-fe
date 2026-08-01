// @vitest-environment happy-dom
// 환자 목록 무한 스크롤 — 커서 페이지 누적 (20건 초과 목록이 잘리던 문제의 회귀 방지)
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { PatientListPanel } from './patient-list-panel';

useMswServer();

describe('환자 목록 무한 스크롤', () => {
  it('하단으로 스크롤하면 다음 커서 페이지를 이어 붙이고, 마지막 페이지 뒤엔 더 요청하지 않는다', async () => {
    const cursors: Array<string | null> = [];
    server.use(
      http.get('/api/v1/patients', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        if (!cursor) {
          return HttpResponse.json(
            envelope([{ id: 'patient-1', caseLabel: 'CASE-001', status: 'ACTIVE' }], {
              size: 1,
              hasNext: true,
              nextCursor: 'cursor-1',
            }),
          );
        }
        expect(cursor).toBe('cursor-1');
        return HttpResponse.json(
          envelope([{ id: 'patient-2', caseLabel: 'CASE-002', status: 'ACTIVE' }], {
            size: 1,
            hasNext: false,
            nextCursor: null,
          }),
        );
      }),
    );

    const { container } = renderWithProviders(<PatientListPanel onSelect={vi.fn()} />);

    await screen.findByText('CASE-001');
    expect(screen.queryByText('CASE-002')).toBeNull();

    // happy-dom은 레이아웃 값이 0 → 스크롤 이벤트가 하단 도달로 취급된다
    const scrollArea = container.querySelector('.overflow-y-auto');
    expect(scrollArea).not.toBeNull();
    fireEvent.scroll(scrollArea as Element);

    expect(await screen.findByText('CASE-002')).toBeTruthy();

    // 마지막 페이지 — 추가 스크롤에도 더 요청하지 않는다
    fireEvent.scroll(scrollArea as Element);
    await waitFor(() => expect(cursors).toEqual([null, 'cursor-1']));
  });
});
