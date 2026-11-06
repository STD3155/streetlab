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
        manualChunks(id) {
          if (id.includes('/node_modules/@turf/jsts/')) return 'turf-buffer-engine';
          if (id.includes('/node_modules/@turf/buffer/')) return 'turf-buffer';
          if (id.includes('/node_modules/@turf/') || id.includes('/node_modules/proj4/')) return 'geometry';
          if (id.includes('/node_modules/leaflet/') || id.includes('/node_modules/react-leaflet/')) return 'map';
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/zustand/')) return 'framework';
        },
      },
    },
  },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'] },
  worker: { format: 'es' },
});
