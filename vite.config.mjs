import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

function coreBuildConfig(minified) {
  return {
    publicDir: false,
    build: {
      outDir: 'public/dist',
      emptyOutDir: false,
      minify: minified ? 'esbuild' : false,
      sourcemap: false,
      lib: {
        entry: resolve(__dirname, 'src/core/browser-esm.ts'),
        name: 'bpm',
        formats: ['iife'],
      },
      rollupOptions: {
        output: {
          entryFileNames: minified ? 'bipium-core.min.js' : 'bipium-core.js',
          extend: true,
          exports: 'named',
        },
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const devPort = Number.parseInt(process.env.PORT ?? '', 10);

  if (mode === 'core-minified') {
    return coreBuildConfig(true);
  }

  if (mode === 'core-unminified') {
    return coreBuildConfig(false);
  }

  return {
    plugins: [react(), tailwindcss()],
    envPrefix: ['VITE_'],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
    },
    server: {
      port: Number.isFinite(devPort) ? devPort : 3000,
    },
  };
});
