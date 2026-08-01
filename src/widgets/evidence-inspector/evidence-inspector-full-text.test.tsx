// @vitest-environment happy-dom
// 명시 마커 렌더 + 전문 보기 — 저장된 인용 복원 경로와 근거 전문 조회를 검증한다
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { EvidenceInspector, type EvidenceItem } from './evidence-inspector';

useMswServer();

// 저장된 인용에서 변환된 항목 — 마커가 명시돼 있고 연속적이지 않을 수 있다
const citationItems: EvidenceItem[] = [
  {
    id: 'ev-1',
    marker: 1,
    guidelineTitle: '요통 한의표준임상진료지침',
    version: '2.0',
    sectionPath: ['치료', '침치료'],
    excerpt: '침 치료를 고려할 수 있다.',
  },
  {
    id: 'ev-3',
    marker: 3,
    guidelineTitle: '불면장애 한의표준임상진료지침',
    version: '1.0',
    sectionPath: ['권고'],
    excerpt: '환자 상태에 따라 치료를 선택한다.',
  },
];

describe('EvidenceInspector 명시 마커·전문', () => {
  it('marker 필드가 있으면 배열 순서 대신 그 번호를 렌더하고 강조에도 쓴다', () => {
    const { container } = renderWithProviders(
      <EvidenceInspector
        evidence={citationItems}
        activeMarker={3}
        onSelectMarker={vi.fn()}
      />,
    );

    expect(screen.getByText('[3]')).toBeTruthy();
    expect(screen.queryByText('[2]')).toBeNull();
    const activeItem = container.querySelector('[aria-current="true"]');
    expect(activeItem?.textContent).toContain('불면장애 한의표준임상진료지침');
  });

  it('전문 보기를 누르면 근거 전문을 조회해 펼친다', async () => {
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
            pageStart: 42,
            pageEnd: 43,
            sourceUrl: 'https://example.test/guidelines/g-1',
          }),
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(
      <EvidenceInspector
        evidence={[citationItems[0]]}
        activeMarker={null}
        onSelectMarker={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '전문 보기' }));

    expect(await screen.findByText('권고문 원문')).toBeTruthy();
    expect(
      screen.getByText('만성 요통 환자에게 침 치료를 시행할 것을 권고한다.'),
    ).toBeTruthy();
    expect(screen.getByText('침 치료는 만성 요통의 통증 감소에 효과적이다.')).toBeTruthy();
    expect(screen.getByText(/원문 p\.42–43/)).toBeTruthy();
  });
});
