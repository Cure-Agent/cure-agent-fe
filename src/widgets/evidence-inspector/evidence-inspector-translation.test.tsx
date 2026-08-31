// @vitest-environment happy-dom
// spec 42 번역 경계 — 영문 카드의 번역·미번역 표시와 한국어 정본 접근을 동결한다
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { EvidenceInspector, type EvidenceItem } from './evidence-inspector';

const ORIGINAL_TITLE = '요통 한의표준임상진료지침';
const ORIGINAL_EXCERPT = '만성 요통 환자에게 침 치료를 고려할 수 있다.';
const TRANSLATED_TITLE = 'Korean Medicine Clinical Practice Guideline for Low Back Pain';
const TRANSLATED_EXCERPT =
  'Acupuncture treatment may be considered for patients with chronic low back pain.';
const SOURCE_URL = 'https://example.test/nckm/low-back-pain#page=31';

const untranslatedEvidence: EvidenceItem = {
  id: 'evidence-untranslated',
  marker: 1,
  guidelineTitle: '류마티스 관절염 한의표준임상진료지침',
  version: '1.0',
  sectionPath: ['권고', '약침'],
  excerpt: '시술 전 알레르기력과 이상 반응 가능성을 확인한다.',
};

const translatedEvidence: EvidenceItem = {
  id: 'evidence-translated',
  marker: 2,
  guidelineTitle: ORIGINAL_TITLE,
  titleTranslated: TRANSLATED_TITLE,
  version: '2.0',
  sectionPath: ['치료', '침치료'],
  excerpt: ORIGINAL_EXCERPT,
  excerptTranslated: TRANSLATED_EXCERPT,
  sourceUrl: SOURCE_URL,
  translationModel: 'batch-translation-model',
};

function setLanguageInputs(navigatorLanguage: string, stored: string | null): void {
  stubNavigatorLanguage(navigatorLanguage);
  stubStoredUiLang(UI_LANG_STORAGE_KEY, stored);
}

function renderInspector(evidence: EvidenceItem[]): void {
  renderWithProviders(
    <EvidenceInspector evidence={evidence} activeMarker={null} onSelectMarker={vi.fn()} />,
  );
}

beforeEach(() => {
  setLanguageInputs('en-US', null);
});

describe('EvidenceInspector 번역 경계 (수용 기준 33~35)', () => {
  it('기준 33-a·35-c: 영문 UI의 번역 없는 카드는 한국어 원문을 즉시 보이고 미번역임을 밝힌다', () => {
    setLanguageInputs('en-US', null);
    renderInspector([untranslatedEvidence]);

    expect(screen.getByText(untranslatedEvidence.guidelineTitle)).toBeTruthy();
    expect(screen.getByText(untranslatedEvidence.excerpt)).toBeTruthy();
    expect(screen.getByText('Not translated')).toBeTruthy();
  });

  it('기준 34-a·35-a: 번역 있는 영문 카드는 배지 없이 번역 제목과 발췌를 보여준다', () => {
    setLanguageInputs('en-US', null);
    renderInspector([translatedEvidence]);

    expect(screen.queryByText('Not translated')).toBeNull();
    expect(screen.getByText(TRANSLATED_TITLE)).toBeTruthy();
    expect(screen.getByText(TRANSLATED_EXCERPT)).toBeTruthy();
  });

  it('기준 34-b: 번역 카드와 미번역 카드가 섞여도 배지는 근거 단위로 없는 카드에만 붙는다', () => {
    setLanguageInputs('en-US', null);
    renderInspector([untranslatedEvidence, translatedEvidence]);

    const untranslatedCard = screen.getByText('[1]').closest('li');
    const translatedCard = screen.getByText('[2]').closest('li');
    expect(untranslatedCard).not.toBeNull();
    expect(translatedCard).not.toBeNull();
    expect(screen.getAllByText('Not translated')).toHaveLength(1);
    expect(within(untranslatedCard as HTMLElement).getByText('Not translated')).toBeTruthy();
    expect(within(translatedCard as HTMLElement).queryByText('Not translated')).toBeNull();
  });

  it('기준 33-b: 한국어 UI에는 번역 유무와 무관하게 배지와 원문 토글이 생기지 않는다', () => {
    setLanguageInputs('ko-KR', null);
    renderInspector([untranslatedEvidence, translatedEvidence]);

    expect(screen.queryByText('미번역')).toBeNull();
    expect(screen.queryByText('Not translated')).toBeNull();
    expect(screen.queryByRole('button', { name: '한국어 원문 보기' })).toBeNull();
    expect(screen.getByText(ORIGINAL_TITLE)).toBeTruthy();
    expect(screen.getByText(ORIGINAL_EXCERPT)).toBeTruthy();

    // 한국어 경로의 무표시가 배지 기능 자체의 누락으로도 통과하지 않도록 영문 경계와 대조한다.
    cleanup();
    setLanguageInputs('en-US', null);
    renderInspector([untranslatedEvidence]);
    expect(screen.getByText('Not translated')).toBeTruthy();
  });

  /**
   * §42는 정본 도달을 **인라인 토글**로 충족했고, §44가 그 수단을 **원문 링크**로 옮겼다
   * (판단표 「한국어 원문에 어떻게 도달하는가」). 요구는 그대로이고 이 단언만 자리를 옮긴다 —
   * 회귀가 아니라 의도된 전환이다(spec 44 위험 ⑷).
   */
  it('기준 35-b: 번역 카드에서도 원문 링크로 한국어 정본에 도달할 수 있다', () => {
    setLanguageInputs('en-US', null);
    renderInspector([translatedEvidence]);

    expect(screen.getByText(TRANSLATED_EXCERPT)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View source (NCKM)' })).toHaveAttribute(
      'href',
      SOURCE_URL,
    );
  });
});
