import { OnboardingForm } from 'cure-agent-fe';

/**
 * 소셜 인증 후 온보딩. signup/page.tsx 의 카드 껍데기를 그대로 옮겼다.
 * 이메일·소셜 신원은 티켓 안에 있어 폼에 나타나지 않는다 — 한의원 정보만 받는다.
 */
const SignupCard = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
    <h1 className="text-xl font-bold text-emerald-800">의료인 가입</h1>
    <p className="mb-6 mt-1 text-sm text-gray-500">
      소셜 인증이 확인되었습니다. 한의원 정보만 입력하면 가입이 완료됩니다.
    </p>
    {children}
  </div>
);

/** 제공자가 이름을 주지 않은 경우 — 전부 빈 칸에서 시작한다. */
export const Default = () => (
  <SignupCard>
    <OnboardingForm ticket="tkt_01HQ8ZT9G1" />
  </SignupCard>
);

/** 제공자에게서 받은 이름이 미리 채워진 경우. */
export const WithPrefilledName = () => (
  <SignupCard>
    <OnboardingForm ticket="tkt_01HQ8ZT9G1" defaultDisplayName="한지연" />
  </SignupCard>
);
