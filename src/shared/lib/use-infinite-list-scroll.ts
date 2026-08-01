'use client';

/**
 * 목록 하단 무한 스크롤 — 컨테이너 끝의 sentinel이 보이면 다음 페이지를 당긴다.
 * 첫 페이지가 화면을 못 채워 IO가 재발화하지 않는 경우도 채울 때까지 이어 당긴다.
 */
import { useCallback, useEffect, useRef } from 'react';

export interface InfiniteListScrollOptions {
  hasNext: boolean;
  isFetching: boolean;
  fetchNext: () => void;
  /** 목록 아이템 수 — 페이지 도착 후 화면 채움 검사를 다시 돌린다 */
  itemCount: number;
}

export interface InfiniteListScrollHandle<C extends HTMLElement = HTMLDivElement> {
  containerRef: React.RefObject<C | null>;
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>;
  /** IO 미지원 환경 보강용 — 스크롤 컨테이너 onScroll에 연결 */
  handleScroll: () => void;
}

const NEAR_EDGE_PX = 200;

export function useInfiniteListScroll<C extends HTMLElement = HTMLDivElement>({
  hasNext,
  isFetching,
  fetchNext,
  itemCount,
}: InfiniteListScrollOptions): InfiniteListScrollHandle<C> {
  const containerRef = useRef<C | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ hasNext, isFetching, fetchNext });
  stateRef.current = { hasNext, isFetching, fetchNext };

  const requestNext = useCallback(() => {
    const state = stateRef.current;
    if (!state.hasNext || state.isFetching) return;
    state.fetchNext();
  }, []);

  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    const root = containerRef.current;
    if (!sentinel || !root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) requestNext();
      },
      { root, rootMargin: `0px 0px ${NEAR_EDGE_PX}px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [requestNext]);

  // 화면 채움 — 컨테이너가 스크롤될 만큼 차기 전까지는 계속 다음 페이지를 당긴다
  useEffect(() => {
    const el = containerRef.current;
    if (!el || el.clientHeight === 0) return; // 미측정 환경(jsdom 등)
    if (el.scrollHeight <= el.clientHeight) requestNext();
  }, [itemCount, requestNext]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_EDGE_PX) requestNext();
  }, [requestNext]);

  return { containerRef, bottomSentinelRef, handleScroll };
}
