'use client';

import type { PatientDetail } from '../api/patient.api';

export interface PatientCreateFormProps {
  onCreated: (patient: PatientDetail) => void;
}

/**
 * 등록 폼 — 라벨: '케이스 라벨'·'출생연도'·'성별'·'신장(cm)'·'체중(kg)'·
 * '진단(쉼표 구분)'·'복용약(쉼표 구분)'·'알레르기(쉼표 구분)'·'임상 메모', 제출 버튼 name='등록'.
 * 쉼표 구분 필드는 trim 후 배열로 파싱, 빈 입력은 빈 배열.
 */
export function PatientCreateForm(_props: PatientCreateFormProps): React.ReactElement {
  throw new Error('NOT_IMPLEMENTED');
}
