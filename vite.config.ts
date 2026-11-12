import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/de-calculator/',
  build: {
    // Data-URI inlining would violate default-src 'self'.
    assetsInlineLimit: 0,
    // The module-preload polyfill is an inline script, which CSP blocks.
    modulePreload: { polyfill: false },
    sourcemap: false,
    target: 'es2022',
    cssCodeSplit: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
