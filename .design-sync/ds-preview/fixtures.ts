/**
 * 프리뷰·디자인용 데모 데이터.
 *
 * 컴포넌트 대부분이 react-query 로 서버 상태를 읽으므로, 데이터가 없으면
 * "불러오는 중…" 만 렌더된다. 쿼리 키를 추측해 캐시에 심는 대신 전송 계층(fetch)을
 * 가로채 실제 봉투(architecture.md §10.1)를 돌려준다 — 앱의 진짜 코드 경로
 * (openapi-fetch → authFetch → unwrap/unwrapPage)를 그대로 지나므로 쿼리 키가
 * 바뀌어도 깨지지 않는다.
 *
 * 내용은 한의 임상 지침 도메인의 현실적인 예시다 (실제 환자 데이터 아님).
 */

interface PageInfo {
  size: number;
  hasNext: boolean;
  nextCursor: string | null;
}

const TS = '2026-07-27T09:00:00.000Z';

function envelope(data: unknown, page: PageInfo | null = null): unknown {
  return {
    success: true,
    code: 'OK',
    message: '',
    data,
    page,
    timestamp: TS,
    traceId: 'ds-preview',
  };
}

const PAGE: PageInfo = { size: 20, hasNext: false, nextCursor: null };

// ── 도메인 데이터 ────────────────────────────────────────────────────────

export const CLINICIAN = {
  id: 'clc_01HQ8ZK3M4',
  email: 'jiyeon.han@sohan.kr',
  displayName: '한지연',
  clinic: { id: 'cln_01HQ8ZK3M5', name: '소한한의원 강남점' },
  verificationStatus: 'VERIFIED' as const,
};

const GRADE_A = { system: 'GRADE', code: 'A', label: '강한 권고' };
const GRADE_B = { system: 'GRADE', code: 'B', label: '약한 권고' };
const LEVEL_HIGH = { system: 'GRADE', code: 'HIGH', label: '높음' };
const LEVEL_MOD = { system: 'GRADE', code: 'MODERATE', label: '중등도' };

export const EVIDENCE_DETAILS = [
  {
    id: 'evd_01HQ8ZM1A1',
    guidelineId: 'gdl_01HQ8ZM100',
    guidelineVersionId: 'gdv_01HQ8ZM101',
    guidelineTitle: '요통 한의표준임상진료지침',
    version: '2.0',
    sectionPath: ['2', '치료', '침치료'],
    recommendationNumber: 'R1',
    recommendationText:
      '만성 요통 환자에게 통증 완화와 기능 개선을 위해 침 치료를 시행할 것을 권고한다.',
    recommendationGrade: GRADE_A,
    evidenceLevel: LEVEL_HIGH,
    excerpt:
      '만성 비특이적 요통 환자를 대상으로 한 무작위 대조군 연구 12편(n=2,314)의 메타분석에서 침 치료군은 대조군 대비 통증 척도(VAS)가 유의하게 감소하였다(MD -1.42, 95% CI -1.89 ~ -0.95).',
    pageStart: 84,
    pageEnd: 86,
    sourceUrl: 'https://nikom.or.kr/nckm/guideline/low-back-pain',
  },
  {
    id: 'evd_01HQ8ZM1A2',
    guidelineId: 'gdl_01HQ8ZM100',
    guidelineVersionId: 'gdv_01HQ8ZM101',
    guidelineTitle: '요통 한의표준임상진료지침',
    version: '2.0',
    sectionPath: ['2', '치료', '한약치료'],
    recommendationNumber: 'R7',
    recommendationText:
      '만성 요통 환자에게 변증에 따른 한약 치료를 고려할 수 있다.',
    recommendationGrade: GRADE_B,
    evidenceLevel: LEVEL_MOD,
    excerpt:
      '독활기생탕 투여군은 12주 시점에서 ODI(Oswestry Disability Index) 개선폭이 대조군보다 컸으나, 연구 간 이질성이 높아 근거 수준은 중등도로 평가되었다.',
    pageStart: 102,
    pageEnd: 103,
    sourceUrl: 'https://nikom.or.kr/nckm/guideline/low-back-pain',
  },
  {
    id: 'evd_01HQ8ZM1A3',
    guidelineId: 'gdl_01HQ8ZM200',
    guidelineVersionId: 'gdv_01HQ8ZM201',
    guidelineTitle: '경항통 한의표준임상진료지침',
    version: '1.1',
    sectionPath: ['3', '안전성', '주의사항'],
    recommendationGrade: GRADE_B,
    excerpt:
      '항응고제를 복용 중인 환자에서는 자침 부위 출혈 위험이 증가하므로 시술 전 복약력을 반드시 확인한다.',
    pageStart: 45,
    pageEnd: 45,
    sourceUrl: 'https://nikom.or.kr/nckm/guideline/neck-pain',
  },
];

const CITATIONS = [
  {
    marker: 1,
    evidenceId: 'evd_01HQ8ZM1A1',
    guidelineTitle: '요통 한의표준임상진료지침',
    guidelineVersion: '2.0',
    sectionPath: ['2', '치료', '침치료'],
    quote: '만성 요통 환자에게 침 치료를 시행할 것을 권고한다.',
    sourceUrl: 'https://nikom.or.kr/nckm/guideline/low-back-pain',
  },
  {
    marker: 2,
    evidenceId: 'evd_01HQ8ZM1A2',
    guidelineTitle: '요통 한의표준임상진료지침',
    guidelineVersion: '2.0',
    sectionPath: ['2', '치료', '한약치료'],
    quote: '변증에 따른 한약 치료를 고려할 수 있다.',
    sourceUrl: 'https://nikom.or.kr/nckm/guideline/low-back-pain',
  },
];

export const CLINICAL_GUIDANCE = {
  id: 'cgd_01HQ8ZN4B1',
  patientId: 'pat_01HQ8ZP5C1',
  patientProfileSnapshotId: 'pps_01HQ8ZP5C2',
  summary:
    '만성 요통(6개월 이상)과 야간 하지 저림을 호소하는 52세 여성입니다. 지침상 침 치료가 강한 권고 수준이며, 변증에 따른 한약 병행을 고려할 수 있습니다. 다만 와파린 복용 중이므로 자침 시 출혈 위험 평가가 선행되어야 합니다.',
  considerations: [
    {
      title: '침 치료 우선 적용',
      rationale:
        '만성 비특이적 요통에서 침 치료는 통증·기능 지표 모두에서 근거 수준 높음, 권고 등급 A로 제시됩니다.',
      citations: [CITATIONS[0]],
    },
    {
      title: '변증 기반 한약 병행 검토',
      rationale:
        '신허요통 변증이 확인되면 독활기생탕 계열을 12주 범위에서 고려할 수 있습니다. 근거 수준은 중등도입니다.',
      citations: [CITATIONS[1]],
    },
  ],
  safetyAlerts: [
    {
      severity: 'CRITICAL' as const,
      description:
        '와파린 복용 중 — 자침 부위 출혈 위험이 증가합니다. 최근 INR 수치를 확인하고 심부 자침은 피하십시오.',
      citations: [],
    },
    {
      severity: 'WARNING' as const,
      description: '고혈압 약물과 한약 상호작용 가능성 — 병용 시 혈압 모니터링이 필요합니다.',
      citations: [],
    },
  ],
  missingInformation: ['최근 INR 검사 수치', '요추 영상 검사 결과(6개월 이내)'],
  reviewStatus: 'DRAFT' as const,
  generatedAt: TS,
};

export const PATIENT_SUMMARIES = [
  {
    id: 'pat_01HQ8ZP5C1',
    caseLabel: 'CASE-001',
    age: 52,
    sex: 'FEMALE' as const,
    bmi: 24.1,
    status: 'ACTIVE' as const,
    updatedAt: TS,
  },
  {
    id: 'pat_01HQ8ZP5C2',
    caseLabel: 'CASE-002',
    age: 38,
    sex: 'MALE' as const,
    bmi: 27.6,
    status: 'ACTIVE' as const,
    updatedAt: TS,
  },
  {
    id: 'pat_01HQ8ZP5C3',
    caseLabel: 'CASE-003',
    age: 65,
    sex: 'FEMALE' as const,
    bmi: 21.8,
    status: 'ARCHIVED' as const,
    updatedAt: TS,
  },
];

export const PATIENT_DETAIL = {
  ...PATIENT_SUMMARIES[0],
  birthYear: 1974,
  heightCm: 161.5,
  weightKg: 62.9,
  waistCm: 79,
  diagnoses: ['만성 요통', '본태성 고혈압'],
  medications: ['와파린 2.5mg', '암로디핀 5mg'],
  allergies: ['아스피린'],
  clinicalNotes:
    '6개월 전부터 지속되는 요부 통증. 야간 하지 저림 동반. 장시간 좌위 후 악화되며 기상 직후 강직감 호소.',
  version: 3,
};

export const CONVERSATIONS = [
  {
    id: 'cnv_01HQ8ZQ6D1',
    type: 'GUIDELINE_QA' as const,
    title: '만성 요통 침 치료 권고 등급',
    status: 'ACTIVE' as const,
    lastMessagePreview: '요통 지침 2.0 기준으로 침 치료는 권고 등급 A입니다.',
    updatedAt: TS,
  },
  {
    id: 'cnv_01HQ8ZQ6D2',
    type: 'PATIENT_GUIDANCE' as const,
    title: 'CASE-001 임상 참고안',
    status: 'ACTIVE' as const,
    lastMessagePreview: '와파린 복용 중이라 자침 전 INR 확인이 필요합니다.',
    updatedAt: TS,
  },
  {
    id: 'cnv_01HQ8ZQ6D3',
    type: 'GUIDELINE_QA' as const,
    title: '경항통 도인운동요법 적응증',
    status: 'ARCHIVED' as const,
    lastMessagePreview: '경항통 지침 1.1 §4에 적응증이 정리되어 있습니다.',
    updatedAt: TS,
  },
];

export const MESSAGES = [
  {
    id: 'msg_01HQ8ZR7E1',
    role: 'USER' as const,
    content: '만성 요통 환자에게 침 치료가 효과적인가요? 권고 등급도 알려주세요.',
    status: 'COMPLETED' as const,
    citations: [],
    createdAt: TS,
  },
  {
    id: 'msg_01HQ8ZR7E2',
    role: 'ASSISTANT' as const,
    content:
      '요통 한의표준임상진료지침 2.0은 만성 비특이적 요통 환자에게 침 치료를 시행할 것을 권고 등급 A(강한 권고), 근거 수준 높음으로 제시합니다.[1]\n\n한약 치료는 변증에 따라 고려할 수 있으며 권고 등급 B입니다.[2]',
    status: 'COMPLETED' as const,
    answerKind: 'GUIDELINE_ANSWER' as const,
    citations: CITATIONS,
    createdAt: TS,
  },
];

export const GUIDELINE_SUMMARIES = [
  {
    id: 'gdl_01HQ8ZM100',
    title: '요통 한의표준임상진료지침',
    publisher: '한국한의약진흥원',
    currentVersion: '2.0',
    publishedAt: '2024-11-15T00:00:00.000Z',
    status: 'ACTIVE' as const,
  },
  {
    id: 'gdl_01HQ8ZM200',
    title: '경항통 한의표준임상진료지침',
    publisher: '한국한의약진흥원',
    currentVersion: '1.1',
    publishedAt: '2023-06-30T00:00:00.000Z',
    status: 'ACTIVE' as const,
  },
  {
    id: 'gdl_01HQ8ZM300',
    title: '슬관절 골관절염 한의표준임상진료지침',
    publisher: '한국한의약진흥원',
    currentVersion: '1.0',
    publishedAt: '2021-03-02T00:00:00.000Z',
    status: 'SUPERSEDED' as const,
  },
];

export const GUIDELINE_DETAIL = {
  ...GUIDELINE_SUMMARIES[0],
  sourceUrl: 'https://nikom.or.kr/nckm/guideline/low-back-pain',
};

export const GUIDELINE_EVIDENCE = [
  {
    id: 'evs_01HQ8ZS8F1',
    sectionPath: ['2', '치료', '침치료'],
    recommendationNumber: 'R1',
    excerpt:
      '만성 요통 환자에게 통증 완화와 기능 개선을 위해 침 치료를 시행할 것을 권고한다. 메타분석 12편(n=2,314)에서 VAS 유의 감소.',
    recommendationGrade: GRADE_A,
    evidenceLevel: LEVEL_HIGH,
  },
  {
    id: 'evs_01HQ8ZS8F2',
    sectionPath: ['2', '치료', '한약치료'],
    recommendationNumber: 'R7',
    excerpt:
      '변증에 따른 한약 치료를 고려할 수 있다. 독활기생탕 투여군에서 ODI 개선폭이 컸으나 연구 간 이질성이 높다.',
    recommendationGrade: GRADE_B,
    evidenceLevel: LEVEL_MOD,
  },
  {
    id: 'evs_01HQ8ZS8F3',
    sectionPath: ['3', '안전성', '주의사항'],
    excerpt: '항응고제 복용 환자는 자침 부위 출혈 위험이 증가하므로 시술 전 복약력을 확인한다.',
  },
];

export const OAUTH_PROVIDERS = ['GOOGLE', 'KAKAO', 'NAVER'];

// ── fetch 가로채기 ───────────────────────────────────────────────────────

type Route = { method: string; pattern: RegExp; body: () => unknown };

const ROUTES: Route[] = [
  { method: 'GET', pattern: /^\/api\/v1\/auth\/me$/, body: () => envelope(CLINICIAN) },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/auth\/oauth\/providers$/,
    body: () => envelope({ providers: OAUTH_PROVIDERS }),
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/patients$/,
    body: () => envelope(PATIENT_SUMMARIES, PAGE),
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/patients\/[^/]+$/,
    body: () => envelope(PATIENT_DETAIL),
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/conversations$/,
    body: () => envelope(CONVERSATIONS, PAGE),
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/conversations\/[^/]+\/messages$/,
    body: () => envelope(MESSAGES, PAGE),
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/guidelines$/,
    body: () => envelope(GUIDELINE_SUMMARIES, PAGE),
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/guidelines\/[^/]+\/evidence$/,
    body: () => envelope(GUIDELINE_EVIDENCE, PAGE),
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/guidelines\/[^/]+$/,
    body: () => envelope(GUIDELINE_DETAIL),
  },
  { method: 'POST', pattern: /^\/api\/v1\/patients$/, body: () => envelope(PATIENT_DETAIL) },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/conversations$/,
    body: () => envelope(CONVERSATIONS[0]),
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/clinical-guidance\/[^/]+\/reviews$/,
    body: () => envelope({ ...CLINICAL_GUIDANCE, reviewStatus: 'ACCEPTED' }),
  },
  { method: 'PATCH', pattern: /^\/api\/v1\/patients\/[^/]+$/, body: () => envelope(PATIENT_DETAIL) },
  {
    method: 'PATCH',
    pattern: /^\/api\/v1\/conversations\/[^/]+$/,
    body: () => envelope(CONVERSATIONS[0]),
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let installed = false;

/**
 * 전역 fetch 를 데모 데이터로 교체한다 (한 번만). DsPreviewProvider 가 마운트될 때만
 * 호출되므로, 프로바이더를 쓰지 않는 소비자의 fetch 는 건드리지 않는다.
 */
export function installFixtureFetch(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    let pathname: string;
    try {
      pathname = new URL(raw, window.location.origin).pathname;
    } catch {
      return original(input as RequestInfo, init);
    }

    if (!pathname.startsWith('/api/')) return original(input as RequestInfo, init);

    const method = (
      init?.method ??
      (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET')
    ).toUpperCase();

    const hit = ROUTES.find((r) => r.method === method && r.pattern.test(pathname));
    if (hit) return jsonResponse(hit.body());

    // 매칭되는 데모 라우트가 없으면 실패 봉투 — 컴포넌트의 오류 상태가 정상 동작함을 보여준다.
    return jsonResponse(
      {
        success: false,
        code: 'NOT_FOUND',
        message: '데모 데이터가 없는 경로입니다.',
        data: null,
        page: null,
        timestamp: TS,
        traceId: 'ds-preview',
      },
      404,
    );
  };
}
