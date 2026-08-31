// @vitest-environment happy-dom
// spec 44 — 인용 근거 카드의 콘텐츠 언어, 폴백, 정본 링크를 동결한다.
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UI_LANG_STORAGE_KEY, type UiLang } from '@/shared/i18n/ui-lang';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { EvidenceInspector, type EvidenceItem } from './evidence-inspector';

const KO_TITLE = '골다공증 한의표준임상진료지침';
const EN_TITLE = 'Korean Medicine Clinical Practice Guideline for Osteoporosis';
const KO_EXCERPT = '성인 골다공증 환자에게 침 치료를 고려할 수 있다.';
const EN_EXCERPT = 'Acupuncture may be considered for adults with osteoporosis.';
const KO_SECTION = ['Ⅳ. 권고사항', '1. 침'];
const EN_SECTION = ['IV. Recommendations', '1. Acupuncture'];
const SOURCE_URL = 'https://example.test/nckm/osteoporosis#page=41';

const translatedEvidence: EvidenceItem = {
  id: 'evidence-translated',
  marker: 1,
  guidelineTitle: KO_TITLE,
  titleTranslated: EN_TITLE,
  version: '1.0',
  sectionPath: KO_SECTION,
  sectionPathTranslated: EN_SECTION,
  excerpt: KO_EXCERPT,
  excerptTranslated: EN_EXCERPT,
  recommendationGrade: { system: 'GRADE', code: 'B', label: '중등도 권고' },
  sourceUrl: SOURCE_URL,
  translationModel: 'synthetic-batch-translation',
};

const untranslatedEvidence: EvidenceItem = {
  id: 'evidence-untranslated',
  marker: 2,
  guidelineTitle: '류마티스 관절염 한의표준임상진료지침',
  version: '1.0',
  sectionPath: ['Ⅳ. 권고사항', '3. 약침 치료'],
  excerpt: '약침 시술 전 알레르기력과 이상 반응 가능성을 확인한다.',
  sourceUrl: 'https://example.test/nckm/rheumatoid-arthritis#page=52',
};

function setUiLang(lang: UiLang): void {
  stubNavigatorLanguage(lang === 'ko' ? 'ko-KR' : 'en-US');
  stubStoredUiLang(UI_LANG_STORAGE_KEY, lang);
}

function renderInspector(evidence: EvidenceItem[], lang: UiLang): void {
  renderWithProviders(
    <EvidenceInspector
      evidence={evidence}
      activeMarker={null}
      onSelectMarker={vi.fn()}
      lang={lang}
    />,
  );
}

function cardFor(marker: number): HTMLElement {
  const card = screen.getByText(`[${marker}]`).closest('li');
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

beforeEach(() => {
  setUiLang('ko');
});

afterEach(() => {
  cleanup();
});

describe('EvidenceInspector 콘텐츠 언어 (spec 44)', () => {
  it('기준 25-b: 한국어 UI여도 en 콘텐츠 인용은 titleTranslated·quoteTranslated를 표시한다', () => {
    renderInspector([translatedEvidence], 'en');

    expect(screen.getByText(EN_TITLE)).toBeTruthy();
    expect(screen.getByText(EN_EXCERPT)).toBeTruthy();
    expect(screen.queryByText(KO_TITLE)).toBeNull();
    expect(screen.queryByText(KO_EXCERPT)).toBeNull();
  });

  it('기준 26-a·26-b·대칭: 명시한 콘텐츠 언어는 UI 토글을 바꿔도 카드에서 유지된다', () => {
    setUiLang('ko');
    renderInspector([translatedEvidence], 'en');
    expect(screen.getByText(EN_TITLE)).toBeTruthy();
    expect(screen.getByText(EN_EXCERPT)).toBeTruthy();

    cleanup();
    setUiLang('en');
    renderInspector([translatedEvidence], 'en');
    expect(screen.getByText(EN_TITLE)).toHaveTextContent(EN_TITLE);
    expect(screen.getByText(EN_EXCERPT)).toHaveTextContent(EN_EXCERPT);

    cleanup();
    setUiLang('en');
    renderInspector([translatedEvidence], 'ko');
    expect(screen.getByText(KO_TITLE)).toBeTruthy();
    expect(screen.getByText(KO_EXCERPT)).toBeTruthy();
    expect(screen.queryByText(EN_TITLE)).toBeNull();
    expect(screen.queryByText(EN_EXCERPT)).toBeNull();
  });

  it('기준 28-a·28-b·34-a: en 콘텐츠의 번역 없는 카드는 한국어 UI에서도 영문 미번역 배지를 표시한다', () => {
    renderInspector([untranslatedEvidence], 'en');

    expect(screen.getByText('Not translated')).toBeTruthy();
    expect(screen.queryByText('미번역')).toBeNull();
    expect(screen.getByText(untranslatedEvidence.guidelineTitle)).toBeTruthy();
    expect(screen.getByText(untranslatedEvidence.excerpt)).toBeTruthy();
  });

  it('기준 28-c: ko 콘텐츠에는 번역 필드 유무와 무관하게 배지가 없고 한국어 원문이 유지된다', () => {
    setUiLang('en');
    renderInspector([translatedEvidence, untranslatedEvidence], 'ko');

    expect(screen.getByText(KO_TITLE)).toBeTruthy();
    expect(screen.getByText(KO_EXCERPT)).toBeTruthy();
    expect(screen.getByText(untranslatedEvidence.guidelineTitle)).toBeTruthy();
    expect(screen.getByText(untranslatedEvidence.excerpt)).toBeTruthy();
    expect(screen.queryByText(EN_TITLE)).toBeNull();
    expect(screen.queryByText(EN_EXCERPT)).toBeNull();
    expect(screen.queryByText('미번역')).toBeNull();
    expect(screen.queryByText('Not translated')).toBeNull();
  });

  it('기준 29-a: 패널 제목은 한국어 UI를, 같은 패널의 카드 내용은 en 콘텐츠 언어를 따른다', () => {
    renderInspector([translatedEvidence], 'en');

    expect(screen.getByText('인용 근거')).toBeTruthy();
    expect(screen.queryByText('Cited evidence')).toBeNull();
    expect(screen.getByText(EN_TITLE)).toBeTruthy();
    expect(screen.getByText(EN_EXCERPT)).toBeTruthy();
    expect(screen.queryByText(KO_EXCERPT)).toBeNull();
  });

  it('기준 31-a: en 근거 패널 카드 헤더는 번역 섹션 경로를 쓰고 한국어 경로를 보이지 않는다', () => {
    renderInspector([translatedEvidence], 'en');

    const card = cardFor(1);
    expect(card).toHaveTextContent('IV. Recommendations > 1. Acupuncture');
    expect(card).not.toHaveTextContent('Ⅳ. 권고사항');
    expect(card).not.toHaveTextContent('1. 침');
    expect(card).toHaveTextContent(EN_TITLE);
  });

  it('기준 31-c: sectionPathTranslated가 없는 카드는 원문 경로로 폴백하고 번역 있는 이웃은 번역 경로를 쓴다', () => {
    renderInspector([untranslatedEvidence, translatedEvidence], 'en');

    const fallbackCard = cardFor(2);
    const translatedCard = cardFor(1);
    expect(fallbackCard).toHaveTextContent('Ⅳ. 권고사항 > 3. 약침 치료');
    expect(translatedCard).toHaveTextContent('IV. Recommendations > 1. Acupuncture');
    expect(translatedCard).not.toHaveTextContent('Ⅳ. 권고사항');
  });

  it('기준 34-b: 번역 카드와 미번역 카드가 섞여도 배지는 번역 없는 근거 하나에만 붙는다', () => {
    renderInspector([untranslatedEvidence, translatedEvidence], 'en');

    const untranslatedCard = cardFor(2);
    const translatedCard = cardFor(1);
    expect(screen.getAllByText('Not translated')).toHaveLength(1);
    expect(within(untranslatedCard).getByText('Not translated')).toBeTruthy();
    expect(within(translatedCard).queryByText('Not translated')).toBeNull();
    expect(within(translatedCard).getByText(EN_EXCERPT)).toBeTruthy();
  });

  it('기준 35-a: 근거 패널 카드의 영문 콘텐츠 옆 원문 링크로 NCKM 정본에 도달할 수 있다', () => {
    renderInspector([translatedEvidence], 'en');

    expect(screen.getByText(EN_EXCERPT)).toBeTruthy();
    expect(screen.queryByText(KO_EXCERPT)).toBeNull();
    expect(screen.getByRole('link', { name: 'View source (NCKM)' })).toHaveAttribute(
      'href',
      SOURCE_URL,
    );
  });

  it('기준 36-a: 번역 카드에는 한국어·영어 어느 원문 펼침/접기 토글도 남지 않는다', () => {
    renderInspector([translatedEvidence], 'en');

    expect(screen.getByText(EN_EXCERPT)).toBeTruthy();
    expect(screen.queryByText(KO_EXCERPT)).toBeNull();
    expect(screen.queryByRole('button', { name: '한국어 원문 보기' })).toBeNull();
    expect(screen.queryByRole('button', { name: '한국어 원문 접기' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show Korean original' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hide Korean original' })).toBeNull();
  });

  it('기준 37-a: en 콘텐츠의 중등도 권고는 코드와 확정 영문 라벨을 함께 표시한다', () => {
    renderInspector([translatedEvidence], 'en');

    expect(screen.getByText('Recommendation grade B (Moderate recommendation)')).toBeTruthy();
    expect(screen.queryByText(/권고등급 B \(중등도 권고\)/)).toBeNull();
  });

  it('기준 37-b: ko 콘텐츠는 영어 UI에서도 중등도 권고 원문 라벨과 코드를 유지한다', () => {
    setUiLang('en');
    renderInspector([translatedEvidence], 'ko');

    expect(screen.getByText('권고등급 B (중등도 권고)')).toBeTruthy();
    expect(screen.queryByText(/Moderate recommendation/)).toBeNull();
  });

  it('기준 38-a·38-b: 문구표 밖 라벨은 en 콘텐츠에서도 원문을 보존하며 code도 함께 보인다', () => {
    const unknownRating: EvidenceItem = {
      ...translatedEvidence,
      id: 'evidence-unknown-rating',
      marker: 8,
      recommendationGrade: { system: 'GRADE', code: 'Z', label: '새 체계 등급' },
    };
    renderInspector([unknownRating], 'en');

    const ratingLine = screen.getByText('Recommendation grade Z (새 체계 등급)');
    expect(ratingLine).toHaveTextContent('새 체계 등급');
    expect(ratingLine).toHaveTextContent('Z');
    expect(ratingLine).not.toHaveTextContent('undefined');
  });
});
