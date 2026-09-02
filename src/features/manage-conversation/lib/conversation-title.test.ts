import { describe, expect, it } from 'vitest';
import {
  BE_DEFAULT_CONVERSATION_TITLE,
  resolveConversationTitle,
} from './conversation-title';

describe('resolveConversationTitle 기본 제목 해석', () => {
  it('BE 기본 제목을 영문 화면의 New conversation으로 치환한다', () => {
    expect(resolveConversationTitle('새 대화', 'New conversation')).toBe('New conversation');
  });

  it('BE 기본 제목을 한국어 화면의 새 대화로 치환한다', () => {
    expect(resolveConversationTitle('새 대화', '새 대화')).toBe('새 대화');
  });

  it('질의에서 만들어진 한국어 제목은 영문 화면에서도 그대로 둔다', () => {
    const title = '만성 요통에 침 치료가 효과적인가요?';

    expect(resolveConversationTitle(title, 'New conversation')).toBe(
      '만성 요통에 침 치료가 효과적인가요?',
    );
  });

  it('질의에서 만들어진 영문 제목도 그대로 둔다', () => {
    const title = 'Is acupuncture effective for chronic low back pain?';

    expect(resolveConversationTitle(title, 'New conversation')).toBe(
      'Is acupuncture effective for chronic low back pain?',
    );
  });

  it('새 대화가 들어간 부분일치 제목은 치환하지 않는다', () => {
    expect([
      resolveConversationTitle('새 대화 정리', 'New conversation'),
      resolveConversationTitle('어제 새 대화', 'New conversation'),
    ]).toEqual(['새 대화 정리', '어제 새 대화']);
  });

  it('BE 기본 제목 앞뒤의 공백을 다듬거나 치환하지 않는다', () => {
    expect([
      resolveConversationTitle(' 새 대화', 'New conversation'),
      resolveConversationTitle('새 대화 ', 'New conversation'),
    ]).toEqual([' 새 대화', '새 대화 ']);
  });

  it('빈 문자열은 그대로 두고 정확한 BE 기본 제목만 자리표시자로 치환한다', () => {
    expect([
      resolveConversationTitle('', 'New conversation'),
      resolveConversationTitle('새 대화', 'New conversation'),
    ]).toEqual(['', 'New conversation']);
  });

  it('BE 기본 제목 상수는 정확히 새 대화이며 해석 함수의 치환 기준으로 쓰인다', () => {
    expect(BE_DEFAULT_CONVERSATION_TITLE).toBe('새 대화');
    expect(resolveConversationTitle(BE_DEFAULT_CONVERSATION_TITLE, 'New conversation')).toBe(
      'New conversation',
    );
  });
});
