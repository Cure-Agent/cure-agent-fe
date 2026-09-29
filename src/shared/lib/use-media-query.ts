'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * 넓은 화면(3단)과 좁은 화면(목록 ↔ 채팅방)의 경계 — Tailwind `lg`(64rem)와 같은 값이다.
 *
 * 화면 배치는 CSS(`lg:`)가 가르고 몇몇 동작(기록을 쌓을지, 근거를 시트로 띄울지)은 JS가
 * 가른다. 둘의 경계가 한 픽셀이라도 어긋나면 그 구간에서 3단 화면이 시트를 띄우거나, 목록이
 * 숨었는데 뒤로가기 기록은 쌓이지 않는 화면이 생긴다.
 */
export const DESKTOP_MEDIA_QUERY = '(min-width: 64rem)';

/**
 * 미디어 쿼리 일치 여부. 창이 경계를 넘으면 다시 그린다.
 *
 * 서버 스냅샷이 `false`인 것은 서버가 방문자의 화면을 알 수 없어서다. 이 훅을 쓰는 화면은
 * 세션 확인 뒤에만 마운트되므로(`(protected)/layout`) 그 값이 실제로 그려지는 일은 없다.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
