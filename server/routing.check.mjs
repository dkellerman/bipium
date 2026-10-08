import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../dist/server/index.js';

function environment() {
  return {
    TYPESAFE_API_KEY: 'test-secret-not-for-client',
    ASSETS: {
      fetch: async request => new Response(new URL(request.url).pathname),
    },
  };
}

test('all app routes serve the public shell without authentication', async () => {
  for (const route of ['/', '/apidocs', '/about']) {
    const response = await worker.fetch(new Request(`https://example.test${route}`), environment());
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '/');
  }
});

test('the retired machine theme redirects to the app', async () => {
  for (const route of ['/machine', '/machine/']) {
    const response = await worker.fetch(new Request(`https://example.test${route}`), environment());
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://example.test/');
  }
});

test('API docs, audio, and standalone core assets remain accessible', async () => {
  for (const route of [
    '/api.md',
    '/llms.txt',
    '/agents.txt',
    '/audio/kick1.mp3',
    '/dist/bipium-core.js',
  ]) {
    const response = await worker.fetch(new Request(`https://example.test${route}`), environment());
    assert.equal(await response.text(), route);
  }
});

test('removed AI route does not execute or return the app shell', async () => {
  for (const method of ['GET', 'POST']) {
    const response = await worker.fetch(
      new Request('https://example.test/api/ai-config', { method }),
      environment(),
    );
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Not found' });
  }
});

test('health response reveals no server credentials', async () => {
  const response = await worker.fetch(
    new Request('https://example.test/api/health'),
    environment(),
  );
  assert.deepEqual(await response.json(), { status: 'ok' });
});
