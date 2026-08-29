/**
 * 빈 대화에 띄우는 예시 질의문.
 *
 * 처음 들어온 사람이 마주치는 것은 빈 입력창 하나뿐이라, 무엇을 물어야 하는지 모르면
 * 아무 질문이나 던지고 기권 답변을 받는다(프로덕션 실측: 답변 63건 중 35건이 기권).
 *
 * **환자별 질의문 셋은 평가셋 승인 문항의 원문이다** — `test/fixtures/rag-eval/evalset.json`의
 * `evalgen-answerable-015`·`-014`·`-114`이고, 2026-08-25 컷 스윕 2회 실측에서 셋 다 운영 컷의
 * 과잉 기권 목록에 없었다. 문구를 고치면 그 근거가 끊기므로 손대지 말 것(docs/specs/41).
 *
 * 일반 질의문 셋은 같은 평가셋 문항을 **읽기 좋게 다듬은 것**이라 답변가능성이 그만큼 담보되지는
 * 않는다. 기권해도 다른 질문을 다시 던지면 되는 자리라 가독성을 택했다(같은 spec의 판단표).
 */

/** 일반 대화(GUIDELINE_QA)용 — 침·한약·치료 주기로 서로 다른 축을 하나씩 집는다 */
export const GENERAL_SUGGESTED_PROMPTS: readonly string[] = [
  '성인 만성 비특이적 요통 환자에게 침 치료를 할 때, 모든 환자에게 같은 혈자리를 쓰는 표준 처방과 환자별로 달리하는 개별 처방 중 어느 쪽이 권고되나요?',
  '성인 원발성 불면 환자에서 불면 증상 개선을 위해 고려할 수 있는 한약 처방은 무엇인가요?',
  '편두통 환자에서 침 치료를 고려할 때 일반적으로 어느 정도의 치료 빈도와 기간으로 시행하는 것이 적절한가요?',
];

/**
 * 진단명 → 환자 맞춤 질의문.
 *
 * **케이스 라벨이 아니라 진단명으로 고른다.** 라벨(CASE-001)은 사용자가 바꿀 수 있는 자유
 * 문자열이라 같은 라벨이 다른 환자를 가리킬 수 있지만, 진단명은 그 환자에게 무엇을 물을 수
 * 있는지를 실제로 결정한다 — 덕분에 데모 환자뿐 아니라 같은 진단으로 직접 등록한 환자에게도
 * 그대로 걸린다.
 *
 * `keywords`는 부분일치다. 진단 칸은 자유 입력이라 '원발성 골다공증'·'ADHD'처럼 앞뒤가
 * 붙어 들어온다 — 완전일치로 잡으면 데모 환자 말고는 아무것도 걸리지 않는다.
 */
const PATIENT_PROMPTS: readonly { keywords: readonly string[]; prompt: string }[] = [
  {
    keywords: ['골다공증'],
    prompt:
      '골다공증 환자에게 골밀도나 통증 개선을 목적으로 침 치료를 고려할 때, 유침 시간은 보통 어느 정도로 잡는 것이 적절한가요?',
  },
  {
    keywords: ['주의력결핍', '과잉행동', 'ADHD'],
    prompt: 'ADHD 소아·청소년에서 한약 치료를 우선 검토할 수 있는 임상 상황은 어떤 경우인가요?',
  },
  {
    keywords: ['류마티스'],
    prompt:
      '성인 류마티스 관절염 환자의 증상 완화를 위해 약침을 쓸 때, 시술 부위와 함께 어떤 취혈 원칙을 적용하고 봉약침 사용 전에는 어떤 안전 조치가 필요한가?',
  },
];

export interface SuggestedPromptsInput {
  type: 'GUIDELINE_QA' | 'PATIENT_GUIDANCE';
  /** 환자 맞춤 대화일 때의 진단 목록 — 아직 못 불러왔으면 undefined */
  diagnoses?: readonly string[];
}

/**
 * 이 대화에 띄울 질의문.
 *
 * 환자 맞춤 대화라도 걸리는 진단이 없으면 일반 질의문으로 돌아간다 — 빈 자리를 남기는 것보다
 * 답할 수 있는 질문을 주는 편이 낫다. 반대로 진단이 걸리면 그 하나만 보여준다: 프로필이
 * 이미 질문에 합성되는 대화(BE가 진단·투약·알레르기를 앞에 붙인다)라 그 환자와 무관한
 * 예시를 나란히 두면 무엇이 맞춤인지가 흐려진다.
 */
export function resolveSuggestedPrompts(input: SuggestedPromptsInput): readonly string[] {
  if (input.type !== 'PATIENT_GUIDANCE') return GENERAL_SUGGESTED_PROMPTS;

  // 아직 환자 프로필을 못 받은 동안은 아무것도 띄우지 않는다 — 일반 질의문을 먼저 그렸다가
  // 환자 질의문으로 교체되면 클릭하려던 항목이 손 밑에서 바뀐다
  if (!input.diagnoses) return [];

  const matched = PATIENT_PROMPTS.find((entry) =>
    entry.keywords.some((keyword) =>
      input.diagnoses?.some((diagnosis) => diagnosis.includes(keyword)),
    ),
  );
  return matched ? [matched.prompt] : GENERAL_SUGGESTED_PROMPTS;
}
