/**
 * 고정 문구 ko/en 리소스 (BE docs/specs/42).
 *
 * **대상은 지침 질의 경로다** — 대화 패널(`ask-guideline`)과 인용 근거 패널
 * (`widgets/evidence-inspector`). 영어권 방문자가 밟는 경로가 「질문 → 답변 → 근거 대조」이고,
 * 스펙이 파는 것도 그 대조 가능성이라 문구 번역의 경계를 거기에 맞춘다.
 *
 * 키는 화면이 아니라 **문구의 역할**로 짓는다 — 같은 문장이 두 곳에 쓰이면 키도 하나여야
 * 한쪽만 고쳐지는 일이 없다.
 */
import type { UiLang } from './ui-lang';

const ko = {
  // 대화 패널
  suggestedPromptsHeading: '이렇게 질문해 보세요',
  suggestedPromptsListLabel: '예시 질의문',
  questionInputLabel: '질문 입력',
  questionInputPlaceholder: '지침에 대해 질문하세요 (예: 만성 요통에 침 치료가 효과적인가요?)',
  send: '전송',
  retry: '다시 시도',
  loadingOlderMessages: '이전 대화를 불러오는 중…',
  retrievingEvidence: '지침 근거를 검색하는 중…',
  abstainedNotice: '검색 조건에 해당하는 지침 근거를 찾지 못해 답변을 보류했습니다.',
  streamDisconnected: '답변이 완료되기 전에 연결이 끊겼습니다.',
  streamAborted: '스트림이 중단되었습니다.',

  // 인용 근거 패널
  evidencePanelHeading: '인용 근거',
  evidencePanelEmpty: '질문하면 답변에 인용된 지침 근거가 여기에 표시됩니다.',
  showFullText: '전문 보기',
  hideFullText: '접기',

  // 번역 경계 (스펙 판단표 「커버리지 밖 표시」)
  citationNotTranslated: '미번역',
  showKoreanOriginal: '한국어 원문 보기',
  hideKoreanOriginal: '한국어 원문 접기',
} as const;

export type MessageKey = keyof typeof ko;

const en: Record<MessageKey, string> = {
  suggestedPromptsHeading: 'Try asking',
  suggestedPromptsListLabel: 'Example questions',
  questionInputLabel: 'Question',
  questionInputPlaceholder:
    'Ask about the guidelines (e.g. Is acupuncture effective for chronic low back pain?)',
  send: 'Send',
  retry: 'Try again',
  loadingOlderMessages: 'Loading earlier messages…',
  retrievingEvidence: 'Searching the guidelines for evidence…',
  abstainedNotice:
    'No guideline evidence matched this question, so the answer was withheld.',
  streamDisconnected: 'The connection dropped before the answer finished.',
  streamAborted: 'The stream was interrupted.',

  evidencePanelHeading: 'Cited evidence',
  evidencePanelEmpty: 'Ask a question and the guideline evidence cited in the answer appears here.',
  showFullText: 'Show full text',
  hideFullText: 'Collapse',

  citationNotTranslated: 'Not translated',
  showKoreanOriginal: 'Show Korean original',
  hideKoreanOriginal: 'Hide Korean original',
};

export const UI_MESSAGES: Record<UiLang, Record<MessageKey, string>> = { ko, en };

export function messagesFor(lang: UiLang): Record<MessageKey, string> {
  return UI_MESSAGES[lang];
}
