import { SocialLoginButtons } from 'cure-agent-fe';

/**
 * 로그인 진입. login/page.tsx 의 카드 껍데기를 그대로 옮겼다 — 이 컴포넌트는 항상
 * 이 폭(max-w-sm)의 카드 안에서 쓰인다.
 *
 * 제공자 버튼은 각 사의 로그인 가이드라인 색을 그대로 쓴다 (카카오 #FEE500, 네이버 #03C75A).
 * 브랜드 emerald 로 바꾸지 말 것.
 */
const LoginCard = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
    <h1 className="text-xl font-bold text-emerald-800">Cure Agent</h1>
    <p className="mb-6 mt-1 text-sm text-gray-500">한의 임상 지침 기반 어시스턴트</p>
    {children}
    <p className="mt-6 text-center text-xs leading-relaxed text-gray-400">
      처음 로그인하면 한의원 정보를 입력하는 가입 절차로 이어집니다.
    </p>
  </div>
);

/** 활성화된 제공자만 내려온다 — 3사 모두 설정된 상태. */
export const Default = () => (
  <LoginCard>
    <SocialLoginButtons />
  </LoginCard>
);

/** 콜백이 ?error= 로 되돌려 보낸 경우 — 코드가 사용자 문구로 번역된다. */
export const WithError = () => (
  <LoginCard>
    <SocialLoginButtons error="AUTH_OAUTH_DENIED" />
  </LoginCard>
);
