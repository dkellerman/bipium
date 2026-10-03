import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { appendFile, mkdir } from 'node:fs/promises';

// Serves /api/voice from server/voice.mjs during `pnpm dev`, so voice interpretation
// can be tested locally. Reads TYPESAFE_API_KEY from .env.local (never sent to the client).
function voiceDevApi(mode) {
  return {
    name: 'voice-dev-api',
    configureServer(server) {
      // Diagnostics from the voice UI, one JSON line per event (git-ignored).
      server.middlewares.use('/api/dev-log', async (req, res) => {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        await mkdir('.voice-log', { recursive: true });
        const day = new Date().toISOString().slice(0, 10);
        await appendFile(`.voice-log/${day}.jsonl`, Buffer.concat(chunks).toString().trim() + '\n');
        res.statusCode = 204;
        res.end();
      });
      // Raw mic audio (48 kHz mono s16le) per listening session, to replay detectors on.
      server.middlewares.use('/api/dev-audio', async (req, res) => {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const session = new URL(req.originalUrl, 'http://dev').searchParams.get('session') ?? 'unknown';
        await mkdir('.voice-log', { recursive: true });
        await appendFile(`.voice-log/audio-${session.replace(/[^\w-]/g, '')}.pcm`, Buffer.concat(chunks));
        res.statusCode = 204;
        res.end();
      });
      server.middlewares.use('/api/voice', async (req, res) => {
        const { voice } = await server.ssrLoadModule('/server/voice.mjs');
        const abort = new AbortController();
        res.on('close', () => !res.writableFinished && abort.abort());
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const request = new Request(`http://${req.headers.host}${req.originalUrl}`, {
          method: req.method,
          headers: req.headers,
          body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          signal: abort.signal,
        });
        const response = await voice(request, loadEnv(mode, process.cwd(), ''));
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (response.body) Readable.fromWeb(response.body).pipe(res);
        else res.end();
      });
    },
  };
}

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
    plugins: [react(), tailwindcss(), voiceDevApi(mode)],
    envPrefix: ['VITE_'],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist/client',
      chunkSizeWarningLimit: 1200,
    },
    server: {
      port: Number.isFinite(devPort) ? devPort : 3000,
      // Speech recognition in dev goes through the production relay, presented as
      // bipium.com (its origin allowlist and signed tickets are bound to that origin).
      proxy: {
        '/api/transcription': {
          target: 'https://bipium-voice.david415.chatgpt.site',
          changeOrigin: true,
          ws: true,
          headers: { origin: 'https://www.bipium.com' },
        },
      },
    },
  };
});
