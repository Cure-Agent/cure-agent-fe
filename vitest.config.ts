import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'node', // 컴포넌트 테스트는 파일 상단 @vitest-environment happy-dom 지정
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/shared/test/setup-dom.ts'],
  },
});
