/**
 * E2E 시드 데이터. 전부 생성 스키마 타입으로 못 박아 두었으므로,
 * 계약이 바뀌면 `pnpm typecheck`가 여기서 먼저 깨진다 — 테스트를 돌리기 전에.
 */
import type { components } from '@/shared/api/generated/schema';

type Clinician = components['schemas']['ClinicianResponseDto'];
type ConversationSummary = components['schemas']['ConversationSummaryResponseDto'];
type EvidenceDetail = components['schemas']['EvidenceDetailResponseDto'];
type Message = components['schemas']['MessageResponseDto'];
type PatientDetail = components['schemas']['PatientDetailResponseDto'];

export const CLINICIAN: Clinician = {
  id: 'clinician-1',
  email: 'doctor@cure.test',
  displayName: '김한의',
  clinic: { id: 'clinic-1', name: '서울한의원' },
  verificationStatus: 'VERIFIED',
};

export const CONVERSATION: ConversationSummary = {
  id: 'conv-1',
  type: 'GUIDELINE_QA',
  title: '만성 요통 침 치료',
  status: 'ACTIVE',
  lastMessageAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const EVIDENCE: EvidenceDetail = {
  id: 'evidence-1',
  guidelineId: 'guideline-1',
  guidelineVersionId: 'guideline-1-v1',
  guidelineTitle: '요통 한의표준임상진료지침',
  version: '1.0',
  sectionPath: ['2', '치료', '침치료'],
  recommendationNumber: 'R1',
  recommendationText: '만성 요통 환자에게 침 치료를 권고한다.',
  recommendationGrade: { system: 'GRADE', code: 'A', label: '강한 권고' },
  evidenceLevel: { system: 'GRADE', code: 'HIGH', label: '높음' },
  excerpt: '만성 요통 환자에서 침 치료는 통증과 기능 개선에 유의한 효과를 보였다.',
  pageStart: 42,
  pageEnd: 43,
  sourceUrl: 'https://nckm.example.test/guidelines/1',
};

/** 스트림이 델타로 조립해 낼 최종 답변 본문 */
export const ANSWER_TEXT =
  '만성 요통에 침 치료는 강한 권고 등급으로 제시됩니다. 통증과 기능 개선 모두에서 효과가 확인되었습니다.';

/** answer.delta로 쪼개 보낼 조각 — 이어 붙이면 ANSWER_TEXT가 된다 */
export const ANSWER_DELTAS = [
  '만성 요통에 침 치료는 ',
  '강한 권고 등급으로 제시됩니다. ',
  '통증과 기능 개선 모두에서 효과가 확인되었습니다.',
];

export const QUESTION = '만성 요통에 침 치료가 효과적인가요?';

export const USER_MESSAGE: Message = {
  id: 'msg-user-1',
  role: 'USER',
  content: QUESTION,
  status: 'COMPLETED',
  citations: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const ASSISTANT_MESSAGE: Message = {
  id: 'msg-assistant-1',
  role: 'ASSISTANT',
  content: ANSWER_TEXT,
  status: 'COMPLETED',
  answerKind: 'GUIDELINE_ANSWER',
  citations: [
    {
      marker: 1,
      evidenceId: EVIDENCE.id,
      guidelineTitle: EVIDENCE.guidelineTitle,
      guidelineVersion: EVIDENCE.version,
      sectionPath: EVIDENCE.sectionPath,
      quote: EVIDENCE.excerpt,
      sourceUrl: EVIDENCE.sourceUrl,
    },
  ],
  createdAt: '2026-01-01T00:00:01.000Z',
};

/** 정상 종결 스트림 (§8): accepted → retrieval → delta*n → completed */
export const ANSWER_STREAM: unknown[] = [
  {
    eventType: 'message.accepted',
    requestId: 'req-1',
    userMessageId: USER_MESSAGE.id,
    assistantMessageId: ASSISTANT_MESSAGE.id,
  },
  { eventType: 'retrieval.started' },
  { eventType: 'retrieval.completed', evidence: [EVIDENCE] },
  ...ANSWER_DELTAS.map((delta, index) => ({ eventType: 'answer.delta', seq: index, delta })),
  { eventType: 'answer.completed', message: ASSISTANT_MESSAGE },
];

export const PATIENT: PatientDetail = {
  id: 'patient-1',
  caseLabel: 'CASE-001',
  age: 46,
  sex: 'FEMALE',
  bmi: 22.9,
  status: 'ACTIVE',
  updatedAt: '2026-01-01T00:00:00.000Z',
  birthYear: 1980,
  heightCm: 162,
  weightKg: 60,
  diagnoses: ['만성 요통', '고혈압'],
  medications: [],
  allergies: [],
  clinicalNotes: '3개월 전부터 지속되는 하부 요통',
  version: 1,
};
