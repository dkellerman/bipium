import { createSchemas } from '../src/core/api.ts';
import { retrieve, corpusCount } from './retrieval.mjs';
const schema = createSchemas(new Set(['drumkit', 'defaults'])).config;
const choice = (instructions, criteria) => ({
  type: 'choice',
  instructions:
    instructions +
    ' Follow the user request over optional source examples. Preserve unmentioned settings for edits.',
  criteria,
});
const nums = (start, end) =>
  Object.fromEntries(
    Array.from({ length: end - start + 1 }, (_, i) => [String(start + i), String(start + i)]),
  );
const lanes = ['kick', 'hat', 'snare'];
export function prepare(prompt, current, recentTurns = []) {
  const references = retrieve(
    [
      ...recentTurns
        .filter(turn => turn.applied)
        .slice(-2)
        .map(turn => turn.prompt),
      prompt,
    ].join(' '),
  );
  const numeric = Object.fromEntries(
    [...new Set(prompt.match(/\d+(?:\.\d+)?/g) || [])].slice(0, 30).map(n => ['n:' + n, n]),
  );
  const questions = {
    action: choice('Classify the requested operation. Unrelated speech must not create a beat.', {
      play: 'Create or change a beat, tempo, metronome or resume playback',
      stop: 'Stop or pause playback',
      clear: 'Clear or empty all drum grid hits, without resetting other settings',
      reset: 'Reset everything or restore default settings',
      unrelated: 'Not a music control request',
      unsupported:
        'Requires unsupported audio export, velocities, additional drum lanes, tempo ramps, or conflicting instructions',
    }),
    tempo: choice(
      'Choose requested BPM or relative tempo. Numeric candidates may refer to other settings; only choose one if it describes tempo.',
      {
        ...numeric,
        keep: 'No tempo change stated',
        slow: 'Slow tempo',
        medium: 'Mid tempo',
        fast: 'Fast tempo',
        faster: 'Increase existing BPM',
        slower: 'Decrease existing BPM',
        double: 'Double existing BPM',
        half: 'Halve existing BPM',
      },
    ),
    beats: choice(
      'Choose pulses per bar. 3/4 waltz=3, 6/8=2 dotted quarter pulses, 12/8=4. Preserve current unless a new style needs a different meter.',
      { ...nums(1, 12), keep: 'Keep current meter' },
    ),
    subDivs: choice(
      'Choose subdivisions per pulse. Quarter=1, eighth=2, triplets=3, sixteenths=4, thirty seconds=8. Compound meters use3.',
      { ...nums(1, 8), keep: 'No explicit subdivision change' },
    ),
    swing: choice(
      'Choose swing amount. Do not infer swing from genre alone. Little=light. Numeric candidates only apply when they describe swing percentage.',
      {
        ...numeric,
        keep: 'No swing change',
        straight: 'Straight or no swing',
        light: 'A little swing',
        medium: 'Swing or shuffle',
        heavy: 'Heavy swing',
        more: 'More swing',
        less: 'Less swing',
      },
    ),
    volume: choice('Choose master volume percentage or relative change.', {
      ...numeric,
      keep: 'No volume change',
      quieter: 'Lower volume',
      louder: 'Higher volume',
      mute: 'Mute audio',
    }),
    loopRepeats: choice('Choose repeat count. Numeric candidates only if they describe repeats.', {
      ...numeric,
      keep: 'No repeat change',
      forever: 'Repeat forever',
    }),
    soundPack: choice(
      'Sound changes are rare and must be explicitly requested in the CURRENT request. Default to keep. Do not infer a sound change from genre, a new beat, tempo, swing, regular metronome mode, or stopping custom drum patterns. Do not repeat an earlier sound request from conversation history. Respect negation: do not use beeps means keep the existing sounds unless a replacement is specified.',
      {
        keep: 'No explicit request to change sounds, or a sound change is negated; retain the current sound pack',
        defaults:
          'Explicit request to switch to electronic beeps, beep sounds, or classic metronome click sounds',
        drumkit: 'Explicit request to switch back to drum-kit or acoustic drum sounds',
      },
    ),
    loopMode: choice(
      'Prefer regular metronome playback. A generic beat, groove, genre, tempo, or swing request does not ask for a custom drum pattern. Use custom drum-loop mode only when the user explicitly requests a custom drum pattern, drum loop, or instrument-specific placements. Preserve the current mode for follow-up adjustments like faster, slower, or volume changes.',
      {
        on: 'Explicit custom drum pattern, drum loop, or kick/snare/hat placement request',
        off: 'New ordinary beat or metronome request without explicit custom drums; also plain clicks',
        keep: 'Follow-up adjustment without a mode change',
      },
    ),
    playSubDivs: choice(
      'Choose whether to hear subdivisions. Removing hats alone does not silence all subdivisions.',
      {
        on: 'Hear subdivisions',
        off: 'Only main beats; silence subdivision clicks',
        keep: 'No explicit instruction',
      },
    ),
  };
  const patterns = {};
  for (const lane of lanes) {
    patterns[lane] = {
      keep: current.loopPattern[lane].flatMap((hit, i) =>
        hit ? [i / (current.playSubDivs ? current.subDivs : 1)] : [],
      ),
      silent: [],
      quarters: Array.from({ length: 12 }, (_, i) => i),
      eighths: Array.from({ length: 24 }, (_, i) => i / 2),
      sixteenths: Array.from({ length: 48 }, (_, i) => i / 4),
      offbeats: Array.from({ length: 12 }, (_, i) => i + 0.5),
      backbeat: [1, 3],
      one_three: [0, 2],
      one: [0],
      three: [2],
      funk: [0, 1.5, 2],
    };
    const criteria = {
      keep: 'Preserve current lane; no change to this instrument requested',
      silent: `No ${lane}; remove or silence all`,
      quarters: 'Every main beat',
      eighths: 'Every eighth note',
      sixteenths: 'Every sixteenth note',
      offbeats: 'Only the and after every beat',
      backbeat: 'Only beats 2 and 4',
      one_three: 'Only beats 1 and 3',
      one: 'Only beat 1',
      three: 'Only beat 3',
      funk: 'Beat 1, and of 2, beat 3',
    };
    references.forEach((r, i) => {
      patterns[lane]['ref' + i] = r.pattern[lane].map(s => s / 4);
      criteria['ref' + i] =
        `${r.title}: ${lane} source pattern at quarter-note positions ${patterns[lane]['ref' + i].join(', ')} (zero=beat 1). Optional style example.`;
    });
    questions[lane] = choice(
      `Choose COMPLETE ${lane} pattern. Use keep unless the user explicitly requests custom drums, a drum loop, or changes to this instrument. A genre name or generic beat request alone does not request a custom pattern. For explicit custom drums select a suitable example or pattern; explicit placements and removals take precedence. Preserve this lane when editing other fields.`,
      criteria,
    );
  }
  return {
    references,
    patterns,
    request: {
      model: 'typesafe/jev-1.13',
      state: {
        request: prompt,
        current_config: current,
        recent_turns: recentTurns,
        context_note:
          'Current config is the actual player state. Interpret follow-up requests such as faster or slower against that state and recent turns. Turns with applied=false were not executed.',
        reference_note:
          'Fallible outside examples, not requirements. Explicit instructions override examples.',
        reference_examples: references,
      },
      questions,
    },
  };
}
export function assemble(prepared, answers, current) {
  for (const [field, q] of Object.entries(prepared.request.questions)) {
    const a = answers?.[field];
    if (
      !a ||
      !Object.hasOwn(q.criteria, a.choice) ||
      !Number.isFinite(a.confidence) ||
      a.confidence < 0 ||
      a.confidence > 1 ||
      !a.probabilities
    )
      throw Error('Jev returned an incomplete decision. Please try again.');
  }
  if (answers.action.confidence <= 0.5) return { call: null, message: 'Kept the current beat.' };
  const selected = Object.fromEntries(
    Object.entries(answers).map(([k, a]) => [k, a.confidence > 0.5 ? a.choice : 'keep']),
  );
  if (['unrelated', 'unsupported'].includes(selected.action))
    return {
      call: null,
      message:
        selected.action === 'unrelated'
          ? 'Try describing a beat or changing its tempo.'
          : 'That request needs controls this version does not support.',
    };
  if (selected.action === 'stop')
    return { call: { method: 'stop', args: [] }, message: 'Playback stopped.' };
  if (selected.action === 'clear' || selected.action === 'reset') {
    return {
      call: {
        method: selected.action === 'clear' ? 'clearLoopPattern' : 'resetToDefaults',
        args: [],
      },
      message: selected.action === 'clear' ? 'Drum grid cleared.' : 'Reset to defaults.',
    };
  }
  const usesCustomPattern =
    selected.loopMode === 'on' || (selected.loopMode === 'keep' && current.loopMode);
  if (!usesCustomPattern) for (const lane of lanes) selected[lane] = 'keep';
  const c = structuredClone(current);
  const numeric = (s, old, map) => (s.startsWith('n:') ? Number(s.slice(2)) : (map[s] ?? old));
  c.bpm = numeric(selected.tempo, c.bpm, {
    slow: 70,
    medium: 100,
    fast: 150,
    faster: c.bpm + 10,
    slower: c.bpm - 10,
    double: c.bpm * 2,
    half: c.bpm / 2,
  });
  c.swing = numeric(selected.swing, c.swing, {
    straight: 0,
    light: 15,
    medium: 33,
    heavy: 50,
    more: c.swing + 10,
    less: c.swing - 10,
  });
  c.volume = numeric(selected.volume, c.volume, {
    quieter: c.volume - 10,
    louder: c.volume + 10,
    mute: 0,
  });
  c.loopRepeats = numeric(selected.loopRepeats, c.loopRepeats, { forever: 0 });
  if (selected.beats !== 'keep') c.beats = Number(selected.beats);
  if (selected.subDivs !== 'keep') c.subDivs = Number(selected.subDivs);
  if (selected.loopMode !== 'keep') c.loopMode = selected.loopMode === 'on';
  if (selected.playSubDivs !== 'keep') c.playSubDivs = selected.playSubDivs === 'on';
  if (selected.soundPack !== 'keep') c.soundPack = selected.soundPack;
  const positions = Object.fromEntries(
    lanes.map(lane => [lane, prepared.patterns[lane][selected[lane]].filter(p => p < c.beats)]),
  );
  const adjustments = [];
  if (c.loopMode) {
    const all = Object.values(positions).flat();
    if (all.some(p => Math.abs(p * c.subDivs - Math.round(p * c.subDivs)) > 1e-6)) {
      const compatible = [1, 2, 3, 4, 5, 6, 7, 8].find(
        n => n >= c.subDivs && all.every(p => Math.abs(p * n - Math.round(p * n)) < 1e-6),
      );
      if (answers.subDivs.confidence <= 0.5) {
        for (const lane of lanes)
          if (
            positions[lane].some(p => Math.abs(p * c.subDivs - Math.round(p * c.subDivs)) > 1e-6)
          ) {
            positions[lane] = prepared.patterns[lane].keep.filter(p => p < c.beats);
          }
      } else {
        if (!compatible) return { call: null, message: 'Couldn’t make that beat. Try rephrasing.' };
        c.subDivs = compatible;
        adjustments.push('Subdivision grid expanded to preserve selected drum hits.');
      }
    }
    if (
      Object.values(positions)
        .flat()
        .some(p => p % 1 !== 0) &&
      !c.playSubDivs
    ) {
      if (answers.playSubDivs.confidence <= 0.5) {
        for (const lane of lanes)
          if (positions[lane].some(p => p % 1 !== 0))
            positions[lane] = prepared.patterns[lane].keep.filter(p => p < c.beats);
      } else {
        c.playSubDivs = true;
        adjustments.push('Subdivision playback enabled for selected drum hits.');
      }
    }
  }
  const activeSubDivs = c.playSubDivs ? c.subDivs : 1;
  c.loopPattern = Object.fromEntries(
    lanes.map(lane => [
      lane,
      Array.from({ length: c.beats * activeSubDivs }, (_, i) =>
        positions[lane].some(p => Math.abs(p * activeSubDivs - i) < 1e-6),
      ),
    ]),
  );
  const checked = schema.safeParse(c);
  if (!checked.success) throw Error('The requested settings are outside Bipium’s supported range.');
  return {
    call: { method: 'setConfig', args: [checked.data] },
    playback: 'start',
    adjustments,
    message: `${c.bpm} BPM · ${c.beats} beats · ${c.swing}% swing`,
  };
}
export async function voice(request, env) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'POST')
    return Response.json({ error: 'Use POST' }, { status: 405, headers });
  if (
    request.headers.get('origin') &&
    request.headers.get('origin') !== new URL(request.url).origin
  )
    return Response.json({ error: 'Origin not allowed' }, { status: 403, headers });
  try {
    if (!env.OPENROUTER_API_KEY)
      return Response.json(
        { error: 'Voice interpretation is not configured.' },
        { status: 503, headers },
      );
    const raw = await request.text();
    if (raw.length > 18000)
      return Response.json({ error: 'Request too large' }, { status: 413, headers });
    const body = JSON.parse(raw);
    if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 1000)
      return Response.json(
        { error: 'Please use a short beat description.' },
        { status: 400, headers },
      );
    const current = schema.safeParse(body.currentConfig);
    if (!current.success)
      return Response.json({ error: 'Invalid current configuration' }, { status: 400, headers });
    const recentTurns = body.recentTurns ?? [];
    if (
      !Array.isArray(recentTurns) ||
      recentTurns.length > 6 ||
      recentTurns.some(
        turn =>
          !turn ||
          typeof turn.prompt !== 'string' ||
          turn.prompt.length > 1000 ||
          typeof turn.applied !== 'boolean',
      )
    )
      return Response.json({ error: 'Invalid voice context' }, { status: 400, headers });
    const start = Date.now();
    const prepared = prepare(
      body.prompt,
      current.data,
      recentTurns.map(({ prompt, applied }) => ({ prompt, applied })),
    );
    const retrieved = Date.now();
    const response = await fetch('https://openrouter.ai/api/alpha/decisions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(prepared.request),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    });
    if (!response.ok)
      return Response.json(
        { error: `Jev is unavailable (${response.status}). Please try again.` },
        { status: 502, headers },
      );
    const result = await response.json();
    const output = assemble(prepared, result.answers, current.data);
    const activeAnswers = Object.values(result.answers).filter(answer => answer.choice !== 'keep');
    const confidence = Math.min(...activeAnswers.map(answer => answer.confidence));
    return Response.json(
      {
        id: result.id,
        prompt: body.prompt,
        ...output,
        confidence,
        confidenceMethod: 'minimum_active_decision_confidence',
        decisions: result.answers,
        references: prepared.references,
        model: prepared.request.model,
        jevRequest: prepared.request,
        usage: result.usage,
        timing: { retrievalMs: retrieved - start, totalMs: Date.now() - start },
        corpusCount,
      },
      { headers },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof SyntaxError
            ? 'Invalid JSON request'
            : error.name === 'TimeoutError'
              ? 'Jev took too long. Please try again.'
              : error.message || 'Could not interpret that phrase.',
      },
      { status: 422, headers },
    );
  }
}
