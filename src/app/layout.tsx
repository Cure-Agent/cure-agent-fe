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
  // 안드로이드 크롬은 키보드가 올라와도 레이아웃 뷰포트를 그대로 둔다(기본 resizes-visual) —
  // 화면 맨 아래 붙은 채팅 입력창이 키보드 뒤로 들어가고, 브라우저가 화면을 밀어 올리면서
  // 채팅방 머리가 밖으로 나간다. 레이아웃째 줄여 입력창이 키보드 바로 위에 서게 한다.
  // iOS 사파리는 이 값을 읽지 않는다.
  interactiveWidget: 'resizes-content',
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
