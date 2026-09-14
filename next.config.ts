import type { NextConfig } from 'next';

// 로컬은 Next 프록시로 BE를 same-origin으로 노출한다 (docs/specs/07):
// 쿠키가 first-party로 유지되어 CORS·SameSite 이슈가 없다. 운영 구성은 12단계에서 확정.
const BE_ORIGIN = process.env.BE_ORIGIN ?? 'http://localhost:3000';
// 에이전트도 같은 오리진 아래 `/api/v1/agent/`로 산다 (BE docs/specs/52) — 운영 nginx의
// `location ^~ /api/v1/agent/`와 같은 분기다. 일반 규칙보다 앞에 있어야 잡힌다.
const AGENT_ORIGIN = process.env.AGENT_ORIGIN ?? 'http://localhost:8000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/agent/:path*',
        destination: `${AGENT_ORIGIN}/api/v1/agent/:path*`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${BE_ORIGIN}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
