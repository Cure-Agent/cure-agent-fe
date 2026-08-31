// @vitest-environment happy-dom
// spec 44 — 참고안 콘텐츠와 UI 소유 검토 폼, 인용 정본 링크의 경계를 동결한다.
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UI_LANG_STORAGE_KEY, type UiLang } from '@/shared/i18n/ui-lang';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { GuidanceCard } from './guidance-card';

useMswServer();

const KO_TITLE = '류마티스 관절염 한의표준임상진료지침';
const EN_TITLE = 'Korean Medicine Clinical Practice Guideline for Rheumatoid Arthritis';
const KO_QUOTE = '성인 류마티스 관절염 환자에게 약침 치료를 고려할 수 있다.';
const EN_QUOTE =
  'Pharmacopuncture may be considered for adult patients with rheumatoid arthritis.';
const KO_DETAIL_EXCERPT = '약침 치료 전 알레르기력과 이상 반응 가능성을 확인한다.';
const EN_DETAIL_EXCERPT =
  'Check allergy history and the possibility of adverse reactions before pharmacopuncture.';
const KO_RECOMMENDATION = '성인 류마티스 관절염 환자에게 약침 치료를 고려할 것을 권고한다.';
const EN_RECOMMENDATION =
  'Pharmacopuncture is recommended for consideration in adults with rheumatoid arthritis.';
const KO_SECTION = ['Ⅳ. 권고사항', '1. 한의 단독치료', '3) 약침 치료'];
const EN_SECTION = [
  'IV. Recommendations',
  '1. Korean medicine monotherapy',
  '3) Pharmacopuncture',
];
const SOURCE_URL = 'https://example.test/nckm/rheumatoid-arthritis#page=73';

const citation = {
  marker: 1,
  evidenceId: 'ev-guidance',
  guidelineTitle: KO_TITLE,
  guidelineVersion: '1.0',
  sectionPath: KO_SECTION,
  quote: KO_QUOTE,
  sourceUrl: SOURCE_URL,
  titleTranslated: EN_TITLE,
  quoteTranslated: EN_QUOTE,
  sectionPathTranslated: EN_SECTION,
};

const guidance = {
  id: 'guidance-spec-44',
  patientId: 'patient-spec-44',
  patientProfileSnapshotId: 'snapshot-spec-44',
  summary:
    'For adult patients with rheumatoid arthritis, pharmacopuncture may be considered with individual risk review.',
  considerations: [
    {
      title: 'Consider pharmacopuncture after an individual safety assessment',
      rationale:
        'The recommendation should be weighed against allergy history and current medications.',
      citations: [citation],
      applicability: 'CAUTION' as const,
      patientFactors: ['진단명', '투약 목록'],
    },
  ],
  safetyAlerts: [
    {
      severity: 'WARNING' as const,
      description: 'Review allergy history before treatment.',
      citations: [],
    },
  ],
  missingInformation: ['허리둘레', '임상 메모'],
  reviewStatus: 'DRAFT' as const,
  generatedAt: '2026-08-30T10:00:00.000Z',
};

function setUiLang(lang: UiLang): void {
  stubNavigatorLanguage(lang === 'ko' ? 'ko-KR' : 'en-US');
  stubStoredUiLang(UI_LANG_STORAGE_KEY, lang);
}

function mockEvidenceDetail(): void {
  server.use(
    http.get('/api/v1/evidence/ev-guidance', () =>
      HttpResponse.json(
        envelope({
          id: 'ev-guidance',
          guidelineId: 'guideline-rheumatoid-arthritis',
          guidelineVersionId: 'guideline-rheumatoid-arthritis-v1',
          guidelineTitle: KO_TITLE,
          titleTranslated: EN_TITLE,
          version: '1.0',
          sectionPath: KO_SECTION,
          sectionPathTranslated: EN_SECTION,
          recommendationText: KO_RECOMMENDATION,
          recommendationTextTranslated: EN_RECOMMENDATION,
          excerpt: KO_DETAIL_EXCERPT,
          excerptTranslated: EN_DETAIL_EXCERPT,
          pageStart: 73,
          pageEnd: 74,
          sourceUrl: SOURCE_URL,
        }),
      ),
    ),
  );
}

function radioVisibleLabelTexts(): string[] {
  return ['ACCEPTED', 'MODIFIED', 'REJECTED'].map((decision) => {
    const radio = screen.getByRole('radio', { name: decision });
    return radio.closest('label')?.textContent?.trim() ?? '';
  });
}

beforeEach(() => {
  setUiLang('ko');
});

afterEach(() => {
  cleanup();
});

describe('GuidanceCard 콘텐츠 언어 (spec 44)', () => {
  it('기준 29-b: 참고안 내용은 en을 유지하고 라디오·코멘트·제출을 포함한 검토 폼은 UI 토글을 따른다', () => {
    setUiLang('ko');
    renderWithProviders(<GuidanceCard guidance={guidance} lang="en" />);

    expect(screen.getByText('Clinical guidance draft')).toBeTruthy();
    expect(screen.getByText('Patient evidence')).toBeTruthy();
    expect(screen.getByText('Diagnoses')).toBeTruthy();
    expect(screen.getByText('Medications')).toBeTruthy();
    expect(screen.getByText('Missing information')).toBeTruthy();
    expect(screen.getByText('Waist circumference')).toBeTruthy();
    expect(screen.getByText('Clinical note')).toBeTruthy();
    expect(screen.queryByText('진단명')).toBeNull();

    expect(screen.getByText('의료인 검토')).toBeTruthy();
    expect(radioVisibleLabelTexts()).toEqual(['승인', '수정', '반려']);
    expect(screen.getByLabelText('검토 의견')).toBeTruthy();
    expect(screen.getByRole('button', { name: '검토 확정' })).toBeTruthy();

    cleanup();
    setUiLang('en');
    renderWithProviders(<GuidanceCard guidance={guidance} lang="en" />);

    expect(screen.getByText('Clinician review')).toBeTruthy();
    expect(radioVisibleLabelTexts()).toEqual(['Accept', 'Modify', 'Reject']);
    expect(screen.getByLabelText('Review comment')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit review' })).toBeTruthy();

    // UI 토글 뒤에도 참고안 내용물은 같은 en 콘텐츠로 남는다.
    expect(screen.getByText('Clinical guidance draft')).toBeTruthy();
    expect(screen.getByText('Diagnoses')).toBeTruthy();
    expect(screen.getByText('Waist circumference')).toBeTruthy();
  });

  it('기준 31-b: en 참고안 인용의 펼침 헤더는 번역 섹션 경로를 쓰고 한국어 경로를 보이지 않는다', async () => {
    mockEvidenceDetail();
    const user = userEvent.setup();

    renderWithProviders(<GuidanceCard guidance={guidance} lang="en" />);
    await user.click(screen.getByRole('button', { name: '[1]' }));

    expect(await screen.findByText(EN_DETAIL_EXCERPT)).toBeTruthy();
    expect(document.body).toHaveTextContent(EN_SECTION.join(' > '));
    expect(document.body).not.toHaveTextContent(KO_SECTION.join(' > '));
    expect(document.body).toHaveTextContent(EN_TITLE);
  });

  it('기준 35-b: 참고안 인용에서 en 전문을 보면서 원문 링크로 NCKM 한국어 정본에 도달할 수 있다', async () => {
    mockEvidenceDetail();
    const user = userEvent.setup();

    renderWithProviders(<GuidanceCard guidance={guidance} lang="en" />);
    await user.click(screen.getByRole('button', { name: '[1]' }));

    expect(await screen.findByText(EN_DETAIL_EXCERPT)).toBeTruthy();
    expect(screen.queryByText(KO_DETAIL_EXCERPT)).toBeNull();
    expect(screen.getByRole('link', { name: 'View source (NCKM)' })).toHaveAttribute(
      'href',
      SOURCE_URL,
    );
  });
});
