'use client';

/**
 * 채팅 뷰의 스크롤 오케스트레이션 (고정 뷰포트 + 위로 무한 스크롤).
 *
 * - 최초 진입·대화 전환: 최신 메시지가 보이도록 하단 정렬
 * - 상단 sentinel 노출: 과거 페이지 로드 후 보던 위치 유지(프리펜드 보정)
 * - 하단 근처에 있을 때만 새 메시지·스트리밍 delta를 따라 내려간다(sticky)
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/** 이 거리(px) 안이면 "하단에 있다"로 보고 자동 스크롤을 유지한다 */
const NEAR_BOTTOM_PX = 100;

export interface ChatAutoScrollOptions {
  /** 대화 전환 등 스크롤 상태를 처음부터 다시 시작할 키 */
  resetKey: string | null;
  /** 시간순으로 렌더되는 메시지 개수 — 변화가 프리펜드 보정·하단 고정을 구동한다 */
  itemCount: number;
  hasOlder: boolean;
  isLoadingOlder: boolean;
  loadOlder: () => void;
}

export interface ChatAutoScrollHandle {
  containerRef: React.RefObject<HTMLDivElement | null>;
  topSentinelRef: React.RefObject<HTMLDivElement | null>;
  /** 스크롤 컨테이너의 onScroll에 연결 — 하단 고정 여부를 추적한다 */
  handleScroll: () => void;
  /** 하단 고정 상태일 때만 하단으로 (스트리밍 delta 성장 등 개수 밖 변화용) */
  scrollToBottomIfSticky: () => void;
  /** 무조건 하단으로 + 고정 재개 (질문 전송 직후) */
  scrollToBottom: () => void;
}

export function useChatAutoScroll({
  resetKey,
  itemCount,
  hasOlder,
  isLoadingOlder,
  loadOlder,
}: ChatAutoScrollOptions): ChatAutoScrollHandle {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  const didInitialRef = useRef(false);
  /** 과거 페이지 요청 직전의 스크롤 스냅샷 — 프리펜드 후 위치 보정에 쓴다 */
  const restoreRef = useRef<{ height: number; top: number } | null>(null);
  // IO 콜백·스크롤 핸들러가 항상 최신 로딩 상태를 보도록 ref로 전달
  const loadStateRef = useRef({ hasOlder, isLoadingOlder, loadOlder });
  loadStateRef.current = { hasOlder, isLoadingOlder, loadOlder };

  useLayoutEffect(() => {
    didInitialRef.current = false;
    stickRef.current = true;
    restoreRef.current = null;
  }, [resetKey]);

  const requestOlder = useCallback(() => {
    const el = containerRef.current;
    const load = loadStateRef.current;
    if (!el || !didInitialRef.current) return;
    if (!load.hasOlder || load.isLoadingOlder || restoreRef.current) return;
    restoreRef.current = { height: el.scrollHeight, top: el.scrollTop };
    load.loadOlder();
  }, []);

  // 메시지 변화 뒤 스크롤 확정: 프리펜드 보정 → 최초 하단 정렬 → 하단 고정
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || itemCount === 0) return;
    if (restoreRef.current) {
      const { height, top } = restoreRef.current;
      restoreRef.current = null;
      el.scrollTop = top + (el.scrollHeight - height);
      return;
    }
    if (!didInitialRef.current) {
      didInitialRef.current = true;
      el.scrollTop = el.scrollHeight;
      return;
    }
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [itemCount, resetKey]);

  // 로드가 실패 등으로 데이터 변화 없이 끝나면 스냅샷을 비워 다음 시도를 막지 않는다
  // (성공 경로에서는 위 layout effect가 passive effect보다 먼저 돌며 이미 비웠다)
  useEffect(() => {
    if (!isLoadingOlder) restoreRef.current = null;
  }, [isLoadingOlder]);

  // 상단 sentinel이 보이면 과거 로드 — rootMargin으로 닿기 전에 미리 당긴다
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const root = containerRef.current;
    if (!sentinel || !root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) requestOlder();
      },
      { root, rootMargin: '200px 0px 0px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [requestOlder, resetKey]);

  // 첫 페이지가 화면을 못 채우면 IO가 재발화하지 않는다 — 채울 때까지 직접 당긴다
  useEffect(() => {
    const el = containerRef.current;
    if (!el || el.clientHeight === 0) return; // 미측정 환경(jsdom 등)
    if (el.scrollHeight <= el.clientHeight) requestOlder();
  }, [itemCount, requestOlder]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    // IO 미지원·경계 케이스 보강 — 상단 근처 진입도 과거 로드로 취급
    if (el.scrollTop < NEAR_BOTTOM_PX) requestOlder();
  }, [requestOlder]);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    stickRef.current = true;
    el.scrollTop = el.scrollHeight;
  }, []);

  const scrollToBottomIfSticky = useCallback(() => {
    if (stickRef.current) scrollToBottom();
  }, [scrollToBottom]);

  return { containerRef, topSentinelRef, handleScroll, scrollToBottomIfSticky, scrollToBottom };
}
