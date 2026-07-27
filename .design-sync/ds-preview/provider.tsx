'use client';

/**
 * 프리뷰·디자인 렌더용 루트 래퍼.
 *
 * 이 디자인 시스템의 컴포넌트는 Next 앱에서 떼어낸 것이라 두 가지 컨텍스트가 없으면
 * 렌더되지 않는다:
 *   1. react-query — 서버 상태를 읽는 컴포넌트가 대부분이다.
 *   2. Next App Router — usePathname/useRouter/next-link 가 컨텍스트를 요구한다.
 *
 * 여기서 둘 다 세우고, 전송 계층(fetch)을 데모 데이터로 가로챈다.
 * cfg.provider 로 지정되어 모든 프리뷰 카드를 감싼다.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {
  PathParamsContext,
  PathnameContext,
  SearchParamsContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { type ReactNode, useState } from 'react';
import { installFixtureFetch } from './fixtures';

/**
 * 데모 데이터도 번들에 함께 실어 보낸다. 이 디자인 시스템의 컴포넌트는 대부분
 * 서버 DTO 를 props 로 받으므로, 화면을 구성하려면 그럴듯한 값이 필요하다.
 * 프리뷰 카드와 설계 에이전트가 같은 데이터를 쓰게 해서 카드와 실제 디자인이 어긋나지 않게 한다.
 */
export {
  CLINICAL_GUIDANCE,
  CLINICIAN,
  CONVERSATIONS,
  EVIDENCE_DETAILS,
  GUIDELINE_DETAIL,
  GUIDELINE_EVIDENCE,
  GUIDELINE_SUMMARIES,
  MESSAGES,
  OAUTH_PROVIDERS,
  PATIENT_DETAIL,
  PATIENT_SUMMARIES,
} from './fixtures';

const noop = (): void => undefined;

/** 정적 렌더용 라우터 스텁 — 네비게이션은 일어나지 않는다. */
const ROUTER_STUB = {
  push: noop,
  replace: noop,
  refresh: noop,
  back: noop,
  forward: noop,
  prefetch: async (): Promise<void> => undefined,
};

export interface DsPreviewProviderProps {
  children: ReactNode;
  /** AppShell 의 활성 내비 항목을 결정한다. 기본 '/assistant'. */
  pathname?: string;
}

export function DsPreviewProvider({
  children,
  pathname = '/assistant',
}: DsPreviewProviderProps): React.ReactElement {
  // 렌더 시점(자식보다 먼저)에 fetch 를 교체한다 — 자식의 useQuery 가 발화하기 전이다.
  const [queryClient] = useState(() => {
    installFixtureFetch();
    return new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
        mutations: { retry: false },
      },
    });
  });

  return (
    <AppRouterContext.Provider value={ROUTER_STUB as never}>
      <PathnameContext.Provider value={pathname}>
        <SearchParamsContext.Provider value={new URLSearchParams() as never}>
          <PathParamsContext.Provider value={{}}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </PathParamsContext.Provider>
        </SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>
  );
}
