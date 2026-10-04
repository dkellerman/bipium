// Live eval of voice interpretation against a running server (default: `pnpm dev`).
//   node scripts/voice-eval.mjs [origin]
// Reports a score and Jev's answers per case. It is a measurement, not a gate: a miss
// is evidence about the questions or context, never a reason to add a phrase rule.
const origin = process.argv[2] ?? 'http://localhost:5188';

const config = ({ divisions = 2, playSubDivs = true, loopMode = false, snare = [1, 3], ...rest } = {}) => ({
  bpm: 80,
  beats: 4,
  subDivs: divisions,
  playSubDivs,
  swing: 0,
  soundPack: 'drumkit',
  volume: 35,
  loopMode,
  loopRepeats: 0,
  soundUrls: {},
  loopPattern: Object.fromEntries(
    Object.entries({ kick: [0, 2], snare, hat: [0, 1, 2, 3] }).map(([lane, hits]) => [
      lane,
      Array.from({ length: 4 * (playSubDivs ? divisions : 1) }, (_, i) =>
        hits.includes(i / (playSubDivs ? divisions : 1)),
      ),
    ]),
  ),
  ...rest,
});

const positions = (c, lane) =>
  c.loopPattern[lane].flatMap((hit, i) => (hit ? [i / (c.playSubDivs ? c.subDivs : 1)] : []));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// `lane`/`oneOf`: the edited lane must end up at one of these position lists, other
// lanes unchanged. `patch`: these fields must be in the patch. `noCall`: nothing runs.
const cases = [
  // Drum edits
  ...[1, 2, 4].flatMap(divisions =>
    [false, true].map(loopMode => ({
      prompt: 'move the snare from beat 4 to the and of 2',
      current: config({ divisions, loopMode }),
      lane: 'snare',
      oneOf: [[1, 1.5]],
    })),
  ),
  {
    prompt: 'move the snare to the and of 2',
    current: config({ divisions: 4, snare: [2] }),
    lane: 'snare',
    oneOf: [[1.5]],
  },
  {
    prompt: 'move the snare to the end of 2',
    note: 'ambiguous: speech "end" for "and", or the end of beat 2',
    current: config({ snare: [2] }),
    lane: 'snare',
    oneOf: [[1.5], [1.75]],
  },
  {
    prompt: 'move the snare to the and of 2',
    note: 'ambiguous: two snares; moving the one on 2 is the usual reading',
    current: config(),
    lane: 'snare',
    oneOf: [[1.5, 3], [1, 1.5]],
  },
  {
    prompt: 'add a kick on the e of 3',
    current: config({ divisions: 2, playSubDivs: false }),
    lane: 'kick',
    oneOf: [[0, 2, 2.25]],
  },
  { prompt: 'remove the hat on beat 2', current: config(), lane: 'hat', oneOf: [[0, 2, 3]] },
  { prompt: 'shift the snare back half a beat', current: config(), lane: 'snare', oneOf: [[0.5, 2.5]] },
  {
    prompt: 'add kick on the and of 2 and the e of 4',
    current: config({ divisions: 1 }),
    lane: 'kick',
    oneOf: [[0, 1.5, 2, 3.25]],
  },
  { prompt: 'four on the floor', current: config({ loopMode: true }), lane: 'kick', oneOf: [[0, 1, 2, 3]] },
  { prompt: 'backbeat on the snare', current: config({ loopMode: true, snare: [] }), lane: 'snare', oneOf: [[1, 3]] },
  // Numbers and categories
  { prompt: '128 bpm', current: config(), patch: { bpm: 128 } },
  { prompt: 'one twenty five', current: config(), patch: { bpm: 125 } },
  { prompt: '340', current: config({ bpm: 320 }), noCall: true },
  { prompt: 'faster', current: config({ bpm: 100 }), patch: { bpm: 110 } },
  { prompt: 'a little swing', current: config(), patch: { swing: 15 } },
  { prompt: 'swing at 40 percent', current: config(), patch: { swing: 40 } },
  { prompt: 'volume 60', current: config(), patch: { volume: 60 } },
  { prompt: 'waltz time', current: config(), patch: { beats: 3 } },
  { prompt: 'sixteenth notes', current: config(), patch: { subDivs: 4 } },
  // Mode and styles
  { prompt: 'just the click please', current: config({ loopMode: true }), patch: { loopMode: false } },
  { prompt: 'switch to drum mode', current: config(), patch: { loopMode: true } },
  { prompt: 'give me a rock beat', current: config({ soundPack: 'defaults' }), patch: { soundPack: 'drumkit' }, absent: ['loopMode'] },
  { prompt: 'rock drum loop', current: config(), patch: { loopMode: true } },
  { prompt: 'make it 90', current: config({ loopMode: true }), patch: { bpm: 90 }, absent: ['loopMode'] },
  { prompt: 'drum sounds', current: config({ soundPack: 'defaults' }), patch: { soundPack: 'drumkit' }, absent: ['loopMode'] },
  {
    prompt: 'go back to drums',
    current: config({ soundPack: 'defaults' }),
    recentTurns: [{ prompt: 'switch to beeps', applied: true, outcome: 'beeps' }],
    patch: { soundPack: 'drumkit' },
    absent: ['loopMode'],
  },
  // Operations
  { prompt: 'stop', current: config(), method: 'stop' },
  { prompt: 'clear the drums', current: config({ loopMode: true }), method: 'clearLoopPattern' },
  { prompt: 'what should we have for dinner', current: config(), noCall: true },
];

function judge(test, data) {
  if (test.noCall) return data.call === null || 'expected no call';
  if (test.method) return data.call?.method === test.method || `expected ${test.method}`;
  if (data.call?.method !== 'setConfig') return 'expected setConfig';
  const patch = data.call.args[0];
  for (const [key, value] of Object.entries(test.patch ?? {}))
    if (patch[key] !== value) return `expected ${key}=${value}`;
  for (const key of test.absent ?? []) if (key in patch) return `unexpected ${key}`;
  if (test.lane) {
    const next = { ...test.current, ...patch };
    if (!test.oneOf.some(expected => same(positions(next, test.lane), expected)))
      return `${test.lane} at ${JSON.stringify(positions(next, test.lane))}`;
    for (const lane of ['kick', 'snare', 'hat'].filter(l => l !== test.lane))
      if (!same(positions(next, lane), positions(test.current, lane))) return `${lane} changed`;
  }
  return true;
}

const answered = data =>
  Object.entries(data.debug ?? {})
    .flatMap(([stage, trace]) =>
      Object.entries(trace?.answers ?? {})
        .filter(([, a]) => !['keep', 'none'].includes(a.choice))
        .map(([key, a]) => `${stage === 'main' ? '' : stage + '.'}${key}=${a.choice} (${a.confidence.toFixed(2)})`),
    )
    .join(', ');

let passed = 0;
for (const test of cases) {
  const response = await fetch(new URL('/api/voice', origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: test.prompt,
      currentConfig: test.current,
      recentTurns: test.recentTurns,
      debug: true,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    console.error(`Server error: ${data.error}`);
    process.exit(1);
  }
  const verdict = judge(test, data);
  if (verdict === true) passed++;
  console.log(`${verdict === true ? '✓' : '✗'} ${test.prompt}${test.note ? `  [${test.note}]` : ''}`);
  console.log(`    ${data.message} · ${data.ms} ms${verdict === true ? '' : ` · ${verdict}`}`);
  console.log(`    ${answered(data)}`);
}
console.log(`\n${passed}/${cases.length} cases matched.`);
