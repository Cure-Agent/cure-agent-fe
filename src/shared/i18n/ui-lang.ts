/**
 * UI 표시 언어 (BE docs/specs/42 — 다국어 데모).
 *
 * 판정 축은 둘뿐이다: 사람이 고른 값(localStorage)과 브라우저가 알려주는 값
 * (`navigator.language`). 고른 값이 언제나 이긴다 — 자동 판정은 첫 방문의 기본값일 뿐이고,
 * 뒤집을 수 없는 자동 판정은 판정이 아니라 강제다.
 *
 * **답변 언어는 여기서 유도하지 않는다.** 화면 언어와 질의 언어는 다른 축이고,
 * 요청에 싣는 `responseLang`은 입력 문장에서 유도한다
 * (`features/ask-guideline/lib/response-lang.ts` — 스펙 판단표).
 */
import { useSyncExternalStore } from 'react';

export type UiLang = 'ko' | 'en';

export const UI_LANG_STORAGE_KEY = 'cure.uiLang';

/** 이 대화 세션의 표시 언어. SSR에는 `navigator`도 `localStorage`도 없다 — 'ko'로 떨어진다. */
export function resolveUiLang(): UiLang {
  return 'ko';
}

/** 사람이 고른 언어를 기록한다 — 이후 자동 판정을 이긴다. */
export function setUiLang(_lang: UiLang): void {
  void _lang;
}

/** 표시 언어 구독 — `setUiLang`과 다른 탭의 storage 변경에 반응한다. */
export function subscribeUiLang(_onChange: () => void): () => void {
  void _onChange;
  return () => {};
}

export function useUiLang(): UiLang {
  return useSyncExternalStore(subscribeUiLang, resolveUiLang, () => 'ko');
}
