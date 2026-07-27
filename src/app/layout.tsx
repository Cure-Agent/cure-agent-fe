import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

const TITLE = 'Cure Agent';
const DESCRIPTION = '한의 임상 지침 기반 어시스턴트';

// opengraph-image.png 의 URL을 절대경로로 만들려면 오리진이 필요하다. Vercel이 주는
// 배포 도메인을 기본으로 쓰고, 커스텀 도메인을 붙였으면 NEXT_PUBLIC_SITE_URL로 고정한다.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3001');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    locale: 'ko_KR',
    url: '/',
  },
};

export const viewport: Viewport = {
  themeColor: '#047857',
};

export default function RootLayout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <html lang="ko">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
