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

const listeners = new Set<() => void>();

function isUiLang(value: string | null): value is UiLang {
  return value === 'ko' || value === 'en';
}

/**
 * 저장된 선택. 지원하지 않는 값은 **없는 것으로 친다** — storage는 사람이 손으로 고칠 수 있고,
 * 거기 들어온 `fr` 하나가 화면을 빈 문구로 깨뜨리면 안 된다.
 * 접근 자체가 던지는 환경(사파리 프라이빗 모드 등)도 같은 자리로 떨어진다.
 */
function storedUiLang(): UiLang | null {
  try {
    const raw = globalThis.localStorage?.getItem(UI_LANG_STORAGE_KEY) ?? null;
    return isUiLang(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * 이 방문자의 표시 언어.
 *
 * 브라우저 언어는 **1차 서브태그만** 본다 — `ko`·`ko-KR`·`ko-Kore-KR`이 모두 한국어여야 하고,
 * 그렇다고 `startsWith('ko')`로 자르면 `kok`(콘칸어)까지 한국어로 끌려온다.
 * 지원 언어가 둘뿐이라 한국어가 아니면 영어다.
 *
 * SSR에는 `navigator`도 `localStorage`도 없다 — `useUiLang`의 서버 스냅샷이 'ko'를 주므로
 * 이 함수가 서버에서 불릴 일은 없지만, 불려도 오늘 경로인 한국어로 떨어진다.
 */
export function resolveUiLang(): UiLang {
  const chosen = storedUiLang();
  if (chosen) return chosen;

  const browser = globalThis.navigator?.language;
  if (!browser) return 'ko';
  return browser.split('-')[0].toLowerCase() === 'ko' ? 'ko' : 'en';
}

/** 사람이 고른 언어를 기록한다 — 이후 자동 판정을 이긴다. */
export function setUiLang(lang: UiLang): void {
  try {
    globalThis.localStorage?.setItem(UI_LANG_STORAGE_KEY, lang);
  } catch {
    // 저장에 실패해도 이번 화면은 계속 돈다 — 다음 방문에 자동 판정으로 돌아갈 뿐이다
  }
  for (const listener of [...listeners]) listener();
}

/** 표시 언어 구독 — `setUiLang`과 **다른 탭의** storage 변경 양쪽에 반응한다. */
export function subscribeUiLang(onChange: () => void): () => void {
  listeners.add(onChange);
  globalThis.addEventListener?.('storage', onChange);
  return () => {
    listeners.delete(onChange);
    globalThis.removeEventListener?.('storage', onChange);
  };
}

/**
 * 표시 언어 훅.
 *
 * `useSyncExternalStore`를 쓰는 이유는 하이드레이션이다 — 서버는 방문자의 언어를 알 수 없어
 * 'ko'로 그리는데, 클라이언트가 첫 렌더부터 'en'을 읽으면 마크업이 어긋난다. 이 훅은
 * 하이드레이션 동안 **서버 스냅샷을 쓰고** 끝난 뒤 실제 값으로 한 번 다시 그린다.
 */
export function useUiLang(): UiLang {
  return useSyncExternalStore(subscribeUiLang, resolveUiLang, () => 'ko');
}
