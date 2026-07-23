import { describe, expect, it } from 'vitest';
import { ApiError, unwrap } from './api-error';

/**
 * docs/specs/07 수용 기준 9 동결 테스트. 구현 중 수정 금지.
 */

describe('unwrap (수용 기준 9)', () => {
  it('성공 봉투 → data 반환', () => {
    const result = {
      data: {
        success: true,
        code: 'SUCCESS',
        message: 'ok',
        data: { id: 'x1' },
        page: null,
        timestamp: '2026-07-24T00:00:00.000Z',
        traceId: 'trace-1',
      },
      response: new Response(null, { status: 200 }),
    };
    expect(unwrap<{ id: string }>(result)).toEqual({ id: 'x1' });
  });

  it('실패 봉투 → ApiError(code·traceId·status 보존)', () => {
    const result = {
      error: {
        success: false,
        code: 'PATIENT_VERSION_CONFLICT',
        message: '다른 사용자가 환자 정보를 먼저 수정했습니다.',
        data: { currentVersion: 4 },
        page: null,
        timestamp: '2026-07-24T00:00:00.000Z',
        traceId: 'trace-2',
      },
      response: new Response(null, { status: 409 }),
    };

    try {
      unwrap(result);
      throw new Error('should have thrown');
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError).toBeInstanceOf(ApiError);
      expect(apiError.code).toBe('PATIENT_VERSION_CONFLICT');
      expect(apiError.status).toBe(409);
      expect(apiError.traceId).toBe('trace-2');
      expect(apiError.data).toEqual({ currentVersion: 4 });
    }
  });
});
