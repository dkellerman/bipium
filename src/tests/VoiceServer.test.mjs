// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { voice } from '../../server/voice.mjs';
import { buildMainRequest } from '../../server/voice/main.mjs';
import { buildDrumRequest } from '../../server/voice/drums.mjs';
import { positionsOf } from '../../server/voice/grid.mjs';
import { estimateCountIn } from '../../server/voice/count-in.mjs';
import { API_DEFAULT_CONFIG } from '../core/api';

const current = structuredClone(API_DEFAULT_CONFIG);
const drumConfig = { ...structuredClone(current), loopMode: true };
const backbeat = {
  ...drumConfig,
  loopPattern: { kick: [true, false, true, false], hat: [true, true, true, true], snare: [false, true, false, true] },
};

/** Stub Jev: every question answers keep/none unless overridden. An override can name
 * an option by its description, e.g. 'Add snare on 3'. */
function stubJev(...stages) {
  const requests = [];
  const fetcher = vi.fn(async (_url, init) => {
    const request = JSON.parse(init.body);
    requests.push(request);
    const overrides = stages[requests.length - 1] ?? {};
    const answers = Object.fromEntries(
      Object.entries(request.questions).map(([key, q]) => {
        const fallback = ['keep', 'none'].find(k => Object.hasOwn(q.criteria, k)) ?? 'play';
        const [wanted, confidence = 0.9] = [].concat(overrides[key] ?? fallback);
        const choice =
          Object.entries(q.criteria).find(([, text]) => text === wanted)?.[0] ?? wanted;
        return [key, { choice, confidence, probabilities: { [choice]: confidence } }];
      }),
    );
    return Response.json({ answers, usage: { input_tokens: 1 } });
  });
  vi.stubGlobal('fetch', fetcher);
  return requests;
}

const say = async (prompt, config = current, extra = {}) => {
  const response = await voice(
    new Request('https://test/api/voice', {
      method: 'POST',
      body: JSON.stringify({ prompt, currentConfig: config, ...extra }),
    }),
    { TYPESAFE_API_KEY: 'secret' },
  );
  return response.json();
};

const tempo = (h, t, o) => ({ tempo: 'exact', tempo_hundreds: h, tempo_tens: t, tempo_ones: o });

afterEach(() => vi.unstubAllGlobals());

describe('main request', () => {
  it('keeps every question a choice within Jev limits', () => {
    const request = buildMainRequest({
      prompt: 'anything',
      current,
      recentTurns: [],
      alternatives: [],
      timed: false,
      context: {},
    });
    for (const question of Object.values(request.questions)) {
      expect(question.type).toBe('choice');
      expect(Object.keys(question.criteria).length).toBeLessThanOrEqual(255);
    }
  });

  it('asks the same questions whatever the wording', () => {
    const keys = prompt =>
      Object.keys(
        buildMainRequest({ prompt, current, recentTurns: [], alternatives: [], timed: false, context: {} })
          .questions,
      );
    expect(keys('make it 120')).toEqual(keys('stop the drums and play a funk beat in 7/8'));
  });

  it('passes the transcript to Jev unchanged', async () => {
    const requests = stubJev({ action: 'play' });
    await say('move the snare to the end of two');
    expect(requests[0].state.utterance).toBe('move the snare to the end of two');
  });

  it('only acts on what Jev chose, never on words in the transcript', async () => {
    stubJev({ action: 'play' });
    expect((await say('switch to drum mode at 85 bpm')).message).toBe('Playing.');
    stubJev({ action: 'play', mode: 'drums', ...tempo('0', '8', '5') });
    expect((await say('mumble')).call.args[0]).toEqual({ bpm: 85, loopMode: true });
  });
});

describe('numbers', () => {
  it('builds an exact tempo from confident digits', async () => {
    stubJev({ action: 'play', ...tempo('1', '2', '8') });
    const result = await say('128 bpm');
    expect(result.call).toEqual({ method: 'setConfig', args: [{ bpm: 128 }] });
  });

  it('keeps the tempo when any digit is unsure', async () => {
    stubJev({ action: 'play', ...tempo('1', '2', ['8', 0.4]) });
    const result = await say('128 bpm');
    expect(result.call).toBeNull();
    expect(result.message).toContain('exact tempo');
  });

  it('reports an exact tempo outside the range instead of clamping it', async () => {
    stubJev({ action: 'play', ...tempo('3', '4', '0') });
    const result = await say('340');
    expect(result.call).toBeNull();
    expect(result.message).toContain('340 BPM is outside');
  });

  it('applies categorical and relative tempo choices', async () => {
    stubJev({ action: 'play', tempo: 'faster' });
    expect((await say('faster', { ...current, bpm: 100 })).call.args[0]).toEqual({ bpm: 110 });
  });

  it('ignores digit answers unless the tempo is exact', async () => {
    stubJev({ action: 'play', tempo: 'keep', tempo_hundreds: '1', tempo_tens: '2', tempo_ones: '0' });
    expect((await say('swing it')).message).toBe('Playing.');
  });
});

describe('mode and styles', () => {
  it('a style alone stays a regular beat, on drum kit sounds, at its tempo', async () => {
    stubJev({ action: 'play', style: 'rock', tempo: 'style' });
    const patch = (await say('rock beat', { ...current, soundPack: 'defaults' })).call.args[0];
    expect(patch).toEqual({ bpm: 110, soundPack: 'drumkit' });
  });

  it('a style loads its pattern when drums are asked for', async () => {
    stubJev({ action: 'play', style: 'rock', mode: 'drums', tempo: 'style' });
    const patch = (await say('rock drum loop')).call.args[0];
    expect({ ...current, ...patch }).toMatchObject({ loopMode: true, bpm: 110, subDivs: 2, playSubDivs: true });
    expect(patch.loopPattern.snare).toEqual([false, false, true, false, false, false, true, false]);
  });

  it('a style in drum mode replaces the pattern', async () => {
    stubJev({ action: 'play', style: 'rock' });
    const patch = (await say('rock beat', drumConfig)).call.args[0];
    expect(patch.loopPattern.snare).toEqual([false, false, true, false, false, false, true, false]);
  });

  it('an explicit click request switches to click mode without touching the grid', async () => {
    stubJev({ action: 'play', mode: 'click' });
    const patch = (await say('just the click', drumConfig)).call.args[0];
    expect(patch).toEqual({ loopMode: false });
  });

  it('keeps the current mode for ordinary setting changes', async () => {
    stubJev({ action: 'play', ...tempo('0', '9', '0') });
    expect((await say('90', drumConfig)).call.args[0]).toEqual({ bpm: 90 });
  });
});

describe('drum edits', () => {
  it('moves a hit into a beat without disturbing the hit already there', async () => {
    stubJev(
      { action: 'drumEdit' },
      { snare_4_remove: 'Remove snare on 4', snare_2_add: 'Add snare on & of 2' },
    );
    const patch = (await say('move the snare from 4 to the and of 2', backbeat)).call.args[0];
    expect(patch.loopPattern.snare).toEqual([false, false, true, true, false, false, false, false]);
  });

  it('applies a whole-lane shift', async () => {
    stubJev({ action: 'drumEdit' }, { snare_all: 'earlier-8th' });
    const patch = (await say('shift the snare back half a beat', backbeat)).call.args[0];
    expect(patch.loopPattern.snare).toEqual([false, true, false, false, false, true, false, false]);
  });

  it('asks per lane per beat and keeps beats that were not answered', async () => {
    const requests = stubJev({ action: 'drumEdit' }, { snare_3_add: 'Add snare on 3' });
    const config = { ...drumConfig };
    config.loopPattern = { kick: [true, false, false, false], hat: [true, true, true, true], snare: [false, true, false, true] };
    const patch = (await say('add a snare on three', config)).call.args[0];
    expect(Object.keys(requests[1].questions)).toContain('snare_3_add');
    expect(patch.loopMode).toBeUndefined(); // already in drum mode
    expect(patch.loopPattern.snare).toEqual([false, true, true, true]);
    expect(patch.loopPattern.kick).toEqual([true, false, false, false]);
  });

  it('places an off-beat hit on a quarter-note grid', async () => {
    stubJev({ action: 'drumEdit' }, { kick_2_add: 'Add kick on & of 2' });
    const patch = (await say('kick on the and of two', drumConfig)).call.args[0];
    expect(patch.subDivs).toBe(2);
    expect(patch.loopPattern.kick).toEqual([true, false, false, true, false, false, false, false]);
  });

  it('stays within 255 options even on a 12-beat grid of thirty-seconds', () => {
    const config = { ...drumConfig, beats: 12, subDivs: 8, playSubDivs: true };
    config.loopPattern = { kick: Array(96).fill(true), hat: Array(96).fill(false), snare: Array(96).fill(false) };
    const { request } = buildDrumRequest({
      prompt: 'x',
      recentTurns: [],
      alternatives: [],
      config,
      base: positionsOf(config),
      context: {},
    });
    for (const question of Object.values(request.questions))
      expect(Object.keys(question.criteria).length).toBeLessThanOrEqual(255);
  });
});

describe('count-ins', () => {
  // Words at `bpm`, `perBeat` words per beat; in-between words land `late` seconds late.
  const timed = (texts, bpm, perBeat = 1, late = 0) =>
    texts.map((text, i) => ({
      text,
      start: 1 + Math.floor(i / perBeat) * (60 / bpm) + (i % perBeat) * (60 / bpm / perBeat) + (i % perBeat ? late : 0),
    }));
  const eighths = ['1', 'and', '2', 'and', '3', 'and', '4', 'and'];

  it('estimates tempo and subdivisions from timing', () => {
    expect(estimateCountIn({ words: timed(['one', 'two', 'three', 'four'], 100) })).toMatchObject({ bpm: 100, subdivisions: 1 });
    expect(estimateCountIn({ words: timed(eighths, 120, 2) })).toMatchObject({ bpm: 120, subdivisions: 2, swing: 0 });
  });

  it('never uses number values to place beats', () => {
    const a = estimateCountIn({ words: timed(['1', '2', '3', '4'], 110) });
    const b = estimateCountIn({ words: timed(['4', '1', '3', '2'], 110) });
    expect(b).toEqual(a);
  });

  it('survives dropped and misheard syllables', () => {
    const dropped = timed(eighths, 120, 2).filter((_, i) => i !== 3 && i !== 5);
    expect(estimateCountIn({ words: dropped })).toMatchObject({ bpm: 120, subdivisions: 2 });
  });

  it('reports clear swing but not slightly uneven counting', () => {
    expect(estimateCountIn({ words: timed(eighths, 120, 2, 0.09) }).swing).toBe(35);
    expect(estimateCountIn({ words: timed(eighths, 120, 2, 0.02) }).swing).toBe(0);
  });

  it('finds beats per bar only when the count repeats a bar', () => {
    expect(estimateCountIn({ words: timed('one two three one two three'.split(' '), 90) }).beats).toBe(3);
    expect(estimateCountIn({ words: timed(['one', 'two', 'three', 'four'], 100) }).beats).toBeNull();
    // The classic "one . two . one two three four": the recurring "one" marks the bar.
    const classic = [0, 2, 4, 5, 6, 7].map((beat, i) => ({
      text: ['one', 'two', 'one', 'two', 'three', 'four'][i],
      start: 1 + beat * 0.5,
    }));
    expect(estimateCountIn({ words: classic })).toMatchObject({ bpm: 120, beats: 4 });
  });

  it('uses audio onsets when the words are unsure and miss syllables', () => {
    // Sixteenths at 80: the transcript kept only the numbers, with smeared timestamps
    // (as the real transcriber does at this speed); the audio has every syllable.
    // Recorded from the real transcriber and onset detector on a rhythmic synthetic count.
    const onsets = [1.0, 1.38, 1.57, 1.76, 1.94, 2.13, 2.31, 2.51, 2.7, 2.88, 3.06, 3.25, 3.45, 3.63].map(
      time => ({ time, level: 40 }),
    );
    const words = [['One,', 1.12], ['two,', 1.58], ['three,', 2.33], ['four.', 3.27]].map(
      ([text, start]) => ({ text, start }),
    );
    expect(estimateCountIn({ words }).confidence).toBeLessThan(0.8);
    expect(estimateCountIn({ words, onsets })).toMatchObject({ bpm: 80, subdivisions: 4 });
  });

  it('trusts confident word timing without consulting the audio', () => {
    // Real speech can split a word into several onsets or miss one entirely.
    const words = ['One,', 'two,', 'three,', 'four.'].map((text, i) => ({ text, start: 3.24 + i * 0.41 }));
    const messy = [3.13, 3.2, 3.27, 3.55, 3.79, 3.93, 4.02].map(time => ({ time, level: 50 }));
    expect(estimateCountIn({ words, onsets: messy })).toMatchObject({ subdivisions: 1, source: 'words' });
  });

  it('applies the count-in only when Jev calls it one', async () => {
    const transcriptionWords = timed(eighths, 120, 2);
    stubJev({ action: 'countOff' });
    const result = await say('1 and 2 and 3 and 4 and', current, { transcriptionWords });
    expect(result.call.args[0]).toMatchObject({ bpm: 120, subDivs: 2, playSubDivs: true });
    stubJev({ action: 'play' });
    expect((await say('1 and 2 and 3 and 4 and', current, { transcriptionWords })).message).toBe('Playing.');
  });

  it('fits the timing within the division Jev read from the count', async () => {
    // "triplet" is one word for two syllables, so word timing alone can't be sure.
    const words = [];
    for (let beat = 0; beat < 4; beat++)
      words.push({ text: String(beat + 1), start: 1 + beat * 0.66 }, { text: 'triplet', start: 1.22 + beat * 0.66 });
    words.unshift({ text: '.', start: 0.5 });
    expect(estimateCountIn({ words, subdivisions: 3 })).toMatchObject({ bpm: 91, subdivisions: 3, subdivisionConfidence: 1 });
    stubJev({ action: 'countOff', countFeel: '3' });
    const result = await say('1 triplet 2 triplet 3 triplet 4 triplet', current, { transcriptionWords: words });
    expect(result.call.args[0]).toMatchObject({ bpm: 91, subDivs: 3, playSubDivs: true });
  });

  it('turns earlier subdivisions off when the count is plain beats', async () => {
    const transcriptionWords = ['One,', 'two,', 'three,', 'four.'].map((text, i) => ({ text, start: 1 + i * 0.5 }));
    stubJev({ action: 'countOff' });
    const eighthsOn = { ...current, subDivs: 2, playSubDivs: true };
    eighthsOn.loopPattern = { kick: Array(8).fill(false), hat: Array(8).fill(false), snare: Array(8).fill(false) };
    const result = await say('One, two, three, four.', eighthsOn, { transcriptionWords });
    expect(result.call.args[0]).toMatchObject({ bpm: 120, playSubDivs: false });
  });

  it('does not offer count-ins without timed words', async () => {
    const requests = stubJev({ action: 'play' });
    await say('one two three four');
    expect(requests[0].questions.action.criteria.countOff).toBeUndefined();
  });
});

describe('music around speech', () => {
  it('tells Jev the words may be lyrics only when the audio shows music', async () => {
    const requests = stubJev({ action: 'unrelated' });
    await say('I want a funky beat at ninety', current, { music: 0.9 });
    expect(requests[0].state.heard_music).toBeTruthy();
    const quiet = stubJev({ action: 'play' });
    await say('I want a funky beat at ninety', current, { music: 0.1 });
    expect(quiet[0].state.heard_music).toBeUndefined();
  });

  it('stays silent when Jev is unsure over music, and says so otherwise', async () => {
    stubJev({ action: ['play', 0.4] });
    expect(await say('mm', current, { music: 0.9 })).toMatchObject({ call: null, message: '' });
    stubJev({ action: ['play', 0.4] });
    expect((await say('mm', current, { music: 0.1 })).message).toMatch(/didn’t catch/);
  });
});

describe('responses', () => {
  it('acts on nothing when the action itself is unsure', async () => {
    stubJev({ action: ['reset', 0.5] });
    expect((await say('reset')).call).toBeNull();
  });

  it('includes the Jev trace only when debugging', async () => {
    stubJev({ action: 'stop' });
    expect((await say('stop')).debug).toBeUndefined();
    stubJev({ action: 'stop' });
    expect((await say('stop', current, { debug: true })).debug.main.answers.action.choice).toBe('stop');
  });
});
