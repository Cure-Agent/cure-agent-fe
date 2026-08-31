// @vitest-environment happy-dom
// spec 44 — 대화 맥락이 없는 지침 탐색기는 UI 언어를 표시와 lang 요청에 함께 사용한다.
import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UI_LANG_STORAGE_KEY, type UiLang } from '@/shared/i18n/ui-lang';
import { envelope, server, useMswServer } from '@/shared/test/msw';
import { renderWithProviders } from '@/shared/test/render';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { EvidenceFullText } from './evidence-full-text';
import { GuidelineListPanel } from './guideline-list-panel';

useMswServer();

const KO_TITLE = '골다공증 한의표준임상진료지침';
const EN_TITLE = 'Korean Medicine Clinical Practice Guideline for Osteoporosis';
const KO_EXCERPT = '골다공증 환자에게 침 치료를 고려할 수 있다.';
const EN_EXCERPT = 'Acupuncture may be considered for patients with osteoporosis.';
const SOURCE_URL = 'https://example.test/nckm/osteoporosis#page=41';

function setUiLang(lang: UiLang): void {
  stubNavigatorLanguage(lang === 'ko' ? 'ko-KR' : 'en-US');
  stubStoredUiLang(UI_LANG_STORAGE_KEY, lang);
}

beforeEach(() => {
  setUiLang('en');
});

afterEach(() => {
  cleanup();
});

describe('GuidelineListPanel UI 언어 경계 (spec 44)', () => {
  it('기준 30-a·30-b: 영문 UI의 목록은 titleTranslated를 표시하고 목록 요청에 lang=en을 싣는다', async () => {
    const requestedLangs: Array<string | null> = [];
    server.use(
      http.get('/api/v1/guidelines', ({ request }) => {
        requestedLangs.push(new URL(request.url).searchParams.get('lang'));
        return HttpResponse.json(
          envelope(
            [
              {
                id: 'guideline-osteoporosis',
                externalId: 'NCKM-OSTEOPOROSIS',
                title: KO_TITLE,
                titleTranslated: EN_TITLE,
                publisher: 'NCKM',
                currentVersion: '1.0',
                status: 'ACTIVE',
                publishedAt: '2025-01-15',
              },
            ],
            { size: 20, hasNext: false, nextCursor: null },
          ),
        );
      }),
    );

    renderWithProviders(<GuidelineListPanel onSelect={vi.fn()} />);

    expect(await screen.findByText(EN_TITLE)).toBeTruthy();
    expect(screen.queryByText(KO_TITLE)).toBeNull();
    expect(requestedLangs).toEqual(['en']);
  });

  it('기준 30-c: 지침 탐색기에서 펼친 근거 전문 조회도 UI 토글의 lang=en을 싣는다', async () => {
    let requestedLang: string | null = null;
    server.use(
      http.get('/api/v1/evidence/ev-guideline-explorer', ({ request }) => {
        requestedLang = new URL(request.url).searchParams.get('lang');
        return HttpResponse.json(
          envelope({
            id: 'ev-guideline-explorer',
            guidelineId: 'guideline-osteoporosis',
            guidelineVersionId: 'guideline-osteoporosis-v1',
            guidelineTitle: KO_TITLE,
            titleTranslated: EN_TITLE,
            version: '1.0',
            sectionPath: ['Ⅳ. 권고사항', '1. 침'],
            sectionPathTranslated: ['IV. Recommendations', '1. Acupuncture'],
            excerpt: KO_EXCERPT,
            excerptTranslated: EN_EXCERPT,
            sourceUrl: SOURCE_URL,
          }),
        );
      }),
    );

    // lang prop을 생략한 호출이 곧 대화 responseLang이 없는 지침 탐색기 경로다.
    renderWithProviders(<EvidenceFullText evidenceId="ev-guideline-explorer" />);

    expect(await screen.findByText(EN_EXCERPT)).toBeTruthy();
    expect(screen.queryByText(KO_EXCERPT)).toBeNull();
    expect(requestedLang).toBe('en');
  });
});
