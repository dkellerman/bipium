const origins = new Set([
  'https://bipium.com',
  'https://www.bipium.com',
  'https://bipium-voice.david415.chatgpt.site',
]);
const relay = 'wss://bipium-voice.david415.chatgpt.site/api/transcription/stream';
const headers = { 'Cache-Control': 'no-store' };
async function signature(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))),
    n => n.toString(16).padStart(2, '0'),
  ).join('');
}
export async function transcription(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (!origins.has(origin)) return new Response('Origin not allowed', { status: 403 });
  if (!env.XAI_API_KEY)
    return Response.json(
      { error: 'Voice recognition is not configured.' },
      { status: 503, headers },
    );
  if (url.pathname === '/api/transcription/session') {
    if (request.method !== 'POST') return new Response('Use POST', { status: 405 });
    const ticket = `${Date.now() + 30000}.${crypto.randomUUID()}`;
    const sig = await signature(`${ticket}.${origin}`, env.XAI_API_KEY);
    return Response.json({ url: `${relay}?ticket=${ticket}&signature=${sig}` }, { headers });
  }
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
    return new Response('WebSocket required', { status: 426 });
  const ticket = url.searchParams.get('ticket') || '';
  const expiry = Number(ticket.split('.')[0]);
  if (
    !Number.isFinite(expiry) ||
    expiry < Date.now() ||
    expiry > Date.now() + 30000 ||
    url.searchParams.get('signature') !== (await signature(`${ticket}.${origin}`, env.XAI_API_KEY))
  )
    return new Response('Session expired', { status: 403 });
  const target = new URL('https://api.x.ai/v1/stt');
  Object.entries({
    model: 'grok-voice-transcribe-2.0',
    encoding: 'pcm',
    sample_rate: '48000',
    interim_results: 'true',
    language: 'en',
    endpointing: '400',
  }).forEach(([k, v]) => target.searchParams.set(k, v));
  for (const term of ['snare', 'kick', 'hi hat', 'and of two', 'beat', 'BPM', 'subdivisions'])
    target.searchParams.append('keyterm', term);
  let response;
  try {
    response = await fetch(target, {
      headers: { Upgrade: 'websocket', Authorization: `Bearer ${env.XAI_API_KEY}` },
    });
  } catch {
    return new Response('Could not connect to voice recognition', { status: 502 });
  }
  const upstream = response.webSocket;
  if (!upstream) return new Response('Voice recognition is unavailable', { status: 502 });
  const [client, server] = Object.values(new WebSocketPair());
  upstream.accept();
  server.accept();
  let ended = false;
  const close = () => {
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    try {
      upstream.close(1000);
    } catch {}
    try {
      server.close(1000);
    } catch {}
  };
  const timer = setTimeout(close, 10 * 60 * 1000);
  server.addEventListener('message', event => {
    if (ended) return;
    if (!(event.data instanceof ArrayBuffer) || event.data.byteLength > 19200) {
      close();
      return;
    }
    try {
      upstream.send(event.data);
    } catch {
      close();
    }
  });
  upstream.addEventListener('message', event => {
    if (!ended)
      try {
        server.send(event.data);
      } catch {
        close();
      }
  });
  for (const socket of [server, upstream]) {
    socket.addEventListener('close', event => { console.info('transcription socket closed', socket === upstream ? 'upstream' : 'client', event.code, event.reason); close(); });
    socket.addEventListener('error', close);
  }
  return new Response(null, { status: 101, webSocket: client });
}
