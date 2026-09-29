// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { estimateCountOff } from './count-off.mjs';
import { voice } from './voice.mjs';
import { API_DEFAULT_CONFIG } from '../src/core/api.ts';
const words = (text, step = 0.5, offset = 8) =>
  text
    .split(' ')
    .map((text, i) => ({ text, start: offset + i * step, end: offset + i * step + 0.1 }));
afterEach(() => vi.unstubAllGlobals());
describe('server count-off estimates', () => {
  it('estimates numbered pulse timing without inferring meter or hidden subdivisions', () => {
    expect(estimateCountOff('One, two, three, four!', words('one two three four'))).toMatchObject({
      status: 'estimated',
      bpm: 120,
      subdivisions: 1,
      beatsPerBar: null,
      beatTimesSeconds: [8, 8.5, 9, 9.5],
    });
  });
  it('uses number anchors, not every spoken word, for subdivided counting', () => {
    expect(
      estimateCountOff('count off: 1 and 2 and 3 and 4', words('1 and 2 and 3 and 4', 0.25)),
    ).toMatchObject({ bpm: 120, subdivisions: 2 });
  });
  it('keeps tempo but declines subdivisions when intervening words are uneven', () => {
    const w = words('one and two and three and four', 0.25);
    w[1].start = 8.1;
    expect(estimateCountOff('one and two and three and four', w)).toMatchObject({
      bpm: 120,
      subdivisions: null,
    });
  });
  it('accepts repeated cycles without claiming they establish meter', () => {
    expect(estimateCountOff('1 2 3 1 2 3', words('1 2 3 1 2 3'))).toMatchObject({
      bpm: 120,
      countCycleLength: 3,
      beatsPerBar: null,
    });
  });
  it.each([
    'put the snare on two and four',
    'set tempo to 120',
    'one two three apples',
    'one three four',
    'one and and two three',
  ])('ignores ordinary commands and invalid sequences: %s', prompt => {
    expect(estimateCountOff(prompt, words(prompt))).toBeNull();
  });
  it('declines missing, merged, and nonmonotonic timestamps', () => {
    expect(estimateCountOff('one two three', undefined).bpm).toBeNull();
    expect(estimateCountOff('one two', words('one two')).bpm).toBeNull();
    expect(
      estimateCountOff('one two three', [{ text: 'one two three', start: 0, end: 2 }]).bpm,
    ).toBeNull();
    const w = words('one two three');
    w[2].start = w[1].start;
    expect(estimateCountOff('one two three', w).bpm).toBeNull();
  });
  it('declines inconsistent timing and implausible tempos', () => {
    const w = words('one two three four');
    w[3].start += 1;
    w[3].end += 1;
    expect(estimateCountOff('one two three four', w).status).toBe('uncertain');
    expect(estimateCountOff('one two three four', words('one two three four', 0.1)).bpm).toBeNull();
  });
  it.each([false, true])(
    'returns an estimate and no command without calling Jev (stream=%s)',
    async stream => {
      const fetcher = vi.fn();
      vi.stubGlobal('fetch', fetcher);
      const request = new Request('https://www.bipium.com/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(stream ? { Accept: 'application/x-ndjson' } : {}),
        },
        body: JSON.stringify({
          prompt: 'one two three four',
          transcriptionWords: words('one two three four'),
          currentConfig: API_DEFAULT_CONFIG,
        }),
      });
      const response = await voice(request, {});
      const raw = await response.text();
      const body = stream ? JSON.parse(raw.trim()).result : JSON.parse(raw);
      expect(body).toMatchObject({ call: null, countOff: { bpm: 120, subdivisions: 1 } });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
});
