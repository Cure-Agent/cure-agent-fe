import { InvitationLanding } from '@/features/manage-clinic/ui/invitation-landing';

/**
 * 초대 링크 수락 진입 (BE docs/specs/35).
 * 개설자가 발급한 `{invitationId}.{secret}` 토큰이 경로에 실려 온다 — 비인증 화면이다.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<React.ReactElement> {
  const { token } = await params;
  return <InvitationLanding token={token} />;
}
