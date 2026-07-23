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

/** openapi-fetch 결과에서 봉투를 해석한다: 성공 → data, 실패 → ApiError throw */
export function unwrap<T>(_result: FetchResult): T {
  throw new Error('NOT_IMPLEMENTED');
}
