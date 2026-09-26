// Server-only entrypoint. Future OpenRouter calls use env.OPENROUTER_API_KEY;
// never return runtime secrets or inject them into the client bundle.
const appRoutes = new Set(['/', '/machine', '/apidocs', '/about']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return Response.json({ status: 'ok' });
    }

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

    if (appRoutes.has(url.pathname.replace(/\/$/, '') || '/')) {
      url.pathname = '/';
      return env.ASSETS.fetch(new Request(url, request));
    }
    return env.ASSETS.fetch(request);
  },
};
