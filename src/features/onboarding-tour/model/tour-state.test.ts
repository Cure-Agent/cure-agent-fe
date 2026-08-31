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
    expect(parseTourState('patient:2')).toEqual({ phase: 'running', path: 'patient', stepIndex: 2 });
    expect(parseTourState('general:done')).toEqual({ phase: 'finished', path: 'general' });
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

describe('단계 전진', () => {
  it('경로를 고르면 첫 단계에서 시작한다', () => {
    startTourPath('general');
    expect(parseTourState(stored())).toEqual({ phase: 'running', path: 'general', stepIndex: 0 });
  });

  it('지금 단계의 앵커를 해내면 다음 단계로 넘어간다', () => {
    startTourPath('general');
    completeTourStep('new-conversation');
    expect(parseTourState(stored())).toEqual({ phase: 'running', path: 'general', stepIndex: 1 });
  });

  it('다른 앵커는 아무 일도 하지 않는다 — 투어와 무관한 조작이 단계를 밀지 않는다', () => {
    startTourPath('general');
    completeTourStep('patient-row');
    expect(parseTourState(stored())).toEqual({ phase: 'running', path: 'general', stepIndex: 0 });
  });

  /** 예시를 고르지 않고 직접 써서 바로 보내는 경로 — 투어가 사용자보다 뒤처진 채 굳으면 안 된다 */
  it('앞 단계를 건너뛰고 뒤 단계를 먼저 해내면 그 자리까지 함께 넘긴다', () => {
    startTourPath('general');
    completeTourStep('send-question');
    expect(parseTourState(stored())).toEqual({ phase: 'running', path: 'general', stepIndex: 3 });
  });

  it('이미 지나온 앵커는 되돌리지 않는다', () => {
    startTourPath('general');
    completeTourStep('send-question');
    completeTourStep('new-conversation');
    expect(parseTourState(stored())).toEqual({ phase: 'running', path: 'general', stepIndex: 3 });
  });

  it('마지막 단계를 해내면 완료가 된다', () => {
    startTourPath('general');
    for (const step of TOUR_PATHS.general) completeTourStep(step.anchor);
    expect(parseTourState(stored())).toEqual({ phase: 'finished', path: 'general' });
  });

  it('꺼져 있을 때의 조작은 투어를 되살리지 않는다', () => {
    completeTourStep('new-conversation');
    expect(stored()).toBeNull();
  });
});
