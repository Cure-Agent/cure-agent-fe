/**
 * 고정 문구 ko/en 리소스 (BE docs/specs/42에서 시작해 앱 전체로 넓혔다).
 *
 * 키는 화면이 아니라 **문구의 역할**로 짓는다 — 같은 문장이 두 곳에 쓰이면 키도 하나여야
 * 한쪽만 고쳐지는 일이 없다.
 *
 * **여기 없는 것 셋**(의도적으로 남긴 한국어):
 * - `app/layout.tsx`·`app/manifest.ts`의 메타데이터 — 서버 렌더라 방문자의 선택(localStorage)을
 *   알 수 없다. 언어별 메타데이터가 필요해지면 URL에 언어를 실어야 하고, 그건 다른 결정이다
 * - `request-clinical-guidance/lib/guidance-title.ts` — **서버에 저장되는 제목**이라 화면 언어로
 *   바꾸면 같은 기록의 제목이 방문자마다 갈린다
 * - BE가 봉투에 실어 보내는 오류 문구 — 소유자가 BE다. FE는 봉투에 문구가 없을 때의
 *   폴백만 든다
 */
import { Fragment, type ReactNode, createElement } from 'react';
import type { UiLang } from './ui-lang';

/**
 * `{name}` 자리를 채운다.
 *
 * 보간이 필요한 문구를 조각으로 쪼개 이어붙이지 않는 이유는 **어순**이다 —
 * 「{label} 보관」과 「Archive {label}」은 순서가 반대라, 조각을 코드에서 이으면 한쪽 언어가
 * 반드시 어색해진다. 템플릿째 들고 있어야 각 언어가 자기 어순을 갖는다.
 */
export function formatMessage(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{${key}}`,
  );
}

/**
 * `formatMessage`의 노드판 — 자리에 **엘리먼트**를 끼운다.
 *
 * 문장 속 이름을 `<strong>`이나 `font-medium`으로 강조하는 자리가 여럿인데, 문자열
 * 보간으로는 그 강조가 사라진다. 그렇다고 문장을 「앞조각 + 이름 + 뒷조각」으로 쪼개면
 * 어순이 다른 언어에서 무너진다 — 템플릿은 통째로 두고 **자리만 노드로** 채운다.
 */
export function formatMessageNodes(
  template: string,
  params: Record<string, ReactNode>,
): ReactNode {
  const parts = template.split(/(\{\w+\})/);
  return createElement(
    Fragment,
    null,
    ...parts.map((part, index) => {
      const matched = /^\{(\w+)\}$/.exec(part);
      return matched && matched[1] in params
        ? createElement(Fragment, { key: index }, params[matched[1]])
        : part;
    }),
  );
}

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
  /**
   * 이어받을 스트림 없이 연 화면(새로고침·다른 탭)이 진행 중인 답변을 만났을 때.
   * 어느 단계인지 알 수 없으므로 `retrievingEvidence`를 재사용하지 않는다 — 근거 검색이
   * 이미 끝난 답변에도 「검색하는 중」이라 쓰면 틀린 말이 된다.
   */
  answerInProgress: '답변을 생성하는 중…',
  /** 위 상태로 너무 오래된 답변 — 실패라고 단정하지 않는다(서버는 방금 끝냈을 수도 있다) */
  answerNotArrived: '답변이 아직 도착하지 않았습니다.',
  checkAgain: '다시 확인',
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
  // 「한국어 원문 보기」 토글은 §44가 없앴다 — 정본 도달은 `viewSource` 링크가 진다
  citationNotTranslated: '미번역',

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

  // 공통
  loadFailed: '목록을 불러오지 못했습니다',
  confirmingSession: '세션 확인 중…',
  showMore: '더 보기',
  copy: '복사',
  copied: '복사됨',
  login: '로그인',
  collapse: '접기',
  malformedResponse: '응답 형식이 올바르지 않습니다.',
  streamConnectFailed: '스트림 연결에 실패했습니다.',
  streamBodyMissing: '스트림 본문이 없습니다.',
  genericError: '오류가 발생했습니다.',

  // 환자
  patients: '환자',
  patientsHeading: '환자',
  patientListBack: '환자 목록',
  newPatient: '새 환자 등록',
  backToList: '목록으로',
  searchPatients: '환자 검색',
  searchPatientsPlaceholder: '케이스 라벨 검색 (예: CASE-001)',
  patientLoadFailed: '환자 정보를 불러오지 못했습니다',
  patientDeleted: '삭제했습니다. 목록으로 이동합니다…',
  deletePatient: '환자 삭제',
  deleteWithLabel: '{label} 삭제',
  archiveWithLabel: '{label} 보관',
  unarchiveWithLabel: '{label} 보관 해제',
  archivedWithLabel: '{label} 보관됨',
  deletePatientWarning: '이 환자의 대화까지 영구 삭제됩니다. 되돌릴 수 없습니다.',
  ageYears: '{age}세',
  archivedSeparator: ' · 보관됨',
  editProfile: '프로필 수정',
  caseLabel: '케이스 라벨',
  caseLabelPlaceholder: 'CASE-001 (비식별 라벨)',
  birthYear: '출생연도',
  sex: '성별',
  sexUnset: '선택 안 함',
  sexMale: '남',
  sexFemale: '여',
  sexOther: '기타',
  sexUnknown: '미상',
  heightCm: '신장(cm)',
  weightKg: '체중(kg)',
  diagnosesCommaSeparated: '진단(쉼표 구분)',
  diagnosesPlaceholder: '만성 요통, 고혈압',
  medicationsCommaSeparated: '복용약(쉼표 구분)',
  allergiesCommaSeparated: '알레르기(쉼표 구분)',
  clinicalNote: '임상 메모',
  register: '등록',
  registerFailed: '등록에 실패했습니다.',
  saveFailed: '저장에 실패했습니다.',
  requestFailed: '요청에 실패했습니다.',

  // 한의원 구성원·초대
  membersHeading: '함께 일하는 사람',
  handOverOwnership: '개설자 권한 넘기기',
  membersLoadFailed: '구성원을 불러오지 못했습니다.',
  handOverFailed: '권한을 넘기지 못했습니다.',
  removeFailed: '내보내지 못했습니다.',
  handedOverNotice:
    '{name}님에게 개설자 권한을 넘겼습니다. 이제 초대 발급과 다음 이양은 그 구성원의 몫입니다.',
  removedNotice: '{name}님을 내보냈습니다. 다시 초대하면 같은 계정으로 돌아옵니다.',
  self: '나',
  owner: '개설자',
  joinedOn: '{date} 합류',
  remove: '내보내기',
  removeWithName: '{name}님 내보내기',
  removeConfirm: '{name}님을 내보냅니다.',
  removeKeepsAccount: '계정과 이름·이메일·면허번호는 그대로 남습니다 — 탈퇴와 다릅니다.',
  removeKeepsRecords: '이 구성원이 만든 환자·대화 기록은 한의원에 남습니다.',
  removeRevokesInvites: '이 구성원이 발급한 미사용 초대 링크가 함께 취소됩니다.',
  removeLogsOut: '모든 기기에서 로그아웃되며, 다시 초대하면 같은 계정으로 돌아옵니다.',
  handOverTarget: '개설자 권한을 넘길 구성원',
  handOverWarning:
    '넘기고 나면 초대 발급과 다음 이양은 그 구성원만 할 수 있습니다. 되돌리려면 새 개설자가 다시 넘겨줘야 합니다.',
  handOver: '권한 넘기기',
  invitationsHeading: '초대',
  invitationsLead: '링크를 만들어 직접 전달하면 그 사람이 우리 한의원으로 가입합니다.',
  createInvitation: '초대 링크 만들기',
  createInvitationFailed: '초대 링크를 만들지 못했습니다.',
  invitationOnceOnly:
    '지금만 확인할 수 있는 링크입니다 — 화면을 벗어나면 다시 볼 수 없어 새로 발급해야 합니다.',
  invitationLink: '초대 링크',
  invitationValidUntil: '{date}까지 유효하며 한 번만 사용할 수 있습니다.',
  invitationsLoadFailed: '초대 목록을 불러오지 못했습니다.',
  noInvitations: '아직 보낸 초대가 없습니다.',
  invitationAcceptedBy: '{name} 합류',
  invitationUntil: '{date}까지',
  invitationIssuedOn: ' · {date} 발급',
  invitationPending: '대기 중',
  invitationAccepted: '합류함',
  invitationRevoked: '취소됨',
  invitationExpired: '만료됨',
  checkingInvitation: '초대 확인 중…',
  invitationInvalid: '유효하지 않거나 만료된 초대 링크입니다. 개설자에게 새 링크를 요청해주세요.',
  haveAccount: '계정이 있으신가요?',
  invitedByClinic: '{clinic}에서 함께 일하자고 초대했습니다.',
  loginLeadsToSignup: '로그인하면 가입 절차로 이어집니다.',
  joinSharesRecords: '합류하면 한의원의 환자·대화 기록을 구성원과 함께 보게 됩니다.',
  joinBlockedIfInClinic: '이미 다른 한의원에 소속된 계정은 합류할 수 없습니다.',

  // 계정·가입
  appTaglineShort: '한의 임상 지침 어시스턴트',
  loginLeadIn: '처음 로그인하면 한의원 정보를 입력하는 가입 절차로 이어집니다.',
  signupHeading: '의료인 가입',
  signupLead: '소셜 인증이 확인되었습니다. 한의원 정보만 입력하면 가입이 완료됩니다.',
  useAnotherAccount: '다른 계정으로 하시겠어요?',
  backToLogin: '로그인으로 돌아가기',
  socialLoginStart: '간편 로그인으로 시작하기',
  socialLoginLoading: '로그인 수단 확인 중…',
  socialLoginLoadFailed: '로그인 수단을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.',
  socialLoginNone: '사용 가능한 소셜 로그인이 없습니다. 관리자에게 문의해주세요.',
  loginWithGoogle: 'Google로 로그인',
  loginWithKakao: '카카오 로그인',
  loginWithNaver: '네이버 로그인',
  authOauthDenied: '소셜 로그인이 취소되었습니다.',
  authOauthStateMismatch: '로그인 요청이 만료되었습니다. 다시 시도해주세요.',
  authOauthEmailMissing: '가입에는 이메일이 필요합니다. 이메일 제공에 동의해주세요.',
  authOauthProviderUnsupported: '지원하지 않는 소셜 로그인입니다.',
  authOauthTicketInvalid: '가입 정보가 만료되었습니다. 다시 로그인해주세요.',
  authOauthFailed: '소셜 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.',
  loginFailed: '로그인에 실패했습니다. 다시 시도해주세요.',
  joiningClinic: '{clinic}에 합류합니다',
  joinInviteSharesRecords: '초대로 가입하면 한의원의 환자·대화 기록을 구성원과 함께 보게 됩니다.',
  inviteExpiredCreateClinic:
    '초대 링크가 만료되었거나 이미 사용되었습니다. 개설자에게 새 링크를 요청하거나, 아래에서 새 한의원을 개설할 수 있습니다.',
  displayName: '이름',
  clinicName: '한의원명',
  licenseNumber: '면허번호',
  licenseEncrypted: '암호화되어 저장되며, 면허 확인은 별도 진행됩니다.',
  agreeToTerms: '서비스 이용약관에 동의합니다',
  loginAgain: '다시 로그인',
  join: '합류하기',
  completeSignup: '가입 완료',
  signupFailed: '가입에 실패했습니다.',
  profileHeading: '프로필',
  fieldEmail: '이메일',
  fieldClinic: '소속',
  fieldLicenseVerification: '면허 인증',
  verificationPending: '확인 중',
  verificationVerified: '인증 완료',
  verificationRejected: '인증 반려',
  deleteAccount: '계정 삭제',
  withdrawLead:
    '탈퇴하면 이름·이메일·면허번호가 즉시 삭제되고 모든 기기에서 로그아웃됩니다. 되돌릴 수 없습니다.',
  withdraw: '회원탈퇴',
  withdrawConfirm: '정말 탈퇴하시겠습니까?',
  withdrawErasesIdentity: '이름·이메일·면허번호가 즉시 삭제됩니다.',
  withdrawCheckingMembers: '한의원 구성원을 확인하는 중입니다…',
  withdrawLastMemberPrefix: '한의원의 마지막 구성원이라 ',
  withdrawLastMemberEmphasis: '환자·대화 기록이 모두 함께 삭제',
  withdrawLastMemberSuffix: '됩니다.',
  withdrawRecordsStay: '환자·대화 기록은 한의원의 자산이라 남은 구성원에게 그대로 남습니다.',
  withdrawMembersUnknown:
    '구성원 정보를 확인하지 못했습니다. 남은 구성원이 없다면 환자·대화 기록도 함께 삭제됩니다.',
  withdrawRejoinNotLinked: '같은 소셜 계정으로 새로 가입할 수 있지만, 이전 기록과는 이어지지 않습니다.',
  withdrawOwnerBlockedPrefix: '위 「함께 일하는 사람」에서 ',
  withdrawOwnerBlockedEmphasis: '개설자 권한 넘기기',
  withdrawOwnerBlockedSuffix: '로 다른 구성원에게 권한을 넘긴 뒤 다시 시도해주세요.',
  withdrawSubmit: '탈퇴하기',
  withdrawFailed: '탈퇴에 실패했습니다.',
  withdrawn: '탈퇴했습니다. 로그인 화면으로 이동합니다…',

  // 지침 탐색
  guidelinesHeading: '지침 탐색',
  guidelineListBack: '지침 목록',
  searchGuidelines: '지침 검색',
  searchGuidelinesPlaceholder: '지침 제목 검색 (예: 요통)',
  guidelineLoadFailed: '지침을 불러오지 못했습니다',
  supersededNotice: '구판 — 최신 버전 아님',
  sectionsAndRecommendations: '섹션·권고문',
  recommendationNo: '권고 {number}',
  gradeSuffix: ' · 등급 {code} ({label})',
  evidenceLevelSuffix: ' · 근거수준 {code}',
  recommendationGradeLine: '권고등급 {code} ({label})',

  // 임상 참고안
  guidanceHeading: '임상 참고안',
  guidanceLoading: '임상 참고안 불러오는 중…',
  guidanceLoadFailed: '임상 참고안을 불러오지 못했습니다',
  guidanceReviewItems: '검토 항목',
  guidancePatientEvidence: '환자 근거',
  guidanceSafetyWarnings: '안전 경고',
  guidanceMissingInformation: '누락 정보',
  guidanceClinicianReview: '의료인 검토',
  guidanceReviewComment: '검토 의견',
  guidanceReviewSubmit: '검토 확정',
  guidanceReviewFailed: '검토 처리에 실패했습니다.',
  guidanceStatusDraft: '검토 대기',
  guidanceStatusAccepted: '승인됨',
  guidanceStatusModified: '수정 반영',
  guidanceStatusRejected: '반려됨',
  guidanceDecisionAccept: '승인',
  guidanceDecisionModify: '수정',
  guidanceDecisionReject: '반려',
  applicabilityApplicable: '적용',
  applicabilityCaution: '주의',
  applicabilityNotApplicable: '해당없음',

  // 환자 프로필 필드명 — BE가 `patientFactors`·`missingInformation`에 싣는 닫힌 어휘 9개
  // (BE `guidance-profile-fields.ts`). 한국어는 BE가 보내는 문자열과 **한 글자도 다르지 않게**
  // 둔다 — 매핑이 어긋나 폴백으로 떨어져도 한국어 화면이 오늘과 같아야 한다.
  profileFieldBirthYear: '출생연도',
  profileFieldSex: '성별',
  profileFieldHeight: '신장',
  profileFieldWeight: '체중',
  profileFieldWaist: '허리둘레',
  profileFieldDiagnoses: '진단명',
  profileFieldMedications: '투약 목록',
  profileFieldAllergies: '알레르기 이력',
  profileFieldClinicalNotes: '임상 메모',

  startPatientConversation: '환자 맞춤 대화 시작',
  startPatientConversationFailed: '환자 맞춤 대화 생성에 실패했습니다.',
  pickConversationOrStart: '왼쪽에서 대화를 선택하거나 새 대화를 시작하세요',

  // 온보딩 둘러보기 (features/onboarding-tour)
  // 단계 문구는 「무엇을 누르는지」와 「그래서 무엇이 일어나는지」를 한 문장씩 나눠 든다 —
  // 앞만 있으면 시키는 대로 누르기만 하고, 뒤만 있으면 어디를 눌러야 할지 모른다
  tourWelcomeHeading: 'Cure Agent 시작하기',
  tourWelcomeLead: '두 가지 경로를 먼저 둘러보세요. 각 단계에서 누를 곳을 화면에서 짚어 드립니다.',
  tourWelcomeDismiss: '나중에 하기',
  tourClose: '둘러보기 닫기',
  tourSkip: '건너뛰기',
  tourDone: '닫기',
  tourStepCount: '{count}단계',
  tourProgress: '{current}/{total}',
  tourGoToAssistant: '어시스턴트로 이동',
  tourGoToPatients: '환자 화면으로 이동',

  tourPathGeneralTitle: '지침에 바로 질문하기',
  tourPathGeneralLead: '새 대화를 만들고 예시 질의문으로 첫 답변을 받아 봅니다.',
  tourPathGeneralName: '일반 질의',
  tourPathPatientTitle: '가상 환자로 맞춤 답변 받기',
  tourPathPatientLead: '등록된 환자를 골라 그 환자의 프로필이 실린 임상 참고안까지 받아 봅니다.',
  tourPathPatientName: '환자 맞춤 질의',

  tourGeneralStep1Title: '새 대화 만들기',
  tourGeneralStep1Body: '왼쪽 목록 맨 위의 「새 대화」를 누르세요.',
  tourGeneralStep2Title: '예시 질의문 고르기',
  tourGeneralStep2Body:
    '입력창 위에 뜬 예시를 누르면 문장이 입력창에 담깁니다. 그대로 두어도 되고 고쳐 써도 됩니다.',
  tourGeneralStep3Title: '질문 보내기',
  tourGeneralStep3Body: '「전송」을 누르면 지침에서 근거를 찾아 답변합니다.',
  tourGeneralStep4Title: '답변과 근거 확인',
  tourGeneralStep4Body:
    '답변 아래의 [1] 같은 인용 번호를 누르면 오른쪽 패널이 그 지침 원문을 펴서 보여줍니다.',

  tourPatientStep1Title: '환자 화면 열기',
  tourPatientStep1Body: '왼쪽 사이드바의 「환자」를 누르세요.',
  tourPatientStep2Title: '환자 고르기',
  tourPatientStep2Body: '목록에서 환자를 하나 누르면 진단·투약이 담긴 상세가 열립니다.',
  tourPatientStep3Title: '환자 맞춤 대화 시작',
  tourPatientStep3Body:
    '상세 오른쪽 위의 「환자 맞춤 대화 시작」을 누르면 이 환자 전용 대화가 만들어집니다.',
  tourPatientStep4Title: '예시 질의문 고르기',
  tourPatientStep4Body: '이 환자의 진단에 맞춘 예시가 뜹니다. 눌러서 입력창에 담으세요.',
  tourPatientStep5Title: '질문 보내기',
  tourPatientStep5Body:
    '「전송」을 누르면 이 환자의 진단·투약·알레르기가 질문에 함께 실려 나갑니다.',
  tourPatientStep6Title: '환자 맞춤 답변 확인',
  tourPatientStep6Body:
    '답변과 함께 「임상 참고안」 카드가 뜹니다 — 검토 항목·안전 경고·누락 정보를 확인하세요.',

  tourFinishedHeading: '둘러보기를 마쳤습니다',
  tourFinishedGeneralNext: '이번엔 가상 환자로 맞춤 답변을 받아 볼까요?',
  tourFinishedPatientNext: '이번엔 지침에 바로 질문해 볼까요?',
  tourStartOtherPath: '이어서 해보기',
  tourRestartHeading: '시작 가이드',
  tourRestartHint: '두 가지 사용 경로를 화면에서 처음부터 다시 안내합니다.',
  tourRestart: '시작 가이드 다시 보기',
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
  answerInProgress: 'Generating the answer…',
  answerNotArrived: 'The answer has not arrived yet.',
  checkAgain: 'Check again',
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

  loadFailed: 'Could not load the list',
  confirmingSession: 'Checking your session…',
  showMore: 'Show more',
  copy: 'Copy',
  copied: 'Copied',
  login: 'Log in',
  collapse: 'Collapse',
  malformedResponse: 'The response was not in the expected format.',
  streamConnectFailed: 'Could not connect to the stream.',
  streamBodyMissing: 'The stream had no body.',
  genericError: 'Something went wrong.',

  patients: 'Patients',
  patientsHeading: 'Patients',
  patientListBack: 'Patient list',
  newPatient: 'Register patient',
  backToList: 'Back to list',
  searchPatients: 'Search patients',
  searchPatientsPlaceholder: 'Search by case label (e.g. CASE-001)',
  patientLoadFailed: 'Could not load the patient',
  patientDeleted: 'Deleted. Returning to the list…',
  deletePatient: 'Delete patient',
  deleteWithLabel: 'Delete {label}',
  archiveWithLabel: 'Archive {label}',
  unarchiveWithLabel: 'Unarchive {label}',
  archivedWithLabel: '{label} archived',
  deletePatientWarning:
    "This patient's conversations will also be deleted permanently. This cannot be undone.",
  ageYears: '{age} yrs',
  archivedSeparator: ' · Archived',
  editProfile: 'Edit profile',
  caseLabel: 'Case label',
  caseLabelPlaceholder: 'CASE-001 (de-identified label)',
  birthYear: 'Year of birth',
  sex: 'Sex',
  sexUnset: 'Not specified',
  sexMale: 'Male',
  sexFemale: 'Female',
  sexOther: 'Other',
  sexUnknown: 'Unknown',
  heightCm: 'Height (cm)',
  weightKg: 'Weight (kg)',
  diagnosesCommaSeparated: 'Diagnoses (comma separated)',
  diagnosesPlaceholder: 'Chronic low back pain, hypertension',
  medicationsCommaSeparated: 'Medications (comma separated)',
  allergiesCommaSeparated: 'Allergies (comma separated)',
  clinicalNote: 'Clinical note',
  register: 'Register',
  registerFailed: 'Could not register.',
  saveFailed: 'Could not save.',
  requestFailed: 'The request failed.',

  membersHeading: 'People you work with',
  handOverOwnership: 'Transfer ownership',
  membersLoadFailed: 'Could not load the members.',
  handOverFailed: 'Could not transfer ownership.',
  removeFailed: 'Could not remove the member.',
  handedOverNotice:
    'Ownership was transferred to {name}. Issuing invitations and any further transfer are now theirs to do.',
  removedNotice: '{name} was removed. Inviting them again brings back the same account.',
  self: 'You',
  owner: 'Owner',
  joinedOn: 'Joined {date}',
  remove: 'Remove',
  removeWithName: 'Remove {name}',
  removeConfirm: 'Remove {name} from this clinic.',
  removeKeepsAccount:
    'Their account, name, email and license number stay — this is not account deletion.',
  removeKeepsRecords: 'Patients and conversations they created stay with the clinic.',
  removeRevokesInvites: 'Unused invitation links they issued are revoked along with this.',
  removeLogsOut: 'They are logged out everywhere; inviting them again brings back the same account.',
  handOverTarget: 'Member to transfer ownership to',
  handOverWarning:
    'After the transfer, only that member can issue invitations or transfer again. To reverse it, the new owner has to transfer it back.',
  handOver: 'Transfer',
  invitationsHeading: 'Invitations',
  invitationsLead: 'Create a link and pass it on — whoever opens it joins this clinic.',
  createInvitation: 'Create invitation link',
  createInvitationFailed: 'Could not create the invitation link.',
  invitationOnceOnly:
    'This link is shown only now — once you leave this screen you cannot see it again and will have to issue a new one.',
  invitationLink: 'Invitation link',
  invitationValidUntil: 'Valid until {date} and usable once.',
  invitationsLoadFailed: 'Could not load the invitations.',
  noInvitations: 'No invitations sent yet.',
  invitationAcceptedBy: '{name} joined',
  invitationUntil: 'Until {date}',
  invitationIssuedOn: ' · Issued {date}',
  invitationPending: 'Pending',
  invitationAccepted: 'Joined',
  invitationRevoked: 'Revoked',
  invitationExpired: 'Expired',
  checkingInvitation: 'Checking the invitation…',
  invitationInvalid:
    'This invitation link is invalid or has expired. Ask the clinic owner for a new one.',
  haveAccount: 'Already have an account?',
  invitedByClinic: '{clinic} invited you to work together.',
  loginLeadsToSignup: 'Logging in takes you through sign-up.',
  joinSharesRecords: "Joining means sharing the clinic's patients and conversations with its members.",
  joinBlockedIfInClinic: 'An account that already belongs to another clinic cannot join.',

  appTaglineShort: 'Korean medicine clinical guideline assistant',
  loginLeadIn: 'The first time you log in, you go through sign-up to enter your clinic details.',
  signupHeading: 'Clinician sign-up',
  signupLead: 'Your social account is verified. Enter your clinic details to finish signing up.',
  useAnotherAccount: 'Want to use a different account?',
  backToLogin: 'Back to login',
  socialLoginStart: 'Start with social login',
  socialLoginLoading: 'Loading login options…',
  socialLoginLoadFailed: 'Could not load the login options. Refresh and try again.',
  socialLoginNone: 'No social login is available. Please contact an administrator.',
  loginWithGoogle: 'Log in with Google',
  loginWithKakao: 'Log in with Kakao',
  loginWithNaver: 'Log in with Naver',
  authOauthDenied: 'Social login was cancelled.',
  authOauthStateMismatch: 'The login request expired. Please try again.',
  authOauthEmailMissing: 'Signing up needs an email. Please allow sharing your email.',
  authOauthProviderUnsupported: 'That social login is not supported.',
  authOauthTicketInvalid: 'Your sign-up session expired. Please log in again.',
  authOauthFailed: 'Social login failed. Please try again in a moment.',
  loginFailed: 'Login failed. Please try again.',
  joiningClinic: 'Joining {clinic}',
  joinInviteSharesRecords:
    "Signing up through an invitation means sharing the clinic's patients and conversations with its members.",
  inviteExpiredCreateClinic:
    'This invitation link has expired or was already used. Ask the owner for a new one, or open a new clinic below.',
  displayName: 'Name',
  clinicName: 'Clinic name',
  licenseNumber: 'License number',
  licenseEncrypted: 'Stored encrypted; license verification is handled separately.',
  agreeToTerms: 'I agree to the terms of service',
  loginAgain: 'Log in again',
  join: 'Join',
  completeSignup: 'Complete sign-up',
  signupFailed: 'Sign-up failed.',
  profileHeading: 'Profile',
  fieldEmail: 'Email',
  fieldClinic: 'Clinic',
  fieldLicenseVerification: 'License verification',
  verificationPending: 'Pending',
  verificationVerified: 'Verified',
  verificationRejected: 'Rejected',
  deleteAccount: 'Delete account',
  withdrawLead:
    'Deleting your account erases your name, email and license number immediately and logs you out everywhere. This cannot be undone.',
  withdraw: 'Delete account',
  withdrawConfirm: 'Delete your account?',
  withdrawErasesIdentity: 'Your name, email and license number are erased immediately.',
  withdrawCheckingMembers: 'Checking the clinic members…',
  withdrawLastMemberPrefix: "You are the clinic's last member, so ",
  withdrawLastMemberEmphasis: 'all patients and conversations are deleted with it',
  withdrawLastMemberSuffix: '.',
  withdrawRecordsStay:
    "Patients and conversations belong to the clinic and stay with the remaining members.",
  withdrawMembersUnknown:
    'Could not check the members. If none remain, patients and conversations are deleted too.',
  withdrawRejoinNotLinked:
    'You can sign up again with the same social account, but it will not be linked to your previous records.',
  withdrawOwnerBlockedPrefix: 'Use ',
  withdrawOwnerBlockedEmphasis: 'Transfer ownership',
  withdrawOwnerBlockedSuffix:
    ' under “People you work with” above to hand ownership to another member, then try again.',
  withdrawSubmit: 'Delete my account',
  withdrawFailed: 'Could not delete the account.',
  withdrawn: 'Account deleted. Returning to the login screen…',

  guidelinesHeading: 'Browse guidelines',
  guidelineListBack: 'Guideline list',
  searchGuidelines: 'Search guidelines',
  searchGuidelinesPlaceholder: 'Search guideline titles (e.g. low back pain)',
  guidelineLoadFailed: 'Could not load the guideline',
  supersededNotice: 'Superseded — not the latest version',
  sectionsAndRecommendations: 'Sections and recommendations',
  recommendationNo: 'Recommendation {number}',
  gradeSuffix: ' · Grade {code} ({label})',
  evidenceLevelSuffix: ' · Evidence level {code}',
  recommendationGradeLine: 'Recommendation grade {code} ({label})',

  guidanceHeading: 'Clinical guidance draft',
  guidanceLoading: 'Loading the clinical guidance draft…',
  guidanceLoadFailed: 'Could not load the clinical guidance draft',
  guidanceReviewItems: 'Review items',
  guidancePatientEvidence: 'Patient evidence',
  guidanceSafetyWarnings: 'Safety warnings',
  guidanceMissingInformation: 'Missing information',
  guidanceClinicianReview: 'Clinician review',
  guidanceReviewComment: 'Review comment',
  guidanceReviewSubmit: 'Submit review',
  guidanceReviewFailed: 'Could not submit the review.',
  guidanceStatusDraft: 'Awaiting review',
  guidanceStatusAccepted: 'Accepted',
  guidanceStatusModified: 'Modified',
  guidanceStatusRejected: 'Rejected',
  guidanceDecisionAccept: 'Accept',
  guidanceDecisionModify: 'Modify',
  guidanceDecisionReject: 'Reject',
  applicabilityApplicable: 'Applicable',
  applicabilityCaution: 'Caution',
  applicabilityNotApplicable: 'Not applicable',

  profileFieldBirthYear: 'Year of birth',
  profileFieldSex: 'Sex',
  profileFieldHeight: 'Height',
  profileFieldWeight: 'Weight',
  profileFieldWaist: 'Waist circumference',
  profileFieldDiagnoses: 'Diagnoses',
  profileFieldMedications: 'Medications',
  profileFieldAllergies: 'Allergy history',
  profileFieldClinicalNotes: 'Clinical note',

  startPatientConversation: 'Start patient-specific conversation',
  startPatientConversationFailed: 'Could not start the patient-specific conversation.',
  pickConversationOrStart: 'Pick a conversation on the left, or start a new one',

  tourWelcomeHeading: 'Get started with Cure Agent',
  tourWelcomeLead: 'Take one of the two walkthroughs — each step points at what to click.',
  tourWelcomeDismiss: 'Maybe later',
  tourClose: 'Close the walkthrough',
  tourSkip: 'Skip',
  tourDone: 'Close',
  tourStepCount: '{count} steps',
  tourProgress: '{current}/{total}',
  tourGoToAssistant: 'Go to Assistant',
  tourGoToPatients: 'Go to Patients',

  tourPathGeneralTitle: 'Ask the guidelines directly',
  tourPathGeneralLead:
    'Start a conversation and get your first answer from one of the example questions.',
  tourPathGeneralName: 'Guideline Q&A',
  tourPathPatientTitle: 'Get patient-specific answers',
  tourPathPatientLead:
    'Pick a registered patient and get clinical guidance built on that patient’s profile.',
  tourPathPatientName: 'Patient-specific',

  tourGeneralStep1Title: 'Start a new conversation',
  tourGeneralStep1Body: 'Click “New conversation” at the top of the list on the left.',
  tourGeneralStep2Title: 'Pick an example question',
  tourGeneralStep2Body:
    'Click one of the examples above the input box — it fills the box, and you can edit it before sending.',
  tourGeneralStep3Title: 'Send the question',
  tourGeneralStep3Body: 'Click “Send” and the assistant searches the guidelines for evidence.',
  tourGeneralStep4Title: 'Read the answer and its evidence',
  tourGeneralStep4Body:
    'Click a citation number like [1] under the answer and the right-hand panel opens that guideline passage.',

  tourPatientStep1Title: 'Open the Patients screen',
  tourPatientStep1Body: 'Click “Patients” in the left sidebar.',
  tourPatientStep2Title: 'Pick a patient',
  tourPatientStep2Body:
    'Click a patient in the list to open the record with diagnoses and medications.',
  tourPatientStep3Title: 'Start a patient-specific conversation',
  tourPatientStep3Body:
    'Click “Start patient-specific conversation” at the top right of the record to create a conversation for this patient.',
  tourPatientStep4Title: 'Pick an example question',
  tourPatientStep4Body:
    'The examples are matched to this patient’s diagnosis. Click one to fill the input box.',
  tourPatientStep5Title: 'Send the question',
  tourPatientStep5Body:
    'Click “Send” — this patient’s diagnoses, medications and allergies go out with the question.',
  tourPatientStep6Title: 'Read the patient-specific answer',
  tourPatientStep6Body:
    'A “Clinical guidance” card appears with the answer — check the review items, safety alerts and missing information.',

  tourFinishedHeading: 'Walkthrough complete',
  tourFinishedGeneralNext: 'Want to try patient-specific answers next?',
  tourFinishedPatientNext: 'Want to try asking the guidelines directly next?',
  tourStartOtherPath: 'Try that next',
  tourRestartHeading: 'Getting-started walkthrough',
  tourRestartHint: 'Walks you through both paths on screen again, from the start.',
  tourRestart: 'Replay the walkthrough',
};

export const UI_MESSAGES: Record<UiLang, Record<MessageKey, string>> = { ko, en };

export function messagesFor(lang: UiLang): Record<MessageKey, string> {
  return UI_MESSAGES[lang];
}
