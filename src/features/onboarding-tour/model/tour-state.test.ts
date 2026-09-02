// @vitest-environment happy-dom
// 둘러보기 진행 상태 — 저장된 값과 상태의 대응, 그리고 단계 전진 규칙
import { beforeEach, describe, expect, it } from 'vitest';
import {
  TOUR_STORAGE_KEY,
  completeTourStep,
  dismissTour,
  parseTourState,
  restartTour,
  scheduleWelcomeTour,
  startTourPath,
} from './tour-state';
import { TOUR_PATHS } from './tour-steps';

beforeEach(() => {
  localStorage.clear();
});

const stored = (): string | null => localStorage.getItem(TOUR_STORAGE_KEY);

describe('저장된 값 → 상태', () => {
  it('값이 없으면 꺼짐 — 기존 사용자에게는 아무것도 뜨지 않는다', () => {
    expect(parseTourState(null)).toEqual({ phase: 'off' });
  });

  it('welcome은 경로 선택 모달, path:n은 진행, path:done은 완료', () => {
    expect(parseTourState('welcome')).toEqual({ phase: 'welcome' });
    expect(parseTourState('patient:2')).toEqual({
      phase: 'running',
      path: 'patient',
      stepIndex: 2,
      priorPath: null,
    });
    expect(parseTourState('general:done')).toEqual({
      phase: 'finished',
      path: 'general',
      priorPath: null,
    });
  });

  it('먼저 마친 경로 세그먼트가 있으면 완료 상태에 싣는다', () => {
    expect(parseTourState('patient:done|general')).toEqual({
      phase: 'finished',
      path: 'patient',
      priorPath: 'general',
    });
  });

  it('먼저 마친 경로 세그먼트가 있으면 진행 상태에도 싣는다', () => {
    expect(parseTourState('patient:2|general')).toEqual({
      phase: 'running',
      path: 'patient',
      stepIndex: 2,
      priorPath: 'general',
    });
  });

  it('먼저 마친 경로가 현재 경로와 같으면 꺼짐으로 떨어진다', () => {
    expect(parseTourState('general:done|general')).toEqual({ phase: 'off' });
    // 세그먼트 자체를 전부 거부해서 우연히 꺼지는 구현과 구분한다
    expect(parseTourState('general:done|patient')).toEqual({
      phase: 'finished',
      path: 'general',
      priorPath: 'patient',
    });
  });

  it('먼저 마친 경로가 아닌 값이면 꺼짐으로 떨어진다', () => {
    expect(parseTourState('general:done|other')).toEqual({ phase: 'off' });
    // 올바른 반대 경로 세그먼트는 같은 자리에서 읽을 수 있어야 한다
    expect(parseTourState('patient:done|general')).toEqual({
      phase: 'finished',
      path: 'patient',
      priorPath: 'general',
    });
  });

  /**
   * 저장소는 사람이 손으로 고칠 수 있고, 단계가 줄어드는 개편 뒤에는 예전 인덱스가 남는다.
   * 어느 쪽이든 빈 카드를 띄우는 대신 투어를 꺼야 한다.
   */
  it('알아볼 수 없는 값과 범위를 벗어난 단계는 꺼짐으로 떨어진다', () => {
    expect(parseTourState('무엇이든')).toEqual({ phase: 'off' });
    expect(parseTourState('other:0')).toEqual({ phase: 'off' });
    expect(parseTourState(`general:${TOUR_PATHS.general.length}`)).toEqual({ phase: 'off' });
  });
});

describe('둘러보기 예약과 종료', () => {
  it('가입 직후 예약하면 환영 모달 상태가 저장소에 남는다', () => {
    scheduleWelcomeTour();
    expect(parseTourState(stored())).toEqual({ phase: 'welcome' });
  });

  it('닫으면 값 자체를 지운다 — 같은 브라우저에서 다시 뜨지 않는다', () => {
    scheduleWelcomeTour();
    dismissTour();
    expect(stored()).toBeNull();
  });

  it('다시 보기는 경로 선택부터 되돌린다', () => {
    startTourPath('general');
    restartTour();
    expect(parseTourState(stored())).toEqual({ phase: 'welcome' });
  });
});

describe('먼저 마친 경로 기록', () => {
  it('완료 카드에서 다른 경로를 시작하면 저장값과 진행 상태에 먼저 마친 경로가 남는다', () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'general:done');

    startTourPath('patient');

    expect(stored()).toBe('patient:0|general');
    expect(parseTourState(stored())).toEqual({
      phase: 'running',
      path: 'patient',
      stepIndex: 0,
      priorPath: 'general',
    });
  });

  it('첫 선택과 같은 경로 재시작에는 기록하지 않고, 다른 경로에만 기록한다', () => {
    startTourPath('general');
    expect(stored()).toBe('general:0');

    localStorage.setItem(TOUR_STORAGE_KEY, 'general:done');
    startTourPath('general');
    expect(stored()).toBe('general:0');

    localStorage.setItem(TOUR_STORAGE_KEY, 'general:done');
    startTourPath('patient');
    expect(stored()).toBe('patient:0|general');
  });

  it('단계를 넘겨도 먼저 마친 경로를 보존한다', () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'patient:0|general');

    completeTourStep('nav-patients');

    expect(stored()).toBe('patient:1|general');
  });

  it('다른 경로의 마지막 단계까지 마쳐도 먼저 마친 경로를 보존한다', () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'patient:0|general');

    for (const step of TOUR_PATHS.patient) completeTourStep(step.anchor);

    expect(stored()).toBe('patient:done|general');
  });
});

describe('단계 전진', () => {
  it('경로를 고르면 첫 단계에서 시작한다', () => {
    startTourPath('general');
    expect(parseTourState(stored())).toEqual({
      phase: 'running',
      path: 'general',
      stepIndex: 0,
      priorPath: null,
    });
  });

  it('지금 단계의 앵커를 해내면 다음 단계로 넘어간다', () => {
    startTourPath('general');
    completeTourStep('new-conversation');
    expect(parseTourState(stored())).toEqual({
      phase: 'running',
      path: 'general',
      stepIndex: 1,
      priorPath: null,
    });
  });

  it('다른 앵커는 아무 일도 하지 않는다 — 투어와 무관한 조작이 단계를 밀지 않는다', () => {
    startTourPath('general');
    completeTourStep('patient-row');
    expect(parseTourState(stored())).toEqual({
      phase: 'running',
      path: 'general',
      stepIndex: 0,
      priorPath: null,
    });
  });

  /** 예시를 고르지 않고 직접 써서 바로 보내는 경로 — 투어가 사용자보다 뒤처진 채 굳으면 안 된다 */
  it('앞 단계를 건너뛰고 뒤 단계를 먼저 해내면 그 자리까지 함께 넘긴다', () => {
    startTourPath('general');
    completeTourStep('send-question');
    expect(parseTourState(stored())).toEqual({
      phase: 'running',
      path: 'general',
      stepIndex: 3,
      priorPath: null,
    });
  });

  it('이미 지나온 앵커는 되돌리지 않는다', () => {
    startTourPath('general');
    completeTourStep('send-question');
    completeTourStep('new-conversation');
    expect(parseTourState(stored())).toEqual({
      phase: 'running',
      path: 'general',
      stepIndex: 3,
      priorPath: null,
    });
  });

  it('마지막 단계를 해내면 완료가 된다', () => {
    startTourPath('general');
    for (const step of TOUR_PATHS.general) completeTourStep(step.anchor);
    expect(parseTourState(stored())).toEqual({
      phase: 'finished',
      path: 'general',
      priorPath: null,
    });
  });

  it('꺼져 있을 때의 조작은 투어를 되살리지 않는다', () => {
    completeTourStep('new-conversation');
    expect(stored()).toBeNull();
  });
});
