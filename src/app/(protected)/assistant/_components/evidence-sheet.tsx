'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';

/**
 * 좁은 화면의 근거 시트 — 넓은 화면에서 오른쪽 칸이 하던 일을 아래에서 올라오는 판이 맡는다.
 *
 * 칸이 아니라 시트인 이유는 폭이다. 폰에서 근거를 채팅 옆에 세울 자리가 없고, 채팅 아래에
 * 붙이면 근거를 볼 때마다 대화가 밀려난다. 인용을 누른 순간에만 덮었다가 닫으면 대화가 그대로다.
 * 위쪽을 비워 두는 것은 배경을 눌러 닫는 자리이자, 무엇을 읽다 왔는지 보이게 하는 자리다.
 *
 * 열리면 닫기 버튼에 초점을 준다 — 시트가 대화 위를 덮는 동안 키보드 초점이 그 뒤에 남으면,
 * 보이지 않는 곳을 조작하게 된다. 닫히면 연 자리(인용 마커·근거 버튼)로 초점을 돌려준다.
 */
export function EvidenceSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}): React.ReactElement {
  const t = messagesFor(useUiLang());
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div
        data-testid="evidence-sheet-backdrop"
        className="absolute inset-0 bg-gray-900/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.evidencePanelHeading}
        className="absolute inset-x-0 bottom-0 flex max-h-[75dvh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t.closeEvidence}
          className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            className="h-5 w-5"
          >
            <path d="m18 6-12 12" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
        {/* 패널은 칸일 때의 높이·스크롤·테두리·모서리를 들고 온다. 시트는 근거 수만큼만 올라오고
            (위 한도 75dvh) 넘치면 여기서 스크롤한다 — 근거 하나에 화면 3/4를 비워 두지 않는다.
            닫기 버튼은 이 스크롤 밖에 있어 아래로 읽어 내려가도 제자리에 남는다 */}
        <div className="min-h-0 flex-1 overflow-y-auto *:h-auto *:overflow-visible *:rounded-none *:border-0">
          {children}
        </div>
      </div>
    </div>
  );
}
