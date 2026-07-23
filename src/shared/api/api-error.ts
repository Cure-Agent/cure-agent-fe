/** 공통 응답 봉투 (architecture.md §10.1) */
export interface ApiEnvelope<T = unknown> {
  success: boolean;
  code: string;
  message: string;
  data: T | null;
  page: { size: number; hasNext: boolean; nextCursor: string | null } | null;
  timestamp: string;
  traceId: string;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly traceId: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface FetchResult {
  data?: unknown;
  error?: unknown;
  response: Response;
}

function isEnvelope(value: unknown): value is ApiEnvelope {
  return typeof value === 'object' && value !== null && 'success' in value && 'code' in value;
}

/** openapi-fetch 결과에서 봉투를 해석한다: 성공 → data, 실패 → ApiError throw */
export function unwrap<T>(result: FetchResult): T {
  const payload = result.error ?? result.data;
  if (!isEnvelope(payload)) {
    throw new ApiError(
      'INTERNAL_ERROR',
      '응답 형식이 올바르지 않습니다.',
      result.response.status,
      '',
    );
  }
  if (!payload.success) {
    throw new ApiError(
      payload.code,
      payload.message,
      result.response.status,
      payload.traceId,
      payload.data ?? undefined,
    );
  }
  return payload.data as T;
}

/** 목록 응답(data + page) 해석 */
export function unwrapPage<T>(result: FetchResult): {
  items: T[];
  page: NonNullable<ApiEnvelope['page']>;
} {
  const payload = result.error ?? result.data;
  if (!isEnvelope(payload)) {
    throw new ApiError(
      'INTERNAL_ERROR',
      '응답 형식이 올바르지 않습니다.',
      result.response.status,
      '',
    );
  }
  if (!payload.success) {
    throw new ApiError(
      payload.code,
      payload.message,
      result.response.status,
      payload.traceId,
      payload.data ?? undefined,
    );
  }
  return {
    items: (payload.data ?? []) as T[],
    page: payload.page ?? { size: 0, hasNext: false, nextCursor: null },
  };
}
