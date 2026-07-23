/** 빈 값이면 same-origin(Next rewrites 프록시) 사용 (docs/specs/07). */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
