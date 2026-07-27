import type { MetadataRoute } from 'next';

/**
 * 홈 화면 추가(A2HS)용 웹 매니페스트.
 * `maskable` 아이콘은 안드로이드가 임의 모양으로 잘라내므로 마크를 안전영역 안쪽까지
 * 줄인 별도 파일이고, `any`는 잘리지 않는 자리에 쓰이는 라운드 플레이트 버전이다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cure Agent',
    short_name: 'Cure Agent',
    description: '한의 임상 지침 기반 어시스턴트',
    lang: 'ko',
    start_url: '/',
    display: 'standalone',
    background_color: '#F9FAFB',
    theme_color: '#047857',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
