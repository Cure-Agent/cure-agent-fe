/** 봉투 소비 진입점 — 전송 정책(authFetch)이 연결된 단일 클라이언트 인스턴스. */
import { API_BASE_URL } from '../config/env';
import { createApiClient } from './generated/client';
import { authFetch } from './http';

export const api = createApiClient(API_BASE_URL, { fetch: authFetch });
