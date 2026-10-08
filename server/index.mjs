import { transcription } from './transcription.mjs';
import { voice } from './voice.mjs';
// Server-only entrypoint. Direct Jev calls use env.TYPESAFE_API_KEY;
// never return runtime secrets or inject them into the client bundle.
const appRoutes = new Set(['/', '/apidocs', '/about']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return Response.json({ status: 'ok' });
    }

    if (['/api/transcription/session', '/api/transcription/stream'].includes(url.pathname))
      return transcription(request, env);

    if (url.pathname === '/api/voice') return voice(request, env);

    // Removed model routes must never resolve to the SPA shell.
    if (url.pathname.startsWith('/api/')) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD' },
      });
    }

    // The machine theme was retired; old links land on the app.
    if ((url.pathname.replace(/\/$/, '') || '/') === '/machine')
      // Relative: behind the custom domain the request URL is the Sites origin's.
      return new Response(null, { status: 302, headers: { Location: '/' } });

    if (appRoutes.has(url.pathname.replace(/\/$/, '') || '/')) {
      url.pathname = '/';
      return env.ASSETS.fetch(new Request(url, request));
    }
    return env.ASSETS.fetch(request);
  },
};
