import { describe, expect, it } from 'vitest';
import { GENERAL_SUGGESTED_PROMPTS, resolveSuggestedPrompts } from './suggested-prompts';

/** 이 스위트는 한국어 경로를 본다 — 언어 축은 spec 42 동결 테스트가 따로 다룬다 */
const GENERAL_KO = GENERAL_SUGGESTED_PROMPTS.map((prompt) => prompt.ko);

describe('resolveSuggestedPrompts', () => {
  it('일반 대화에는 예시 질의문 3개를 준다', () => {
    expect(resolveSuggestedPrompts({ type: 'GUIDELINE_QA', lang: 'ko' })).toEqual(GENERAL_KO);
    expect(GENERAL_SUGGESTED_PROMPTS).toHaveLength(3);
  });

  it('환자 맞춤 대화는 진단에 걸리는 질의문 하나만 준다', () => {
    expect(
      resolveSuggestedPrompts({ type: 'PATIENT_GUIDANCE', diagnoses: ['골다공증'], lang: 'ko' }),
    ).toEqual([
      '골다공증 환자에게 골밀도나 통증 개선을 목적으로 침 치료를 고려할 때, 유침 시간은 보통 어느 정도로 잡는 것이 적절한가요?',
    ]);
    expect(
      resolveSuggestedPrompts({
        type: 'PATIENT_GUIDANCE',
        diagnoses: ['류마티스 관절염'],
        lang: 'ko',
      }),
    ).toEqual([
      '성인 류마티스 관절염 환자의 증상 완화를 위해 약침을 쓸 때, 시술 부위와 함께 어떤 취혈 원칙을 적용하고 봉약침 사용 전에는 어떤 안전 조치가 필요한가?',
    ]);
  });

  /** 진단 칸은 자유 입력이라 데모 픽스처와 글자가 정확히 같으리라 기대할 수 없다 */
  it('진단명은 부분일치로 찾는다 — 앞뒤 수식어나 약어 표기도 걸린다', () => {
    const withModifier = resolveSuggestedPrompts({
      type: 'PATIENT_GUIDANCE',
      diagnoses: ['폐경 후 원발성 골다공증'],
      lang: 'ko',
    });
    const withAbbreviation = resolveSuggestedPrompts({
      type: 'PATIENT_GUIDANCE',
      diagnoses: ['소아 ADHD 의심'],
      lang: 'ko',
    });

    expect(withModifier[0]).toContain('유침 시간');
    expect(withAbbreviation[0]).toContain('ADHD 소아·청소년');
  });

  it('여러 진단 중 하나만 걸려도 찾는다', () => {
    const prompts = resolveSuggestedPrompts({
      type: 'PATIENT_GUIDANCE',
      diagnoses: ['고혈압', '주의력결핍 과잉행동장애'],
      lang: 'ko',
    });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('ADHD');
  });

  it('걸리는 진단이 없으면 일반 질의문으로 떨어진다 — 빈 자리를 남기지 않는다', () => {
    expect(
      resolveSuggestedPrompts({
        type: 'PATIENT_GUIDANCE',
        diagnoses: ['등록되지 않은 진단'],
        lang: 'ko',
      }),
    ).toEqual(GENERAL_KO);
    expect(
      resolveSuggestedPrompts({ type: 'PATIENT_GUIDANCE', diagnoses: [], lang: 'ko' }),
    ).toEqual(GENERAL_KO);
  });

  /**
   * 일반 질의문을 먼저 그렸다가 환자 질의문으로 갈아끼우면 누르려던 항목이 손 밑에서 바뀐다 —
   * 환자 프로필을 아직 못 받은 동안은 아무것도 내지 않는다.
   */
  it('환자 프로필을 아직 못 받았으면 아무것도 주지 않는다', () => {
    expect(resolveSuggestedPrompts({ type: 'PATIENT_GUIDANCE', lang: 'ko' })).toEqual([]);
  });
});
