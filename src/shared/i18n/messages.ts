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

  // 근거 전문 (인용 패널·지침 상세·임상 참고안이 공유한다)
  fullTextLoading: '전문 불러오는 중…',
  fullTextError: '전문을 불러오지 못했습니다',
  recommendationHeading: '권고문 원문',
  excerptHeading: '본문 발췌',
  sourcePagePrefix: '원문 p.',
  viewSource: '원문 보기 (NCKM)',

  // 번역 경계 (스펙 판단표 「커버리지 밖 표시」)
  citationNotTranslated: '미번역',
  showKoreanOriginal: '한국어 원문 보기',
  hideKoreanOriginal: '한국어 원문 접기',

  // 앱 셸
  appTagline: '한의 임상 지침 어시스턴트',
  navAssistant: '어시스턴트',
  navGuidelines: '지침',
  navPatients: '환자',
  mainMenu: '주요 메뉴',
  closeSidebar: '사이드바 닫기',
  openSidebar: '사이드바 열기',
  myProfile: '내 프로필',
  logout: '로그아웃',
  /**
   * 언어 전환. 선택지 라벨(`한국어`·`English`)은 **번역하지 않는다** — 각 항목을 그 언어
   * 자체로 적어야 그 언어를 쓰는 사람이 자기 항목을 찾을 수 있다. 데모의 실제 시나리오가
   * 「한국어 로케일 노트북으로 영어권 방문자에게 시연」이라 이 성질이 결정적이다.
   */
  displayLanguage: '표시 언어',
  switchToKorean: '한국어로 전환',
  switchToEnglish: '영어로 전환',

  // 대화 목록
  newConversation: '새 대화',
  searchConversations: '대화 검색',
  searchByTitlePlaceholder: '제목으로 검색',
  search: '검색',
  archiveFilter: '보관 상태 필터',
  statusActive: '활성',
  statusArchived: '보관됨',
  statusAll: '전체',
  archivedSuffix: '보관됨',
  archivedParenthetical: '(보관됨)',
  undo: '되돌리기',
  loading: '불러오는 중…',
  listLoadError: '목록을 불러오지 못했습니다',
  conversationTitle: '대화 제목',
  cancel: '취소',
  save: '저장',
  rename: '이름 변경',
  archive: '보관',
  unarchive: '보관 해제',
  delete: '삭제',
  deletePermanentWarning: '영구 삭제됩니다. 되돌릴 수 없습니다.',
  deleteFailed: '삭제하지 못했습니다. 다시 시도해 주세요.',
  noSearchResults: '검색 결과가 없습니다',
  noConversations: '대화가 없습니다',
  showArchivedToo: '보관된 대화까지 보기',
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

  fullTextLoading: 'Loading full text…',
  fullTextError: 'Could not load the full text',
  recommendationHeading: 'Recommendation',
  excerptHeading: 'Excerpt',
  sourcePagePrefix: 'Source p.',
  viewSource: 'View source (NCKM)',

  citationNotTranslated: 'Not translated',
  showKoreanOriginal: 'Show Korean original',
  hideKoreanOriginal: 'Hide Korean original',

  appTagline: 'Korean medicine clinical guideline assistant',
  navAssistant: 'Assistant',
  navGuidelines: 'Guidelines',
  navPatients: 'Patients',
  mainMenu: 'Main menu',
  closeSidebar: 'Collapse sidebar',
  openSidebar: 'Expand sidebar',
  myProfile: 'My profile',
  logout: 'Log out',
  displayLanguage: 'Display language',
  switchToKorean: 'Switch to Korean',
  switchToEnglish: 'Switch to English',

  newConversation: 'New conversation',
  searchConversations: 'Search conversations',
  searchByTitlePlaceholder: 'Search by title',
  search: 'Search',
  archiveFilter: 'Archive filter',
  statusActive: 'Active',
  statusArchived: 'Archived',
  statusAll: 'All',
  archivedSuffix: 'archived',
  archivedParenthetical: '(archived)',
  undo: 'Undo',
  loading: 'Loading…',
  listLoadError: 'Could not load the list',
  conversationTitle: 'Conversation title',
  cancel: 'Cancel',
  save: 'Save',
  rename: 'Rename',
  archive: 'Archive',
  unarchive: 'Unarchive',
  delete: 'Delete',
  deletePermanentWarning: 'This will be deleted permanently. It cannot be undone.',
  deleteFailed: 'Could not delete. Please try again.',
  noSearchResults: 'No matching conversations',
  noConversations: 'No conversations yet',
  showArchivedToo: 'Include archived conversations',
};

export const UI_MESSAGES: Record<UiLang, Record<MessageKey, string>> = { ko, en };

export function messagesFor(lang: UiLang): Record<MessageKey, string> {
  return UI_MESSAGES[lang];
}
