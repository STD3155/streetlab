import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const pagesBase = process.env.GITHUB_ACTIONS && repositoryName && !repositoryName.endsWith('.github.io')
  ? `/${repositoryName}/`
  : '/';

export default defineConfig({
  plugins: [react()],
  base: pagesBase,
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          geometry: ['@turf/turf', 'proj4'],
          map: ['leaflet', 'react-leaflet'],
          framework: ['react', 'react-dom', 'zustand'],
        },
      },
    },
  },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'] },
  worker: { format: 'es' },
});
