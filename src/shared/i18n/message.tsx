'use client';

/**
 * 문구 하나를 표시 언어로 그리는 최소 컴포넌트.
 *
 * **서버 컴포넌트를 위한 것이다.** 표시 언어는 localStorage와 `navigator.language`에서 나오므로
 * 서버는 알 수 없고, `useUiLang()`도 부를 수 없다. 문구 몇 줄 때문에 페이지 전체를
 * `'use client'`로 내리는 대신, 그 문구만 클라이언트 경계로 감싼다.
 *
 * 클라이언트 컴포넌트에서는 쓰지 말 것 — 거기서는 `useUiLang()` + `messagesFor(lang)`으로
 * 한 번 풀어 쓰는 편이 낫다. 문구마다 컴포넌트를 하나씩 만들 이유가 없다.
 */
import { type MessageKey, messagesFor } from './messages';
import { useUiLang } from './ui-lang';

export function Message({ k }: { k: MessageKey }): React.ReactElement {
  const lang = useUiLang();
  return <>{messagesFor(lang)[k]}</>;
}
