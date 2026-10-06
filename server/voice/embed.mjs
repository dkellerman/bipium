// Text embeddings (through OpenRouter) and the compact form they're stored in.
// Chosen by measurement: the named style ranks near the top even when the phrase is mostly
// tempo talk, and one phrase embeds in about 0.1 s.
export const EMBEDDING_MODEL = 'voyageai/voyage-4';

/** Unit-length embeddings for `texts`, in order. */
export async function embed(env, texts, signal) {
  if (!env.OPENROUTER_API_KEY) {
    const error = Error('Voice search isn’t set up (no OPENROUTER_API_KEY).');
    error.status = 502;
    throw error;
  }
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'Bipium',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : undefined,
  });
  const result = response.ok ? await response.json() : null;
  if (!result?.data || result.data.length !== texts.length) {
    const error = Error(`Voice search is unavailable (${response.status}). Please try again.`);
    error.status = 502;
    throw error;
  }
  return result.data
    .sort((a, b) => a.index - b.index)
    .map(({ embedding }) => {
      const norm = Math.hypot(...embedding) || 1;
      return embedding.map(v => v / norm);
    });
}

/** A unit vector as base64 int8 (each value scaled by 127), about a quarter the size. */
export function pack(vector) {
  const bytes = Int8Array.from(vector, v => Math.max(-127, Math.min(127, Math.round(v * 127))));
  let binary = '';
  for (const b of new Uint8Array(bytes.buffer)) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function unpack(packed) {
  const binary = atob(packed);
  const bytes = new Int8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = (binary.charCodeAt(i) << 24) >> 24;
  return Float32Array.from(bytes, v => v / 127);
}

export const dot = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
};
