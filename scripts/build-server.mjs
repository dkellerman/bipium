import { build } from 'vite';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';

await rm('dist/server', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await build({
  configFile: false,
  publicDir: false,
  build: {
    ssr: 'server/index.mjs',
    outDir: 'dist/server',
    minify: true,
    rollupOptions: { output: { entryFileNames: 'index.js' } },
  },
  ssr: { noExternal: true },
});
await writeFile(
  'dist/server/wrangler.json',
  JSON.stringify(
    {
      name: 'bipium-voice',
      main: 'index.js',
      compatibility_date: '2026-05-22',
      assets: {
        directory: '../client',
        binding: 'ASSETS',
        run_worker_first: true,
        not_found_handling: 'none',
      },
    },
    null,
    2,
  ) + '\n',
);
console.log('Built Sites Worker and client assets.');
