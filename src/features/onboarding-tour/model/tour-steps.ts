/**
 * 온보딩 둘러보기의 두 경로와 각 단계.
 *
 * 이 앱의 첫 화면은 빈 대화 목록과 빈 입력창이라, 처음 들어온 사람에게는 **무엇부터 눌러야
 * 하는지**가 보이지 않는다. 예시 질의문(`ask-guideline/lib/suggested-prompts`)이 「무엇을
 * 물을지」는 이미 해결했지만, 그 예시가 뜨는 자리까지 가는 길은 아직 아무도 알려주지 않는다.
 * 이 파일이 그 길을 두 갈래로 적어 둔 것이다.
 *
 * **단계는 화면이 아니라 「눌러야 할 것」으로 쪼갠다** — 앵커 하나가 곧 한 단계다. 화면으로
 * 쪼개면 어시스턴트 한 화면에서 세 번 눌러야 하는 일이 한 단계로 뭉쳐 안내가 되지 않는다.
 */
import type { MessageKey } from '@/shared/i18n/messages';

export type TourPath = 'general' | 'patient';

/**
 * 강조할 요소의 이름. 화면의 실제 요소가 이 이름으로 자기를 등록하고
 * (`useTourHighlight`), 그 요소를 눌렀을 때 같은 이름으로 단계를 넘긴다
 * (`completeTourStep`). 셀렉터·좌표를 쓰지 않는 이유는 이 이름이 **리팩터링을 견디기**
 * 때문이다 — 클래스명이나 DOM 구조가 바뀌어도 앵커 이름은 그대로다.
 */
export type TourAnchor =
  | 'new-conversation'
  | 'suggested-prompt'
  | 'send-question'
  | 'answer'
  | 'nav-patients'
  | 'patient-row'
  | 'start-patient-conversation';

export interface TourRoute {
  /** 이 단계를 할 수 있는 화면의 경로 접두사 */
  readonly href: string;
  readonly labelKey: MessageKey;
}

export interface TourStep {
  readonly anchor: TourAnchor;
  readonly titleKey: MessageKey;
  readonly bodyKey: MessageKey;
  /**
   * 이 단계를 할 수 있는 화면. `pathname`이 여기서 시작하지 않으면 강조할 요소가 화면에 아예
   * 없으므로, 가이드 카드가 안내 대신 **이동 링크**를 띄운다. `null`은 사이드바처럼 어느
   * 화면에서나 되는 단계다.
   */
  readonly route: TourRoute | null;
}

const ASSISTANT: TourRoute = { href: '/assistant', labelKey: 'tourGoToAssistant' };
/** 접두사라 환자 상세(`/patients/{id}`)까지 함께 덮는다 */
const PATIENTS: TourRoute = { href: '/patients', labelKey: 'tourGoToPatients' };

/**
 * 마지막 단계(`answer`)에는 강조할 요소가 없다 — 답변은 사용자가 만드는 것이 아니라
 * 기다리는 것이다. 링 없이 가이드 카드의 문구만 남고, 답변이 종결되면 스스로 넘어간다.
 */
export const TOUR_PATHS: Record<TourPath, readonly TourStep[]> = {
  general: [
    {
      anchor: 'new-conversation',
      titleKey: 'tourGeneralStep1Title',
      bodyKey: 'tourGeneralStep1Body',
      route: ASSISTANT,
    },
    {
      anchor: 'suggested-prompt',
      titleKey: 'tourGeneralStep2Title',
      bodyKey: 'tourGeneralStep2Body',
      route: ASSISTANT,
    },
    {
      anchor: 'send-question',
      titleKey: 'tourGeneralStep3Title',
      bodyKey: 'tourGeneralStep3Body',
      route: ASSISTANT,
    },
    {
      anchor: 'answer',
      titleKey: 'tourGeneralStep4Title',
      bodyKey: 'tourGeneralStep4Body',
      route: ASSISTANT,
    },
  ],
  patient: [
    // 사이드바는 모든 보호 화면에 있다 — 어디서 시작하든 이 단계는 그 자리에서 된다
    {
      anchor: 'nav-patients',
      titleKey: 'tourPatientStep1Title',
      bodyKey: 'tourPatientStep1Body',
      route: null,
    },
    {
      anchor: 'patient-row',
      titleKey: 'tourPatientStep2Title',
      bodyKey: 'tourPatientStep2Body',
      route: PATIENTS,
    },
    {
      anchor: 'start-patient-conversation',
      titleKey: 'tourPatientStep3Title',
      bodyKey: 'tourPatientStep3Body',
      route: PATIENTS,
    },
    {
      anchor: 'suggested-prompt',
      titleKey: 'tourPatientStep4Title',
      bodyKey: 'tourPatientStep4Body',
      route: ASSISTANT,
    },
    {
      anchor: 'send-question',
      titleKey: 'tourPatientStep5Title',
      bodyKey: 'tourPatientStep5Body',
      route: ASSISTANT,
    },
    {
      anchor: 'answer',
      titleKey: 'tourPatientStep6Title',
      bodyKey: 'tourPatientStep6Body',
      route: ASSISTANT,
    },
  ],
};

/** 가이드 카드 머리글에 쓰는 짧은 경로 이름 — 환영 모달의 카드 제목과는 다른 문구다 */
export const TOUR_PATH_NAME_KEYS: Record<TourPath, MessageKey> = {
  general: 'tourPathGeneralName',
  patient: 'tourPathPatientName',
};

/** 한 경로를 마친 사람에게 권할 다른 경로 */
export function otherTourPath(path: TourPath): TourPath {
  return path === 'general' ? 'patient' : 'general';
}
