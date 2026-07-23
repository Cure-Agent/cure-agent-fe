'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { setUnauthorizedHandler } from '@/shared/api/http';
import { createQueryClient } from '@/shared/api/query-client';

export function Providers({ children }: { children: ReactNode }): React.ReactElement {
  const router = useRouter();
  const [queryClient] = useState(createQueryClient);

  // refresh 실패(세션 만료) 시 전역 정책: 로그인으로 이동 (FE 분리본 §2)
  useEffect(() => {
    setUnauthorizedHandler(() => router.replace('/login'));
    return () => setUnauthorizedHandler(null);
  }, [router]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
