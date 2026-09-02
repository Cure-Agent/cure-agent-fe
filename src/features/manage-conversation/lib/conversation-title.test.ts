import { describe, expect, it } from 'vitest';
import {
  BE_DEFAULT_CONVERSATION_TITLE,
  resolveConversationTitle,
} from './conversation-title';

describe('resolveConversationTitle 기본 제목 해석', () => {
  it('BE 기본 제목을 영문 화면의 New conversation으로 치환한다', () => {
    expect(resolveConversationTitle('새 대화', 'en')).toBe('New conversation');
  });

  it('BE 기본 제목을 한국어 화면의 새 대화로 치환한다', () => {
    expect(resolveConversationTitle('새 대화', 'ko')).toBe('새 대화');
  });

  it('질의에서 만들어진 한국어 제목은 영문 화면에서도 그대로 둔다', () => {
    const title = '만성 요통에 침 치료가 효과적인가요?';

    expect(resolveConversationTitle(title, 'en')).toBe(
      '만성 요통에 침 치료가 효과적인가요?',
    );
  });

  it('질의에서 만들어진 영문 제목도 그대로 둔다', () => {
    const title = 'Is acupuncture effective for chronic low back pain?';

    expect(resolveConversationTitle(title, 'ko')).toBe(
      'Is acupuncture effective for chronic low back pain?',
    );
  });

  it('새 대화가 들어간 부분일치 제목은 치환하지 않는다', () => {
    expect([
      resolveConversationTitle('새 대화 정리', 'en'),
      resolveConversationTitle('어제 새 대화', 'en'),
    ]).toEqual(['새 대화 정리', '어제 새 대화']);
  });

  it('BE 기본 제목 앞뒤의 공백을 다듬거나 치환하지 않는다', () => {
    expect([
      resolveConversationTitle(' 새 대화', 'en'),
      resolveConversationTitle('새 대화 ', 'en'),
    ]).toEqual([' 새 대화', '새 대화 ']);
  });

  it('빈 문자열은 그대로 두고 정확한 BE 기본 제목만 자리표시자로 치환한다', () => {
    expect([
      resolveConversationTitle('', 'en'),
      resolveConversationTitle('새 대화', 'en'),
    ]).toEqual(['', 'New conversation']);
  });

  it('BE 기본 제목 상수는 정확히 새 대화이며 해석 함수의 치환 기준으로 쓰인다', () => {
    expect(BE_DEFAULT_CONVERSATION_TITLE).toBe('새 대화');
    expect(resolveConversationTitle(BE_DEFAULT_CONVERSATION_TITLE, 'en')).toBe(
      'New conversation',
    );
  });
});

describe('resolveConversationTitle 환자 맞춤 제목의 라벨', () => {
  it('한국어로 만든 환자 맞춤 제목을 영문 화면에서 영문 라벨로 그린다', () => {
    expect(
      resolveConversationTitle('CASE-001 임상 참고 (8/4 14:30)', 'en', 'PATIENT_GUIDANCE'),
    ).toBe('CASE-001 Clinical guidance (8/4 14:30)');
  });

  it('영문으로 만든 환자 맞춤 제목을 한국어 화면에서 한국어 라벨로 그린다', () => {
    expect(
      resolveConversationTitle(
        'CASE-001 Clinical guidance (8/4 14:30)',
        'ko',
        'PATIENT_GUIDANCE',
      ),
    ).toBe('CASE-001 임상 참고 (8/4 14:30)');
  });

  it('저장된 언어와 화면 언어가 같으면 제목이 그대로다', () => {
    expect([
      resolveConversationTitle('CASE-042 임상 참고 (1/9 9:05)', 'ko', 'PATIENT_GUIDANCE'),
      resolveConversationTitle(
        'CASE-042 Clinical guidance (1/9 9:05)',
        'en',
        'PATIENT_GUIDANCE',
      ),
    ]).toEqual(['CASE-042 임상 참고 (1/9 9:05)', 'CASE-042 Clinical guidance (1/9 9:05)']);
  });

  it('케이스 라벨과 시각은 그 사람의 데이터라 라벨만 바꾸고 보존한다', () => {
    expect(
      resolveConversationTitle('외래 3번 환자 임상 참고 (12/25 0:00)', 'en', 'PATIENT_GUIDANCE'),
    ).toBe('외래 3번 환자 Clinical guidance (12/25 0:00)');
  });

  it('일반 질의 대화의 제목은 같은 모양이어도 건드리지 않는다', () => {
    expect(
      resolveConversationTitle('CASE-001 임상 참고 (8/4 14:30)', 'en', 'GUIDELINE_QA'),
    ).toBe('CASE-001 임상 참고 (8/4 14:30)');
  });

  it('대화의 성격을 모르면 저장된 제목을 그대로 둔다', () => {
    expect(resolveConversationTitle('CASE-001 임상 참고 (8/4 14:30)', 'en')).toBe(
      'CASE-001 임상 참고 (8/4 14:30)',
    );
  });

  it('사람이 손수 붙인 이름은 라벨이 들어 있어도 그대로 둔다', () => {
    expect([
      resolveConversationTitle('CASE-001 임상 참고 (재검토)', 'en', 'PATIENT_GUIDANCE'),
      resolveConversationTitle('CASE-001 임상 참고', 'en', 'PATIENT_GUIDANCE'),
      resolveConversationTitle('오늘 본 CASE-001 임상 참고 정리', 'en', 'PATIENT_GUIDANCE'),
    ]).toEqual([
      'CASE-001 임상 참고 (재검토)',
      'CASE-001 임상 참고',
      '오늘 본 CASE-001 임상 참고 정리',
    ]);
  });

  it('환자 맞춤 대화라도 첫 질문에서 굳은 제목은 번역하지 않는다', () => {
    expect(
      resolveConversationTitle(
        '만성 요통에 침 치료가 효과적인가요?',
        'en',
        'PATIENT_GUIDANCE',
      ),
    ).toBe('만성 요통에 침 치료가 효과적인가요?');
  });

  it('환자 맞춤 대화의 BE 기본 제목은 여전히 자리표시자로 치환한다', () => {
    expect(resolveConversationTitle('새 대화', 'en', 'PATIENT_GUIDANCE')).toBe(
      'New conversation',
    );
  });
});
