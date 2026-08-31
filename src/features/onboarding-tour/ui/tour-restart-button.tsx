'use client';

/**
 * 둘러보기를 다시 여는 진입점.
 *
 * 「최초 1회」 규칙은 그대로 두되(가입 직후 자동으로 뜨는 것은 한 번뿐), 되돌릴 길은 남긴다 —
 * 데모 중 기존 계정으로 로그인했거나 실수로 닫은 경우에 저장소를 손으로 지우게 할 수는 없다.
 *
 * 사이드바가 아니라 프로필 화면에 두는 이유는 이것이 **신규가 아닌 사람에게는 필요 없는
 * 항목**이기 때문이다. 사이드바에 두면 모든 화면에서 모두에게 계속 보인다.
 */
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';
import { restartTour } from '../model/tour-state';

export function TourRestartButton(): ReactElement {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const router = useRouter();

  // 어시스턴트로 옮기고 나서 연다 — 두 경로 중 하나는 이 화면에서 시작할 수 없다
  const handleClick = (): void => {
    restartTour();
    router.push('/assistant');
  };

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-gray-900">{t.tourRestartHeading}</h2>
      <p className="mt-1 text-sm text-gray-500">{t.tourRestartHint}</p>
      <button
        type="button"
        onClick={handleClick}
        className="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
      >
        {t.tourRestart}
      </button>
    </div>
  );
}
