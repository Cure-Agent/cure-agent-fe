/**
 * design-sync 번들 엔트리.
 *
 * 이 레포는 컴포넌트 라이브러리가 아니라 Next 앱이라 `dist/` 도 패키지 export 도 없다.
 * 컨버터에 `--entry` 로 이 파일을 넘겨서 (1) 패키지 루트를 레포 루트로 잡고
 * (2) window.CureAgentFe 에 실릴 export 집합을 여기서 명시적으로 정한다.
 *
 * 새 UI 컴포넌트를 동기화 대상에 넣으려면 여기에 export 를 추가하고
 * .design-sync/config.json 의 componentSrcMap 에도 같은 이름을 등록한다.
 */

// widgets
export { AppShell } from '../../src/widgets/app-shell/app-shell';
export {
  EvidenceInspector,
  type EvidenceInspectorProps,
  type EvidenceItem,
} from '../../src/widgets/evidence-inspector/evidence-inspector';

// features — auth
export { SocialLoginButtons } from '../../src/features/auth/ui/social-login-buttons';
export { OnboardingForm } from '../../src/features/auth/ui/onboarding-form';

// features — ask-guideline
export { ChatPanel, type ChatPanelProps } from '../../src/features/ask-guideline/ui/chat-panel';

// features — filter-guidelines
export {
  GuidelineListPanel,
  type GuidelineListPanelProps,
} from '../../src/features/filter-guidelines/ui/guideline-list-panel';
export {
  GuidelineDetailPanel,
  type GuidelineDetailPanelProps,
} from '../../src/features/filter-guidelines/ui/guideline-detail-panel';

// features — manage-conversation
export {
  ConversationList,
  type ConversationListProps,
} from '../../src/features/manage-conversation/ui/conversation-list';
export { HistoryPanel } from '../../src/features/manage-conversation/ui/history-panel';

// features — manage-patient
export {
  PatientCreateForm,
  type PatientCreateFormProps,
} from '../../src/features/manage-patient/ui/patient-create-form';
export {
  PatientListPanel,
  type PatientListPanelProps,
} from '../../src/features/manage-patient/ui/patient-list-panel';
export {
  PatientDetailPanel,
  type PatientDetailPanelProps,
} from '../../src/features/manage-patient/ui/patient-detail-panel';

// features — request/review clinical guidance
export {
  RequestGuidanceButton,
  type RequestGuidanceButtonProps,
} from '../../src/features/request-clinical-guidance/ui/request-guidance-button';
export {
  GuidanceCard,
  type GuidanceCardProps,
} from '../../src/features/review-clinical-guidance/ui/guidance-card';
