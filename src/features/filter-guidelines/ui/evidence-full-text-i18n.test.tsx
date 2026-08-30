// @vitest-environment happy-dom
// 근거 전문의 번역 표시 — 인용 카드와 같은 규칙이 펼친 전문에서도 성립하는지 본다
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { EvidenceFullText } from './evidence-full-text';

useMswServer();

const KO_EXCERPT = '만성 요통 환자에게 침 치료를 고려할 수 있다.';
const EN_EXCERPT = 'Acupuncture treatment may be considered for patients with chronic low back pain.';
const KO_RECOMMENDATION = '만성 요통 환자에게 침 치료를 시행할 것을 권고한다.';

function mockEvidence(extra: Record<string, unknown> = {}): void {
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
          recommendationText: KO_RECOMMENDATION,
          excerpt: KO_EXCERPT,
          sourceUrl: 'https://example.test/guidelines/g-1',
          ...extra,
        }),
      ),
    ),
  );
}

function setLanguageInputs(navigatorLanguage: string, stored: string | null): void {
  stubNavigatorLanguage(navigatorLanguage);
  stubStoredUiLang(UI_LANG_STORAGE_KEY, stored);
}

beforeEach(() => {
  setLanguageInputs('ko-KR', null);
});

describe('EvidenceFullText 번역 표시', () => {
  it('한국어 화면은 오늘 그대로다 — 번역이 실려 와도 원문만 그리고 배지도 토글도 없다', async () => {
    setLanguageInputs('ko-KR', null);
    mockEvidence({ excerptTranslated: EN_EXCERPT });

    renderWithProviders(<EvidenceFullText evidenceId="ev-1" />);

    expect(await screen.findByText('본문 발췌')).toBeTruthy();
    expect(screen.getByText(KO_EXCERPT)).toBeTruthy();
    expect(screen.queryByText(EN_EXCERPT)).toBeNull();
    expect(screen.queryByText('미번역')).toBeNull();
    expect(screen.queryByRole('button', { name: '한국어 원문 보기' })).toBeNull();
  });

  it('영문 화면에서 번역이 있으면 번역을 그리고, 한국어 원문에 도달할 수 있다', async () => {
    setLanguageInputs('en-US', null);
    mockEvidence({ excerptTranslated: EN_EXCERPT });

    const user = userEvent.setup();
    renderWithProviders(<EvidenceFullText evidenceId="ev-1" />);

    expect(await screen.findByText('Excerpt')).toBeTruthy();
    expect(screen.getByText(EN_EXCERPT)).toBeTruthy();
    expect(screen.queryByText(KO_EXCERPT)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Show Korean original' }));

    expect(screen.getByText(KO_EXCERPT)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide Korean original' })).toBeTruthy();
  });

  it('영문 화면에서 번역이 없으면 원문을 그대로 두고 발췌에 미번역 배지를 붙인다', async () => {
    setLanguageInputs('en-US', null);
    mockEvidence();

    renderWithProviders(<EvidenceFullText evidenceId="ev-1" />);

    expect(await screen.findByText('Excerpt')).toBeTruthy();
    expect(screen.getByText(KO_EXCERPT)).toBeTruthy();
    // 번역이 없으면 열 원문도 따로 없다 — 이미 보이고 있다
    expect(screen.queryByRole('button', { name: 'Show Korean original' })).toBeNull();
  });

  /**
   * 권고문은 계약에 번역이 없다(`EvidenceDetailResponseDto`가 싣는 번역은 발췌·제목뿐).
   * 영문 화면에서는 언제나 한국어이므로 그 사실이 화면에 드러나야 한다.
   */
  it('권고문은 번역 대상이 아니므로 영문 화면에서 언제나 미번역으로 표시된다', async () => {
    setLanguageInputs('en-US', null);
    mockEvidence({ excerptTranslated: EN_EXCERPT });

    renderWithProviders(<EvidenceFullText evidenceId="ev-1" />);

    expect(await screen.findByText('Recommendation')).toBeTruthy();
    expect(screen.getByText(KO_RECOMMENDATION)).toBeTruthy();
    // 발췌는 번역됐는데도 권고문 쪽 배지는 남는다 — 경계가 항목 단위로 드러나야 한다
    expect(screen.getAllByText('Not translated')).toHaveLength(1);
  });

  it('주변 문구도 표시 언어를 따른다 — 영어 제목 아래 한국어 라벨이 남지 않는다', async () => {
    setLanguageInputs('en-US', null);
    mockEvidence({ pageStart: 42, pageEnd: 43 });

    renderWithProviders(<EvidenceFullText evidenceId="ev-1" />);

    expect(await screen.findByText(/Source p\.42–43/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View source (NCKM)' })).toBeTruthy();
    expect(screen.queryByText('본문 발췌')).toBeNull();
    expect(screen.queryByText(/원문 p\./)).toBeNull();

    cleanup();
    setLanguageInputs('ko-KR', null);
    renderWithProviders(<EvidenceFullText evidenceId="ev-1" />);

    expect(await screen.findByText(/원문 p\.42–43/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '원문 보기 (NCKM)' })).toBeTruthy();
  });
});
