import { it, expect, vi, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { transcription } from '../../server/transcription.mjs';
afterEach(() => vi.unstubAllGlobals());
it('issues only a short-lived signed relay URL and never exposes the provider key', async () => {
  vi.stubGlobal('crypto', webcrypto);
  const response = await transcription(
    new Request('https://www.bipium.com/api/transcription/session', {
      method: 'POST',
      headers: { Origin: 'https://www.bipium.com' },
    }),
    { XAI_API_KEY: 'secret-provider-key' },
  );
  const body = await response.text();
  expect(response.status).toBe(200);
  expect(body).not.toContain('secret-provider-key');
  expect(new URL(JSON.parse(body).url).hostname).toBe('bipium-voice.david415.chatgpt.site');
});
it('rejects foreign origins before opening a paid upstream connection', async () => {
  vi.stubGlobal('fetch', vi.fn());
  const response = await transcription(
    new Request('https://www.bipium.com/api/transcription/session', {
      method: 'POST',
      headers: { Origin: 'https://foreign.test' },
    }),
    { XAI_API_KEY: 'secret' },
  );
  expect(response.status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});
