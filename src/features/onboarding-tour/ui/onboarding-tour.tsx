'use client';

/**
 * 온보딩 둘러보기의 화면 부분 — 환영 모달, 진행 카드, 완료 카드.
 *
 * `AppShell`에 마운트되므로 **모든 보호 화면에 함께 있다.** 환자 맞춤 경로가 어시스턴트 →
 * 환자 목록 → 환자 상세 → 다시 어시스턴트로 넘어가는데, 화면마다 따로 두면 그 이동 중에
 * 안내가 끊긴다.
 *
 * 짚어야 할 요소를 좌표로 쫓지 않는 이유는 `tour-state.ts`의 `useTourHighlight` 주석에 있다 —
 * 요소는 스스로 링을 두르고, 이 파일은 **무엇을 왜 누르는지**만 한자리에서 말한다.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactElement, useEffect, useRef } from 'react';
import { type MessageKey, formatMessage, messagesFor } from '@/shared/i18n/messages';
import { useUiLang } from '@/shared/i18n/ui-lang';
import { dismissTour, startTourPath, useTourState } from '../model/tour-state';
import {
  TOUR_PATHS,
  TOUR_PATH_NAME_KEYS,
  type TourPath,
  otherTourPath,
} from '../model/tour-steps';

type Messages = Record<MessageKey, string>;

const PATH_CARDS = [
  { path: 'general', titleKey: 'tourPathGeneralTitle', leadKey: 'tourPathGeneralLead' },
  { path: 'patient', titleKey: 'tourPathPatientTitle', leadKey: 'tourPathPatientLead' },
] as const satisfies readonly {
  path: TourPath;
  titleKey: MessageKey;
  leadKey: MessageKey;
}[];

/** 진행·완료 카드가 공유하는 자리와 껍데기 — 두 카드가 같은 지점에서 이어지게 한다 */
const FLOATING_CARD =
  'fixed bottom-6 right-6 z-40 w-72 rounded-xl border border-emerald-200 bg-white p-4 shadow-lg';

const CLOSE_BUTTON = 'shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600';

function CloseIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="m18 6-12 12" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function OnboardingTour(): ReactElement | null {
  const lang = useUiLang();
  const t = messagesFor(lang);
  const state = useTourState();

  if (state.phase === 'off') return null;
  if (state.phase === 'welcome') return <TourWelcome t={t} />;
  if (state.phase === 'finished') return <TourFinished path={state.path} t={t} />;
  return <TourGuide path={state.path} stepIndex={state.stepIndex} t={t} />;
}

/**
 * 경로를 고르는 환영 모달.
 *
 * 모달인 이유는 이것이 **한 번의 갈림길**이기 때문이다 — 두 경로는 서로 다른 화면에서
 * 시작하므로, 배너로 띄워 두면 어느 쪽을 고르든 먼저 화면을 옮겨야 해서 갈림길이 흐려진다.
 * 대신 닫는 길을 셋(✕·나중에 하기·Esc) 열어 둔다.
 */
function TourWelcome({ t }: { t: Messages }): ReactElement {
  const firstPathRef = useRef<HTMLButtonElement | null>(null);

  // 모달이 열리면 첫 선택지에 초점을 준다 — 키보드만 쓰는 사람이 배경을 훑고 오지 않게 한다
  useEffect(() => {
    firstPathRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismissTour();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-welcome-heading"
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="tour-welcome-heading" className="text-lg font-bold text-gray-900">
              {t.tourWelcomeHeading}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{t.tourWelcomeLead}</p>
          </div>
          <button type="button" onClick={dismissTour} aria-label={t.tourClose} className={CLOSE_BUTTON}>
            <CloseIcon />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {PATH_CARDS.map((card, index) => (
            <button
              key={card.path}
              ref={index === 0 ? firstPathRef : undefined}
              type="button"
              onClick={() => startTourPath(card.path)}
              className="rounded-xl border border-gray-200 p-4 text-left hover:border-emerald-600 hover:bg-emerald-50/50"
            >
              <p className="text-sm font-medium text-gray-900">{t[card.titleKey]}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{t[card.leadKey]}</p>
              <p className="mt-2 text-xs font-medium text-emerald-700">
                {formatMessage(t.tourStepCount, { count: TOUR_PATHS[card.path].length })}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={dismissTour}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            {t.tourWelcomeDismiss}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 진행 중 카드.
 *
 * 우하단에 두는 이유는 이 앱에서 **짚을 것이 하나도 없는 유일한 구석**이라서다 — 어시스턴트
 * 3단 화면에서 눌러야 할 것들(새 대화·예시·전송)은 전부 왼쪽과 가운데에 있고, 환자 상세의
 * 「환자 맞춤 대화 시작」은 오른쪽 위에 있다.
 */
function TourGuide({
  path,
  stepIndex,
  t,
}: {
  path: TourPath;
  stepIndex: number;
  t: Messages;
}): ReactElement {
  const pathname = usePathname();
  const steps = TOUR_PATHS[path];
  const step = steps[stepIndex];
  // 화면이 다르면 짚을 요소가 아예 없다 — 안내 대신 그 화면으로 가는 길을 준다
  const offRoute = step.route !== null && !pathname.startsWith(step.route.href);

  return (
    <div className={FLOATING_CARD}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-emerald-700">
          {t[TOUR_PATH_NAME_KEYS[path]]}
          {' · '}
          {formatMessage(t.tourProgress, { current: stepIndex + 1, total: steps.length })}
        </p>
        <button type="button" onClick={dismissTour} aria-label={t.tourClose} className={CLOSE_BUTTON}>
          <CloseIcon />
        </button>
      </div>

      {/* 남은 길이가 보여야 「끝이 있는 안내」로 읽힌다 — 폭은 계산값이라 유틸리티로 못 적는다 */}
      <div className="mt-2 h-1 w-full rounded-full bg-gray-100">
        <div
          className="h-1 rounded-full bg-emerald-600"
          style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* 단계가 바뀌는 것이 이 카드의 전부다 — 화면을 보지 않는 사람에게도 그 변화를 알린다 */}
      <div aria-live="polite" className="mt-3">
        <p className="text-sm font-medium text-gray-900">{t[step.titleKey]}</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600">{t[step.bodyKey]}</p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {offRoute && step.route ? (
          <Link
            href={step.route.href}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
          >
            {t[step.route.labelKey]}
          </Link>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={dismissTour}
          className="text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
        >
          {t.tourSkip}
        </button>
      </div>
    </div>
  );
}

/** 한 경로를 마친 자리 — 같은 카드 자리에서 다른 경로를 권한다 */
function TourFinished({ path, t }: { path: TourPath; t: Messages }): ReactElement {
  const next = otherTourPath(path);
  return (
    <div className={FLOATING_CARD} role="status">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-emerald-800">{t.tourFinishedHeading}</p>
        <button type="button" onClick={dismissTour} aria-label={t.tourClose} className={CLOSE_BUTTON}>
          <CloseIcon />
        </button>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-gray-600">
        {path === 'general' ? t.tourFinishedGeneralNext : t.tourFinishedPatientNext}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => startTourPath(next)}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
        >
          {t.tourStartOtherPath}
        </button>
        <button
          type="button"
          onClick={dismissTour}
          className="text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
        >
          {t.tourDone}
        </button>
      </div>
    </div>
  );
}
