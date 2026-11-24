import { defineConfig } from 'vite';
export default defineConfig({
  base: '/ball-academy/',
  build: { target: 'es2022' },
  test: { include: ['tests/unit/**/*.test.js'] }
});
