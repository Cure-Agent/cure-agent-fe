/**
 * 초대 링크 전달·보관 (BE docs/specs/35).
 *
 * BE의 소셜 콜백은 `/signup?ticket=`으로만 되돌아온다 — 초대 토큰을 실어 보낼 자리가 없다.
 * 그래서 링크를 연 시점에 토큰을 sessionStorage에 맡겨 두고 온보딩에서 되찾는다.
 * 소셜 로그인은 같은 탭의 전체 페이지 이동이므로 왕복 동안 값이 살아남는다.
 *
 * localStorage가 아니라 sessionStorage인 이유: 초대 토큰은 1회용 합류 권한이라
 * 탭을 닫으면 함께 사라져야 하고, 다른 탭의 가입 흐름에 새어 들어가서도 안 된다.
 */
const STORAGE_KEY = 'cure.invitationToken';

/** 개설자가 복사해 전달할 절대 URL. origin은 실행 중인 FE 것을 그대로 쓴다 */
export function invitationLink(token: string): string {
  if (typeof window === 'undefined') return `/invite/${token}`;
  return `${window.location.origin}/invite/${encodeURIComponent(token)}`;
}

export function stashInvitationToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // 프라이빗 모드 등 저장 불가 — 합류는 실패하지만 로그인 자체는 막지 않는다
  }
}

/**
 * 읽기만 한다. 지우는 것은 가입에 **성공한 뒤**다 — 읽으면서 비우면
 * 폼 검증 실패로 한 번 되돌아왔을 때 합류 맥락이 사라진다.
 */
export function peekInvitationToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearInvitationToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 지우지 못해도 1회용이라 서버가 재사용을 404로 막는다
  }
}
