'use client';

/**
 * 표시 언어 선택 — 공용 컨트롤.
 *
 * 로그인한 화면(AppShell 사이드바)과 로그인 전 화면((auth) 레이아웃)이 **같은 컨트롤**을 쓴다.
 * 두 벌로 갈라 두면 선택지 라벨·저장 규칙·접근 이름이 조용히 어긋난다.
 *
 * 표시 언어를 prop으로 받지 않고 **스스로 읽는다** — 호출부가 서버 컴포넌트일 수 있어
 * (`src/app/(auth)/layout.tsx`) 위에서 내려줄 방법이 없다.
 *
 * 배치(여백·위치)는 호출부가 `className`으로 정한다. 이 컴포넌트는 컨트롤의 모양과 동작만 갖는다.
 */
import { type MessageKey, messagesFor } from '@/shared/i18n/messages';
import { type UiLang, setUiLang, useUiLang } from '@/shared/i18n/ui-lang';

/**
 * **선택지 라벨을 번역하지 않는다** — 각 항목을 그 언어 자체로(`한국어`·`English`) 적는다.
 * 데모의 실제 시나리오는 「한국어 로케일 노트북으로 영어권 방문자에게 시연」이고, 그때 화면은
 * 전부 한국어다. 라벨을 현재 UI 언어로 번역하면 **한국어를 못 읽는 사람이 자기 항목을 찾을
 * 수 없다.** 언어 이름을 그 언어로 적는 것이 이 컨트롤의 유일한 요건이다.
 */
const LANG_OPTIONS = [
  { value: 'ko', label: '한국어', code: 'KO', switchKey: 'switchToKorean' },
  { value: 'en', label: 'English', code: 'EN', switchKey: 'switchToEnglish' },
] as const satisfies readonly {
  value: UiLang;
  label: string;
  code: string;
  switchKey: MessageKey;
}[];

/**
 * 두 항목을 나란히 둔 기본형. 폭이 있는 자리(사이드바 하단·비인증 화면 상단)에서 쓴다.
 */
export function LanguageSwitch({ className }: { className?: string }): React.ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  return (
    <div
      role="group"
      aria-label={t.displayLanguage}
      className={`flex rounded-lg border border-gray-300 bg-white p-0.5 ${className ?? ''}`}
    >
      {LANG_OPTIONS.map((option) => {
        const active = option.value === lang;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setUiLang(option.value)}
            aria-pressed={active}
            className={`flex-1 rounded-md px-3 py-1 text-xs font-medium ${
              active ? 'bg-emerald-50 text-emerald-800' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 접힘 레일용 — 폭이 56px뿐이라 두 항목을 나란히 둘 수 없다.
 * 현재 언어 코드를 보여주고 누르면 다른 언어로 넘어간다. 접근성 이름은 **넘어갈 대상**을
 * 말한다 — 코드만 읽으면 「지금 이것」인지 「눌러서 이것」인지 갈리지 않는다.
 */
export function LanguageRailToggle({ className }: { className?: string }): React.ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const current = LANG_OPTIONS.find((option) => option.value === lang) ?? LANG_OPTIONS[0];
  const next = LANG_OPTIONS.find((option) => option.value !== lang) ?? LANG_OPTIONS[1];
  return (
    <button
      type="button"
      onClick={() => setUiLang(next.value)}
      aria-label={t[next.switchKey]}
      title={t[next.switchKey]}
      className={`text-xs font-semibold ${className ?? ''}`}
    >
      {current.code}
    </button>
  );
}
