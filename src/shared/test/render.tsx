import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type RenderResult, render } from '@testing-library/react';
import type { ReactElement } from 'react';

/**
 * QueryClientProvider가 감싼 렌더 헬퍼 — 테스트는 retry 없이 즉시 실패한다.
 *
 * `queryClient`를 넘기면 그 캐시를 그대로 쓴다. 화면을 떠났다 돌아오는 흐름
 * (언마운트 → 재마운트)은 **캐시가 살아남는 것**이 전제라, 렌더마다 새 클라이언트를
 * 만들면 재현되지 않는다 — 두 번째 마운트가 언제나 빈 캐시에서 새로 조회하게 된다.
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: { queryClient?: QueryClient },
): RenderResult & { queryClient: QueryClient } {
  const queryClient =
    options?.queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  const result = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { ...result, queryClient };
}
