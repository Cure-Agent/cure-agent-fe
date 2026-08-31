// @vitest-environment happy-dom
// spec 44 — 근거 전문의 메시지별 언어, 캐시 키, 미번역 경계와 정본 링크를 동결한다.
import { QueryClient } from '@tanstack/react-query';
import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UI_LANG_STORAGE_KEY, type UiLang } from '@/shared/i18n/ui-lang';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { EvidenceFullText } from './evidence-full-text';

useMswServer();

const KO_TITLE = '골다공증 한의표준임상진료지침';
const EN_TITLE = 'Korean Medicine Clinical Practice Guideline for Osteoporosis';
const KO_EXCERPT = '침 치료는 골다공증 환자의 통증과 기능 개선을 위해 고려할 수 있다.';
const EN_EXCERPT =
  'Acupuncture may be considered to improve pain and function in patients with osteoporosis.';
const KO_RECOMMENDATION = '성인 골다공증 환자에게 침 치료를 고려할 것을 권고한다.';
const EN_RECOMMENDATION =
  'Acupuncture is recommended for consideration in adults with osteoporosis.';
const KO_SECTION = ['Ⅳ. 권고사항', '1. 침'];
const EN_SECTION = ['IV. Recommendations', '1. Acupuncture'];
const SOURCE_URL = 'https://example.test/nckm/osteoporosis#page=41';

function setUiLang(lang: UiLang): void {
  stubNavigatorLanguage(lang === 'ko' ? 'ko-KR' : 'en-US');
  stubStoredUiLang(UI_LANG_STORAGE_KEY, lang);
}

function evidenceBody(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    guidelineId: 'guideline-osteoporosis',
    guidelineVersionId: 'guideline-osteoporosis-v1',
    guidelineTitle: KO_TITLE,
    version: '1.0',
    sectionPath: KO_SECTION,
    recommendationText: KO_RECOMMENDATION,
    excerpt: KO_EXCERPT,
    pageStart: 41,
    pageEnd: 42,
    sourceUrl: SOURCE_URL,
    ...extra,
  };
}

function mockEvidence(id: string, extra: Record<string, unknown> = {}): void {
  server.use(
    http.get(`/api/v1/evidence/${id}`, () =>
      HttpResponse.json(envelope(evidenceBody(id, extra))),
    ),
  );
}

beforeEach(() => {
  setUiLang('ko');
});

afterEach(() => {
  cleanup();
});

describe('EvidenceFullText 콘텐츠 언어 (spec 44)', () => {
  it('기준 25-c: 한국어 UI에서 en 콘텐츠의 전문을 펼치면 excerptTranslated가 표시된다', async () => {
    mockEvidence('ev-25-c', {
      titleTranslated: EN_TITLE,
      sectionPathTranslated: EN_SECTION,
      excerptTranslated: EN_EXCERPT,
      recommendationTextTranslated: EN_RECOMMENDATION,
    });

    renderWithProviders(<EvidenceFullText evidenceId="ev-25-c" lang="en" />);

    expect(await screen.findByText('Excerpt')).toBeTruthy();
    expect(screen.getByText(EN_EXCERPT)).toBeTruthy();
    expect(screen.queryByText(KO_EXCERPT)).toBeNull();
    expect(screen.queryByText('본문 발췌')).toBeNull();
  });

  it('기준 28-a·28-b: en 콘텐츠의 번역 없는 전문은 한국어 UI에서도 영문 미번역 배지를 표시한다', async () => {
    mockEvidence('ev-28-en');

    renderWithProviders(<EvidenceFullText evidenceId="ev-28-en" lang="en" />);

    expect(await screen.findByText('Excerpt')).toBeTruthy();
    expect(screen.getAllByText('Not translated').length).toBeGreaterThan(0);
    expect(screen.queryByText('미번역')).toBeNull();
    expect(screen.getByText(KO_EXCERPT)).toBeTruthy();
  });

  it('기준 28-c: ko 콘텐츠 전문은 영어 UI와 번역 필드가 있어도 배지 없이 한국어 원문을 유지한다', async () => {
    setUiLang('en');
    mockEvidence('ev-28-ko', {
      titleTranslated: EN_TITLE,
      sectionPathTranslated: EN_SECTION,
      excerptTranslated: EN_EXCERPT,
      recommendationTextTranslated: EN_RECOMMENDATION,
    });

    renderWithProviders(<EvidenceFullText evidenceId="ev-28-ko" lang="ko" />);

    expect(await screen.findByText('본문 발췌')).toBeTruthy();
    expect(screen.getByText(KO_EXCERPT)).toBeTruthy();
    expect(screen.getByText(KO_RECOMMENDATION)).toBeTruthy();
    expect(screen.queryByText(EN_EXCERPT)).toBeNull();
    expect(screen.queryByText('미번역')).toBeNull();
    expect(screen.queryByText('Not translated')).toBeNull();
  });

  it('기준 32-a: recommendationTextTranslated가 있으면 번역 권고문을 표시하고 권고문 배지가 없다', async () => {
    mockEvidence('ev-32-translated', {
      titleTranslated: EN_TITLE,
      sectionPathTranslated: EN_SECTION,
      excerptTranslated: EN_EXCERPT,
      recommendationTextTranslated: EN_RECOMMENDATION,
    });

    renderWithProviders(<EvidenceFullText evidenceId="ev-32-translated" lang="en" />);

    expect(await screen.findByText('Recommendation')).toBeTruthy();
    expect(screen.getByText(EN_RECOMMENDATION)).toBeTruthy();
    expect(screen.queryByText(KO_RECOMMENDATION)).toBeNull();
    expect(screen.queryByText('Not translated')).toBeNull();
  });

  it('기준 32-b: recommendationTextTranslated가 없으면 원문 권고문과 영문 미번역 배지를 함께 남긴다', async () => {
    mockEvidence('ev-32-untranslated', {
      titleTranslated: EN_TITLE,
      sectionPathTranslated: EN_SECTION,
      excerptTranslated: EN_EXCERPT,
    });

    renderWithProviders(<EvidenceFullText evidenceId="ev-32-untranslated" lang="en" />);

    expect(await screen.findByText('Recommendation')).toBeTruthy();
    expect(screen.getByText(KO_RECOMMENDATION)).toBeTruthy();
    expect(screen.queryByText(EN_RECOMMENDATION)).toBeNull();
    expect(screen.getAllByText('Not translated')).toHaveLength(1);
    expect(screen.queryByText('미번역')).toBeNull();
  });

  it('기준 33-a·33-b: 공유 캐시에서 lang이 달라지면 재조회하고 같은 lang 재마운트는 캐시를 재사용한다', async () => {
    const requestedLangs: Array<string | null> = [];
    const CACHE_KO_EXCERPT = '동일 근거의 한국어 캐시 응답 발췌.';
    const CACHE_EN_EXCERPT = 'English excerpt returned for the same cached evidence.';

    server.use(
      http.get('/api/v1/evidence/ev-cache', ({ request }) => {
        const lang = new URL(request.url).searchParams.get('lang');
        requestedLangs.push(lang);
        return HttpResponse.json(
          envelope({
            id: 'ev-cache',
            guidelineId: 'guideline-cache',
            guidelineVersionId: 'guideline-cache-v1',
            guidelineTitle: KO_TITLE,
            version: '1.0',
            sectionPath: KO_SECTION,
            excerpt: lang === 'ko' ? CACHE_KO_EXCERPT : KO_EXCERPT,
            excerptTranslated: lang === 'en' ? CACHE_EN_EXCERPT : undefined,
            sourceUrl: SOURCE_URL,
          }),
        );
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      },
    });

    const englishRender = renderWithProviders(
      <EvidenceFullText evidenceId="ev-cache" lang="en" />,
      { queryClient },
    );
    expect(await screen.findByText(CACHE_EN_EXCERPT)).toBeTruthy();
    expect(requestedLangs).toEqual(['en']);
    englishRender.unmount();

    const koreanRender = renderWithProviders(
      <EvidenceFullText evidenceId="ev-cache" lang="ko" />,
      { queryClient },
    );
    expect(await screen.findByText(CACHE_KO_EXCERPT)).toBeTruthy();
    expect(requestedLangs).toEqual(['en', 'ko']);
    koreanRender.unmount();

    renderWithProviders(<EvidenceFullText evidenceId="ev-cache" lang="ko" />, {
      queryClient,
    });
    expect(screen.getByText(CACHE_KO_EXCERPT)).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requestedLangs).toEqual(['en', 'ko']);
  });

  it('기준 35-c: 지침 탐색기 폴백 경로는 UI lang을 요청에 싣고 원문 링크를 보존한다', async () => {
    setUiLang('en');
    let requestedLang: string | null = null;
    server.use(
      http.get('/api/v1/evidence/ev-guideline-source', ({ request }) => {
        requestedLang = new URL(request.url).searchParams.get('lang');
        return HttpResponse.json(
          envelope(
            evidenceBody('ev-guideline-source', {
              titleTranslated: EN_TITLE,
              sectionPathTranslated: EN_SECTION,
              excerptTranslated: EN_EXCERPT,
              recommendationTextTranslated: EN_RECOMMENDATION,
            }),
          ),
        );
      }),
    );

    renderWithProviders(<EvidenceFullText evidenceId="ev-guideline-source" />);

    const sourceLink = await screen.findByRole('link', { name: 'View source (NCKM)' });
    expect(sourceLink).toHaveAttribute('href', SOURCE_URL);
    expect(requestedLang).toBe('en');
    expect(screen.getByText(EN_EXCERPT)).toBeTruthy();
  });

  it('기준 36-b: 번역된 근거 전문에는 한국어·영어 어느 원문 펼침/접기 토글도 없다', async () => {
    mockEvidence('ev-36', {
      titleTranslated: EN_TITLE,
      sectionPathTranslated: EN_SECTION,
      excerptTranslated: EN_EXCERPT,
      recommendationTextTranslated: EN_RECOMMENDATION,
    });

    renderWithProviders(<EvidenceFullText evidenceId="ev-36" lang="en" />);

    expect(await screen.findByText(EN_EXCERPT)).toBeTruthy();
    expect(screen.queryByText(KO_EXCERPT)).toBeNull();
    expect(screen.queryByRole('button', { name: '한국어 원문 보기' })).toBeNull();
    expect(screen.queryByRole('button', { name: '한국어 원문 접기' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show Korean original' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hide Korean original' })).toBeNull();
  });
});
