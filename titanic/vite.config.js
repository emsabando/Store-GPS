import { defineConfig } from 'vite';

// The game is a static site: build output is relative so it can be hosted from any sub-path
// (GitHub Pages, a local `npx serve dist`, or opened through a tiny static server).
export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: false },
  build: {
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/postprocessing/') || id.includes('node_modules/n8ao/')) return 'post';
          if (id.includes('node_modules/three-mesh-bvh/')) return 'bvh';
          return undefined;
        },
      },
    },
  },
});
