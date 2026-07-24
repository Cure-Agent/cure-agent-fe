// @vitest-environment happy-dom
// docs/specs/08 수용 기준 9 동결 테스트 — 구현 중 수정 금지
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EvidenceInspector, type EvidenceItem } from './evidence-inspector';

describe('EvidenceInspector', () => {
  it('기준 9: 근거 목록과 활성 marker를 렌더하고 marker 선택을 알린다', async () => {
    const evidence: EvidenceItem[] = [
      {
        id: 'evidence-1',
        guidelineId: 'guideline-1',
        guidelineVersionId: 'guideline-version-1',
        guidelineTitle: '요통 한의표준임상진료지침',
        version: '1.0',
        sectionPath: ['2', '치료', '침치료'],
        excerpt: '침 치료를 고려할 수 있다.',
        sourceUrl: 'https://example.test/guidelines/guideline-1',
      },
      {
        id: 'evidence-2',
        guidelineId: 'guideline-2',
        guidelineVersionId: 'guideline-version-2',
        guidelineTitle: '불면장애 한의표준임상진료지침',
        version: '2.0',
        sectionPath: ['3', '권고'],
        excerpt: '환자 상태에 따라 치료를 선택한다.',
        sourceUrl: 'https://example.test/guidelines/guideline-2',
      },
    ];
    const onSelectMarker = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <EvidenceInspector
        evidence={evidence}
        activeMarker={2}
        onSelectMarker={onSelectMarker}
      />,
    );

    expect(screen.getByText(evidence[0].guidelineTitle)).toBeTruthy();
    expect(screen.getByText(evidence[0].excerpt)).toBeTruthy();
    expect(screen.getByText(evidence[1].guidelineTitle)).toBeTruthy();
    expect(screen.getByText(evidence[1].excerpt)).toBeTruthy();

    const activeItem = container.querySelector('[aria-current="true"]');
    expect(activeItem).not.toBeNull();
    expect(activeItem?.textContent).toContain(evidence[1].guidelineTitle);

    await user.click(screen.getByText('[1]'));
    expect(onSelectMarker).toHaveBeenCalledTimes(1);
    expect(onSelectMarker).toHaveBeenCalledWith(1);
  });
});
