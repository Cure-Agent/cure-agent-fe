'use client';

/**
 * 온보딩 둘러보기의 진행 상태.
 *
 * **서버에는 이 상태를 둘 자리가 없다** — `ClinicianResponseDto`에 가입 시각도, 온보딩
 * 완료 플래그도 없다. 그래서 「신규 회원」의 판정은 서버 조회가 아니라 **가입을 실제로
 * 통과한 순간**(`useCompleteSignUp`)에 이 저장소로 예약하는 방식이다. 로그인만 한 사람에게는
 * 뜨지 않고, 한 번 닫으면 그 브라우저에서 다시 뜨지 않는다.
 *
 * localStorage에 남기는 이유는 취향이 아니라 필수다 — 환자 맞춤 경로는 `RequestGuidanceButton`의
 * `window.location.assign`으로 **페이지를 통째로 다시 띄우며** 화면을 옮긴다. 메모리에만
 * 들고 있으면 바로 그 지점에서 투어가 증발한다.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { TOUR_PATHS, type TourAnchor, type TourPath } from './tour-steps';

export const TOUR_STORAGE_KEY = 'cure.onboardingTour';

/**
 * 지금 걷는 경로보다 **먼저 마친 경로**. 없으면 `null`.
 *
 * 두 경로가 전부 끝났다는 것을 판정할 수 있는 유일한 근거다 — 이것이 없던 시절에는
 * `completeTourStep`이 `<경로>:done`으로 앞선 기록을 통째로 덮어써서, 완료 카드가 늘
 * 「다른 경로」를 권했고 두 경로를 오가는 왕복이 닫히지 않았다.
 */
type PriorPath = TourPath | null;

export type TourState =
  | { readonly phase: 'off' }
  /** 가입 직후 — 다음 보호 화면에서 경로를 고르는 환영 모달을 띄운다 */
  | { readonly phase: 'welcome' }
  | {
      readonly phase: 'running';
      readonly path: TourPath;
      readonly stepIndex: number;
      readonly priorPath: PriorPath;
    }
  /** 마지막 단계까지 마침 — `priorPath`가 있으면 남은 경로가 없다는 뜻이다 */
  | { readonly phase: 'finished'; readonly path: TourPath; readonly priorPath: PriorPath };

const OFF: TourState = { phase: 'off' };

/**
 * `<경로>:<단계|done>`에 `|<먼저 마친 경로>`가 선택적으로 붙는다.
 *
 * 뒷조각을 **선택**으로 둔 덕에 이미 배포된 브라우저의 옛 값(`general:2`·`general:done`)이
 * 그대로 읽힌다 — 저장소에 판 번호를 두고 갈아엎을 만큼 큰 변화가 아니다.
 */
const PROGRESS = /^(general|patient):(\d+|done)(?:\|(general|patient))?$/;

/** 상태 → 저장 문자열. 읽는 쪽이 `PROGRESS` 하나이므로 쓰는 쪽도 여기 하나로 모은다 */
function serialize(path: TourPath, progress: number | 'done', priorPath: PriorPath): string {
  return `${path}:${progress}${priorPath === null ? '' : `|${priorPath}`}`;
}

/**
 * 저장된 문자열 → 상태.
 *
 * 알아볼 수 없는 값은 **없는 것으로 친다** — 저장소는 사람이 손으로 고칠 수 있고, 단계 수가
 * 줄어드는 개편 뒤에는 예전 인덱스가 남아 있을 수도 있다. 어느 쪽이든 빈 카드를 띄우는 대신
 * 투어를 끈다(`ui-lang`의 지원하지 않는 언어 처리와 같은 규칙).
 */
export function parseTourState(raw: string | null): TourState {
  if (raw === 'welcome') return { phase: 'welcome' };
  const matched = PROGRESS.exec(raw ?? '');
  if (!matched) return OFF;
  const path = matched[1] as TourPath;
  const priorPath = (matched[3] as TourPath | undefined) ?? null;
  // 자기 자신을 먼저 마쳤다는 값은 이 코드가 만들 수 없다 — 손으로 고친 값이므로 끈다
  if (priorPath === path) return OFF;
  if (matched[2] === 'done') return { phase: 'finished', path, priorPath };
  const stepIndex = Number(matched[2]);
  return stepIndex < TOUR_PATHS[path].length
    ? { phase: 'running', path, stepIndex, priorPath }
    : OFF;
}

const listeners = new Set<() => void>();

/**
 * 저장이 한 번이라도 막히면(사파리 프라이빗 모드 등) 그 뒤로는 아래 메모리 값이 이번 방문의
 * 진실이다. 저장하지 못했다는 이유로 투어가 첫 클릭에서 멈추면 안 된다 — 다음 방문에
 * 이어지지 않을 뿐, 지금 보고 있는 안내는 끝까지 돌아야 한다.
 */
let persisted = true;
let memory: string | null = null;

function snapshot(): string | null {
  if (!persisted) return memory;
  try {
    return globalThis.localStorage?.getItem(TOUR_STORAGE_KEY) ?? null;
  } catch {
    persisted = false;
    return memory;
  }
}

function commit(value: string | null): void {
  memory = value;
  try {
    const storage = globalThis.localStorage;
    if (value === null) storage?.removeItem(TOUR_STORAGE_KEY);
    else storage?.setItem(TOUR_STORAGE_KEY, value);
  } catch {
    persisted = false;
  }
  for (const listener of [...listeners]) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  globalThis.addEventListener?.('storage', onChange);
  return () => {
    listeners.delete(onChange);
    globalThis.removeEventListener?.('storage', onChange);
  };
}

/**
 * 둘러보기 상태 훅.
 *
 * 스냅샷으로 **문자열**을 돌려주고 파싱은 훅 안에서 한다 — `useSyncExternalStore`는 스냅샷
 * 동일성으로 재렌더를 정하므로, 매번 새 객체를 만들어 돌려주면 무한 렌더가 된다.
 *
 * 서버 스냅샷이 `null`(= 꺼짐)인 것은 `ui-lang`과 같은 이유다: 서버는 방문자의 저장소를 알 수
 * 없다. `AppShell`은 세션 확인 뒤에만 마운트되므로 이 값이 실제로 쓰이는 일은 없다.
 */
export function useTourState(): TourState {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  return useMemo(() => parseTourState(raw), [raw]);
}

/** 가입을 막 끝낸 사람 — 다음 보호 화면에서 환영 모달을 띄운다 */
export function scheduleWelcomeTour(): void {
  commit('welcome');
}

/**
 * 경로를 시작한다.
 *
 * **먼저 마친 경로는 호출부가 아니라 여기서 판정한다.** 이 함수를 부르는 곳은 둘인데
 * (환영 모달의 경로 카드, 완료 카드의 「이어서 해보기」) 둘 다 자기가 어디서 왔는지만 알 뿐
 * 저장 형식은 모른다. 지금 상태가 「다른 경로를 마친 직후」인지는 저장소가 이미 알고 있으므로
 * 그것을 여기서 읽는다 — 호출부의 시그니처는 그대로다.
 */
export function startTourPath(path: TourPath): void {
  const state = parseTourState(snapshot());
  const priorPath = state.phase === 'finished' && state.path !== path ? state.path : null;
  commit(serialize(path, 0, priorPath));
}

/** 닫기·건너뛰기 — 이 브라우저에서 다시 뜨지 않는다 */
export function dismissTour(): void {
  commit(null);
}

/** 프로필 화면의 「시작 가이드 다시 보기」 — 경로 선택부터 되돌린다 */
export function restartTour(): void {
  commit('welcome');
}

function currentStepIndexOf(state: TourState, anchor: TourAnchor): number | null {
  if (state.phase !== 'running') return null;
  const steps = TOUR_PATHS[state.path];
  /**
   * 남은 단계 **전체**에서 찾는다 — 앞선 단계를 건너뛰고 뒤를 먼저 해내는 경로가 실제로 있다.
   * 예시 질의문을 고르지 않고 직접 써서 바로 전송하는 경우가 그렇고, 그때 「예시를 고르세요」에
   * 멈춰 있으면 투어가 사용자보다 뒤처진 채 굳는다. 이미 지나온 단계(음수)는 무시한다 —
   * 되돌아가는 안내는 안내가 아니라 방해다.
   */
  const offset = steps.slice(state.stepIndex).findIndex((step) => step.anchor === anchor);
  return offset < 0 ? null : state.stepIndex + offset;
}

/**
 * 이 앵커가 지금(또는 앞으로) 할 단계라면 그 자리까지 넘긴다. 아니면 아무 일도 하지 않는다.
 *
 * 호출부가 투어 상태를 몰라도 되게 하려는 것이다 — 각 기능의 핸들러는 「내가 무엇을 했다」만
 * 알리고, 그것이 지금 안내 중인 단계인지는 여기서 판정한다.
 */
export function completeTourStep(anchor: TourAnchor): void {
  const state = parseTourState(snapshot());
  const index = currentStepIndexOf(state, anchor);
  if (index === null || state.phase !== 'running') return;
  const next = index + 1;
  // 먼저 마친 경로를 함께 넘긴다 — 여기서 흘리면 마지막 단계에서 종료 지점이 사라진다
  commit(
    serialize(
      state.path,
      next < TOUR_PATHS[state.path].length ? next : 'done',
      state.priorPath,
    ),
  );
}

/**
 * 둘러보기가 짚는 요소에 붙일 클래스. 지금 단계의 앵커가 아니면 빈 문자열이다.
 *
 * 좌표를 재서 말풍선을 띄우지 않고 **요소 자신이 자기를 강조**하게 하는 이유는, 이 앱의
 * 강조 대상이 전부 내부 스크롤 영역 안에 있기 때문이다 — `getBoundingClientRect`로 띄운
 * 말풍선은 그 영역이 스크롤될 때마다 어긋난다. 링은 요소를 따라다닌다.
 */
export function useTourHighlight(anchor: TourAnchor): string {
  const state = useTourState();
  const active =
    state.phase === 'running' &&
    TOUR_PATHS[state.path][state.stepIndex]?.anchor === anchor;
  return active ? TOUR_HIGHLIGHT_CLASS : '';
}

/** `globals.css`의 `tour-highlight` — 요소 안쪽에 링을 두르고 그 안으로 맥동을 번지게 한다 */
export const TOUR_HIGHLIGHT_CLASS = 'tour-highlight';

/**
 * 진한 emerald 버튼에 함께 붙이는 링 색 뒤집기.
 *
 * 링을 요소 **안쪽에** 그리기 때문에 필요하다 — 밖에 그리던 시절에는 흰 간격이 배경과 링을
 * 갈라 줬지만, 안쪽에서는 emerald-700 버튼 위의 emerald-500 링이 그대로 묻힌다. 강조 대상
 * 중 「새 대화」·「전송」·「환자 맞춤 대화 시작」 셋이 그런 버튼이라 그 셋만 흰 링으로 바꾼다.
 *
 * 둘러보기가 꺼져 있으면 변수만 선언될 뿐 아무것도 그리지 않으므로 늘 붙여 두어도 된다.
 */
export const TOUR_HIGHLIGHT_ON_SOLID = '[--tour-ring:#fff]';
