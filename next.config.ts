import type { NextConfig } from 'next';

// 로컬은 Next 프록시로 BE를 same-origin으로 노출한다 (docs/specs/07):
// 쿠키가 first-party로 유지되어 CORS·SameSite 이슈가 없다. 운영 구성은 12단계에서 확정.
const BE_ORIGIN = process.env.BE_ORIGIN ?? 'http://localhost:3000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${BE_ORIGIN}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
