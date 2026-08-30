// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { UI_LANG_STORAGE_KEY } from '@/shared/i18n/ui-lang';
import { stubNavigatorLanguage, stubStoredUiLang } from '@/shared/test/ui-lang-env';
import { GENERAL_SUGGESTED_PROMPTS, resolveSuggestedPrompts } from './suggested-prompts';

/**
 * docs/specs/42 FE 수용 기준 30-a~c·36 동결 테스트. 구현 중 수정 금지.
 * 영문 기대값은 구현 상수를 참조하지 않고 spec 42 표에서 직접 옮겼다.
 */

const GENERAL_KO = [
  '성인 만성 비특이적 요통 환자에게 침 치료를 할 때, 모든 환자에게 같은 혈자리를 쓰는 표준 처방과 환자별로 달리하는 개별 처방 중 어느 쪽이 권고되나요?',
  '성인 원발성 불면 환자에서 불면 증상 개선을 위해 고려할 수 있는 한약 처방은 무엇인가요?',
  '편두통 환자에서 전침치료를 고려할 때, 일반적인 양약치료보다 증상 호전이나 두통 강도 완화에 도움이 될 수 있는가?',
] as const;

const GENERAL_EN = [
  'For adult patients with chronic nonspecific low back pain, when providing acupuncture treatment, is a standardized prescription using the same acupoints for all patients or an individualized prescription tailored to each patient recommended?',
  'What herbal medicine prescription can be considered to improve insomnia symptoms in adult patients with primary insomnia?',
  'In patients with migraine, when considering electroacupuncture treatment, can it help improve symptoms or relieve headache intensity compared with conventional medication treatment?',
] as const;

const OSTEOPOROSIS_EN =
  'When considering acupuncture for a patient with osteoporosis to improve bone density or relieve pain, what is the usual appropriate retention time for the needles?';
const ADHD_EN =
  'In what clinical situations can herbal medicine treatment be considered first for children and adolescents with ADHD?';
const RHEUMATOID_ARTHRITIS_EN =
  'When using pharmacopuncture to relieve symptoms in adult patients with rheumatoid arthritis, what acupoint selection principles should be applied in addition to the treatment site, and what safety precautions are necessary before using bee venom pharmacopuncture?';

beforeEach(() => {
  stubNavigatorLanguage('en-US');
  stubStoredUiLang(UI_LANG_STORAGE_KEY, null);
});

describe('예시 질의문 언어 선택 (수용 기준 30-a~c)', () => {
  it('기준 30-a·b: 일반 대화의 같은 세 자리를 요청한 UI 언어로 돌려준다', () => {
    expect(resolveSuggestedPrompts({ type: 'GUIDELINE_QA', lang: 'ko' })).toEqual(GENERAL_KO);
    expect(resolveSuggestedPrompts({ type: 'GUIDELINE_QA', lang: 'en' })).toEqual(GENERAL_EN);
  });

  it('기준 30-c: 환자 맞춤 예시도 진단에 맞는 영문 문장을 돌려준다', () => {
    expect(
      resolveSuggestedPrompts({
        type: 'PATIENT_GUIDANCE',
        diagnoses: ['골다공증'],
        lang: 'en',
      }),
    ).toEqual([OSTEOPOROSIS_EN]);
  });
});

describe('영문 예시 질의문 자구 고정 (수용 기준 36)', () => {
  it('기준 36-a: 일반 첫 문장은 만성요통 실측 문구와 자구까지 같다', () => {
    expect(GENERAL_SUGGESTED_PROMPTS[0].en).toBe(
      'For adult patients with chronic nonspecific low back pain, when providing acupuncture treatment, is a standardized prescription using the same acupoints for all patients or an individualized prescription tailored to each patient recommended?',
    );
  });

  it('기준 36-b: 일반 둘째 문장은 불면 실측 문구와 자구까지 같다', () => {
    expect(GENERAL_SUGGESTED_PROMPTS[1].en).toBe(
      'What herbal medicine prescription can be considered to improve insomnia symptoms in adult patients with primary insomnia?',
    );
  });

  it('기준 36-c: 일반 셋째 문장은 편두통 실측 문구와 자구까지 같다', () => {
    expect(GENERAL_SUGGESTED_PROMPTS[2].en).toBe(
      'In patients with migraine, when considering electroacupuncture treatment, can it help improve symptoms or relieve headache intensity compared with conventional medication treatment?',
    );
  });

  it('기준 36-d: 골다공증 환자 맞춤 문장은 실측 문구와 자구까지 같다', () => {
    expect(
      resolveSuggestedPrompts({
        type: 'PATIENT_GUIDANCE',
        diagnoses: ['골다공증'],
        lang: 'en',
      }),
    ).toEqual([OSTEOPOROSIS_EN]);
  });

  it('기준 36-e: ADHD 환자 맞춤 문장은 실측 문구와 자구까지 같다', () => {
    expect(
      resolveSuggestedPrompts({
        type: 'PATIENT_GUIDANCE',
        diagnoses: ['주의력결핍 과잉행동장애 (ADHD)'],
        lang: 'en',
      }),
    ).toEqual([ADHD_EN]);
  });

  it('기준 36-f: 류마티스 환자 맞춤 문장은 실측 문구와 자구까지 같다', () => {
    expect(
      resolveSuggestedPrompts({
        type: 'PATIENT_GUIDANCE',
        diagnoses: ['류마티스 관절염'],
        lang: 'en',
      }),
    ).toEqual([RHEUMATOID_ARTHRITIS_EN]);
  });
});
