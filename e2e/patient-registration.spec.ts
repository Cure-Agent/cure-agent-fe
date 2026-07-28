/**
 * 크리티컬 플로우 3 — 환자 등록: 목록 → 폼 → 생성 → 상세로 이동.
 *
 * 여기서만 FE가 사용자 입력을 계약 형태로 **변환**한다: 쉼표 문자열이 배열이 되고,
 * 빈 칸은 키 자체가 빠지며, 숫자 입력이 number가 된다. 화면이 멀쩡해 보여도 이 변환이
 * 틀리면 잘못된 임상 정보가 저장된다. 그래서 화면 전환뿐 아니라 전송된 본문까지 못 박는다.
 */
import { expect, test } from '@playwright/test';
import { mockApi, ok, okList } from './fixtures/api';
import { CLINICIAN, PATIENT } from './fixtures/data';

test('환자를 등록하면 입력이 계약대로 전송되고 상세 화면으로 넘어간다', async ({ page }) => {
  let patients: unknown[] = [];

  const api = await mockApi(page, {
    'GET /api/v1/auth/me': ok(CLINICIAN),
    'GET /api/v1/patients': () => okList(patients),
    'POST /api/v1/patients': () => {
      patients = [PATIENT];
      return ok(PATIENT);
    },
    'GET /api/v1/patients/:patientId': ok(PATIENT),
  });

  await page.goto('/patients');
  await expect(page.getByRole('heading', { name: '환자' })).toBeVisible();

  await page.getByRole('button', { name: '새 환자 등록' }).click();

  await page.getByLabel('케이스 라벨').fill(PATIENT.caseLabel);
  await page.getByLabel('출생연도').fill(String(PATIENT.birthYear));
  await page.getByLabel('성별').selectOption('FEMALE');
  await page.getByLabel('신장(cm)').fill(String(PATIENT.heightCm));
  await page.getByLabel('체중(kg)').fill(String(PATIENT.weightKg));
  await page.getByLabel('진단(쉼표 구분)').fill('만성 요통, 고혈압');
  await page.getByLabel('임상 메모').fill(PATIENT.clinicalNotes as string);

  await page.getByRole('button', { name: '등록', exact: true }).click();

  // 생성된 환자의 상세로 이동한다 (patients/page.tsx의 onCreated)
  await expect(page).toHaveURL(`/patients/${PATIENT.id}`);
  await expect(page.getByRole('heading', { name: PATIENT.caseLabel })).toBeVisible();
  await expect(page.getByText(`${PATIENT.age}세 · ${PATIENT.sex} · BMI ${PATIENT.bmi} · v${PATIENT.version}`)).toBeVisible();
  await expect(page.getByText('만성 요통, 고혈압')).toBeVisible();

  // 입력 → 계약 변환: 쉼표 문자열은 배열로, 빈 목록도 배열로, 숫자 칸은 number로.
  // 비워 둔 칸(waistCm)은 키가 아예 없어야 한다 — undefined를 보내면 서버가 초기화로 읽을 수 있다
  const [createCall] = api.callsTo('POST', '/api/v1/patients');
  expect(createCall.body).toEqual({
    caseLabel: PATIENT.caseLabel,
    birthYear: PATIENT.birthYear,
    sex: 'FEMALE',
    heightCm: PATIENT.heightCm,
    weightKg: PATIENT.weightKg,
    diagnoses: ['만성 요통', '고혈압'],
    medications: [],
    allergies: [],
    clinicalNotes: PATIENT.clinicalNotes,
  });

  expect(api.unhandled).toEqual([]);
});
