// Makes stateless interpretation requests; does not control anyone's player.
import assert from 'node:assert/strict';
const origin = process.argv[2];
if (!origin) throw Error('Pass the Bipium origin to evaluate.');
const base = (divisions = 2, loopMode = false, snare = [1, 3]) => ({
  bpm: 80,
  beats: 4,
  subDivs: divisions,
  playSubDivs: true,
  swing: 0,
  soundPack: 'drumkit',
  volume: 35,
  loopMode,
  loopRepeats: 0,
  soundUrls: {},
  loopPattern: Object.fromEntries(
    Object.entries({ kick: [0, 2], snare, hat: [0, 1, 2, 3] }).map(([lane, hits]) => [
      lane,
      Array.from({ length: 4 * divisions }, (_, i) => hits.includes(i / divisions)),
    ]),
  ),
});
const positions = (config, lane) =>
  config.loopPattern[lane].flatMap((hit, i) =>
    hit ? [i / (config.playSubDivs ? config.subDivs : 1)] : [],
  );
const cases = [
  ...[1, 2, 4].flatMap(d =>
    [false, true].map(mode => ({
      prompt: 'move the snare from beat 4 to the and of 2',
      current: base(d, mode),
      lane: 'snare',
      expected: [1, 1.5],
    })),
  ),
  {
    prompt: 'move the snare to the end of 2',
    current: base(2, false, [2]),
    lane: 'snare',
    expected: [1.5],
  },
  {
    prompt: 'move the snare to the and of 2',
    current: base(4, false, [2]),
    lane: 'snare',
    expected: [1.5],
  },
  {
    prompt: 'add a kick on the e of 3',
    current: { ...base(1), playSubDivs: false },
    lane: 'kick',
    expected: [0, 2, 2.25],
  },
  { prompt: 'remove the hat on beat 2', current: base(), lane: 'hat', expected: [0, 2, 3] },
  {
    prompt: 'shift the snare back half a beat',
    current: base(),
    lane: 'snare',
    expected: [0.5, 2.5],
  },
  {
    prompt: 'add kick on the and of 2 and the e of 4',
    current: base(1),
    lane: 'kick',
    expected: [0, 1.5, 2, 3.25],
  },
  { prompt: 'move the snare to the and of 2', current: base(), clarification: true },
  { prompt: 'move the snare from beat 1 to the and of 2', current: base(), clarification: true },
];
let failures = 0;
for (const test of cases) {
  const start = Date.now();
  let response, data;
  for (let attempt = 0; attempt < 20; attempt++) {
    response = await fetch(new URL('/api/voice', origin), {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ prompt: test.prompt, currentConfig: test.current }),
    });
    data = await response.json();
    if (data.interpreterVersion === 2) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  let error;
  try {
    assert.equal(response.status, 200);
    assert.equal(data.interpreterVersion, 2, 'New interpreter has not propagated to this request');
    if (test.clarification) {
      assert.equal(data.call, null);
      assert.match(data.message, /which|unchanged/i);
    } else {
      assert.equal(data.call?.method, 'setConfig');
      const next = data.call.args[0];
      assert.equal(next.loopMode, true);
      assert.deepEqual(positions(next, test.lane), test.expected);
      for (const lane of ['kick', 'snare', 'hat'].filter(lane => lane !== test.lane))
        assert.deepEqual(positions(next, lane), positions(test.current, lane));
      for (const key of [
        'bpm',
        'beats',
        'volume',
        'swing',
        'soundPack',
        'loopRepeats',
        'soundUrls',
      ])
        assert.deepEqual(next[key], test.current[key]);
    }
  } catch (e) {
    failures++;
    error = e.message;
  }
  console.log(
    JSON.stringify({
      passed: !error,
      currentInterpreter: Object.hasOwn(data.jevRequest?.state ?? {}, 'musical_reading'),
      prompt: test.prompt,
      grid: test.current.subDivs,
      mode: test.current.loopMode,
      ms: Date.now() - start,
      choice: data.decisions?.[test.lane]?.choice,
      confidence: data.decisions?.[test.lane]?.confidence,
      message: data.message,
      ...(error ? { error, call: data.call } : {}),
    }),
  );
}
console.log(`${cases.length - failures}/${cases.length} voice edit cases passed`);
process.exitCode = failures ? 1 : 0;
