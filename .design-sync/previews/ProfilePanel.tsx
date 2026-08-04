import { CLINICIAN, ProfilePanel } from 'cure-agent-fe';

/** 프로필 화면 본문 폭(max-w-3xl)보다 좁게 잡아 dl 행의 라벨·값 간격이 카드에서 그대로 보이게 한다. */
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="w-[560px] max-w-full">{children}</div>
);

/** 인증 완료 — 온보딩을 마치고 면허 확인까지 끝난 기본 상태. */
export const Verified = () => (
  <Frame>
    <ProfilePanel me={CLINICIAN} />
  </Frame>
);

/** 확인 중 — 가입 직후의 기본값(PENDING). 지금은 어떤 기능도 막지 않으므로 배지만 바뀐다. */
export const Pending = () => (
  <Frame>
    <ProfilePanel me={{ ...CLINICIAN, verificationStatus: 'PENDING' }} />
  </Frame>
);

/** 인증 반려. */
export const Rejected = () => (
  <Frame>
    <ProfilePanel me={{ ...CLINICIAN, verificationStatus: 'REJECTED' }} />
  </Frame>
);

/** 긴 이메일·한의원명이 라벨을 밀지 않고 값 쪽에서 잘리는지 — dd 의 truncate 확인용. */
export const LongValues = () => (
  <Frame>
    <ProfilePanel
      me={{
        ...CLINICIAN,
        email: 'jiyeon.han.verylongaddress@sohan-hanbang-clinic.example.co.kr',
        clinic: { ...CLINICIAN.clinic, name: '소한한의원 강남점 제2진료부 통합의학센터' },
      }}
    />
  </Frame>
);
