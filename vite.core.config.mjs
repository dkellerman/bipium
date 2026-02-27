import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const minified = mode === 'minified';

  return {
    publicDir: false,
    build: {
      outDir: 'public/dist',
      emptyOutDir: false,
      minify: minified ? 'esbuild' : false,
      sourcemap: false,
      lib: {
        entry: resolve(__dirname, 'src/core/entries/browser-esm.js'),
        name: 'Bipium',
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
});
