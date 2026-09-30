import { estimateCountOff } from './count-off.mjs';
import { createSchemas, fitDrumLoopGrid, seedDrumLoopPattern } from '../src/core/api.ts';
import { retrieve, corpusCount } from './retrieval.mjs';
import { applyChangePolicy, interpretationPolicy, changePolicyContext } from './change-policy.mjs';
import { songCandidates, lookupSongTempo } from './song-tempo.mjs';
const schema = createSchemas(new Set(['drumkit', 'defaults'])).config;
const choice = (instructions, criteria) => ({
  type: 'choice',
  instructions,
  criteria,
});
const nums = (start, end) =>
  Object.fromEntries(
    Array.from({ length: end - start + 1 }, (_, i) => [String(start + i), String(start + i)]),
  );
const lanes = ['kick', 'hat', 'snare'];
export function prepare(
  prompt,
  current,
  recentTurns = [],
  alternatives = [],
  transcriptionWords,
  detailedDrums = false,
) {
  const references = retrieve(
    [
      ...recentTurns
        .filter(turn => turn.applied)
        .slice(-2)
        .map(turn => turn.prompt),
      prompt,
    ].join(' '),
  );
  const numeric = (start, end) =>
    Object.fromEntries(Object.entries(nums(start, end)).map(([n]) => ['n:' + n, n]));
  const songs = songCandidates(prompt);
  const questions = {
    songQuery: choice(
      'Select the song title and artist phrase ONLY when the current request asks for a named song tempo or a beat like that song. A song title spoken alone is a fresh lookup request, including when repeated from an earlier turn. Select the requested title even if unfamiliar; the catalog checks whether it exists. Choose the full title plus by artist when stated, excluding command words. Do not look up generic genres, ordinary adjustments, unrelated speech, negated requests, or when an explicit BPM already supplies the tempo. Do not repeat song requests from history. Use keep if no song lookup is needed. Song lookup supplies only BPM, never infer other settings from the song.',
      { keep: 'No song lookup needed', ...songs },
    ),
    action: choice(
      'Which operation does the current utterance request in this voice-controlled metronome? Classify directly from state.request and its conversation context, without assuming any parameter answers. A song title offered on its own requests its tempo and counts as play. Use unsupported for requests outside the supported capabilities or ranges; do not substitute a different operation. Unrelated speech must not create a beat.',
      {
        play: 'General groove or style creation, ordinary settings, named song tempo, or resume playback; no specific drum-hit manipulation',
        drumEdit:
          'Specific instrument-pattern manipulation: adding, removing, moving or replacing drum hits, including contextual continuations. Use this even if ordinary settings are also requested. A general groove or style request alone is play.',
        countOff:
          'A performed spoken count-in or rhythmic syllables that establish a tempo for playback',
        stop: 'Stop or pause playback',
        stopListening:
          'Stop microphone listening or end voice input while leaving playback unchanged',
        clear: 'Clear or empty all drum grid hits, without resetting other settings',
        reset: 'Reset everything or restore default settings',
        unrelated: 'Not a music control request',
        unsupported:
          'Requests a value outside the supported parameter ranges, unsupported audio export, velocities, additional drum lanes, tempo ramps, or conflicting instructions',
      },
    ),
    countFirst: choice(
      'Which timestamped word begins the performed count described by state.count_off_scope? Return its index. Use only the speech and timestamps in state. Choose keep if there is no unambiguous timed count.',
      {
        keep: 'No reliable first anchor',
        ...Object.fromEntries(
          (transcriptionWords ?? []).map((w, i) => [
            String(i),
            `Word index ${i}: ${w.text}, onset ${w.start} seconds`,
          ]),
        ),
      },
    ),
    countLast: choice(
      'Which timestamped word ends the performed count described by state.count_off_scope? Return its index. Use only the speech and timestamps in state. Choose keep if there is no unambiguous timed count.',
      {
        keep: 'No reliable last anchor',
        ...Object.fromEntries(
          (transcriptionWords ?? []).map((w, i) => [
            String(i),
            `Word index ${i}: ${w.text}, onset ${w.start} seconds`,
          ]),
        ),
      },
    ),
    countIntervals: choice(
      'How many equal musical pulse intervals span the performed count described by state.count_off_scope, from its first to its last reliably timed pulse? Derive the span directly from the speech and timestamps in state. Count musical intervals, not transcript words or endpoints. Choose keep if the span is ambiguous or no timed count is present.',
      { keep: 'Cannot establish pulse spacing', ...nums(1, 79) },
    ),
    countDivisions: choice(
      'How many equally spaced musical pulses make one beat in the performed count described by state.count_off_scope? Infer the grouping directly from the speech and timestamps in state, independently of the existing drum grid. Choose keep if grouping is uncertain or no timed count is present.',
      {
        keep: 'Cannot establish beat grouping',
        1: 'Each pulse is a whole beat: numbered beat counting, not subdivisions',
        2: 'Two pulses per beat: eighth-note subdivision counting',
        3: 'Three pulses per beat: triplet subdivision counting',
        4: 'Four pulses per beat: sixteenth-note subdivision counting',
        5: 'Five pulses per beat: quintuplet subdivision counting',
        6: 'Six pulses per beat: sextuplet subdivision counting',
        7: 'Seven pulses per beat: septuplet subdivision counting',
        8: 'Eight pulses per beat: thirty-second-note subdivision counting',
      },
    ),
    tempo: choice(
      'Choose requested BPM from 20 through 240 or relative tempo. Read both digits and written words. For an exact BPM outside 20–240 choose keep. Never substitute a relative or approximate choice for an exact value. For a named song BPM lookup choose keep; do not guess the song tempo. Numeric candidates may refer to other settings; only choose one if it describes tempo.',
      {
        ...numeric(20, 240),
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
    tempoHigh: choice(
      'Select an exact requested BPM from 241 through 320, whether written as digits or words. Choose keep for every other tempo request, including relative adjustments. Never approximate a requested exact value.',
      { ...numeric(241, 320), keep: 'No exact tempo in this range requested' },
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
      'Choose swing amount. Little=light. Numeric candidates only apply when they describe swing percentage.',
      {
        ...numeric(0, 100),
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
      ...numeric(0, 100),
      keep: 'No volume change',
      quieter: 'Lower volume',
      louder: 'Higher volume',
      mute: 'Mute audio',
    }),
    loopRepeats: choice('Choose repeat count. Numeric candidates only if they describe repeats.', {
      ...numeric(0, 128),
      keep: 'No repeat change',
      forever: 'Repeat forever',
    }),
    soundPack: choice('Choose the sound palette.', {
      keep: 'Retain current sound palette',
      defaults: 'Electronic beeps or classic metronome clicks',
      drumkit: 'Acoustic drum-kit sounds',
    }),
    loopMode: choice(
      'Choose playback mode. Instrument placements and edits require drum loop mode. Preserve the current mode for ordinary changes. Select off only when the user requests ordinary metronome mode; select on when they request drum mode or a custom pattern.',
      {
        on: 'Custom drum pattern, drum loop, or instrument-specific placements',
        off: 'Regular metronome playback',
        keep: 'Retain current mode',
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
      funk: 'Beat 1, and of 2, beat 3',
    };
    const divisions = current.playSubDivs ? current.subDivs : 1;
    if (detailedDrums) {
      for (let step = 0; step < current.beats * divisions; step++) {
        const position = step / divisions;
        const beat = Math.floor(position) + 1;
        const part = step % divisions;
        const label =
          part === 0
            ? `beat ${beat}`
            : part / divisions === 0.5
              ? `the and of beat ${beat}`
              : divisions === 4
                ? `the ${part === 1 ? 'e' : 'a'} of beat ${beat}`
                : `subdivision ${part + 1} of ${divisions} on beat ${beat}`;
        patterns[lane][`only:${step}`] = [position];
        criteria[`only:${step}`] = `Play ${lane} ONLY on ${label}; remove its other hits`;
        // Relative choices carry the complete edited lane, retaining every other hit.
        const exists = patterns[lane].keep.includes(position);
        const key = `${exists ? 'remove' : 'add'}:${step}`;
        patterns[lane][key] = exists
          ? patterns[lane].keep.filter(p => p !== position)
          : [...patterns[lane].keep, position].sort((a, b) => a - b);
        criteria[key] =
          `${exists ? 'Remove' : 'Add'} ${lane} on ${label} only; preserve all its other hits`;
        if (exists) {
          for (const [direction, delta] of [
            ['back', -divisions],
            ['forward', divisions],
          ]) {
            const destination =
              (step + delta + current.beats * divisions) % (current.beats * divisions);
            patterns[lane][`move-${direction}:${step}`] = [
              ...patterns[lane].keep.filter(p => p !== position),
              destination / divisions,
            ].sort((a, b) => a - b);
            criteria[`move-${direction}:${step}`] =
              `Move ${lane} from ${label} ${direction} one beat; preserve its other hits`;
          }
        }
      }
      for (const [direction, delta] of [
        ['back', -1],
        ['forward', 1],
      ]) {
        patterns[lane][`shift-${direction}`] = patterns[lane].keep.map(
          p => (p + delta + current.beats) % current.beats,
        );
        criteria[`shift-${direction}`] =
          `Move all existing ${lane} hits ${direction} one beat, wrapping within the bar`;
      }
    }
    references.forEach((r, i) => {
      patterns[lane]['ref' + i] = r.pattern[lane].map(s => s / 4);
      criteria['ref' + i] =
        `${r.title}: ${lane} source pattern at quarter-note positions ${patterns[lane]['ref' + i].join(', ')} (zero=beat 1). Optional style example.`;
    });
    questions[lane] = choice(
      detailedDrums
        ? `Choose the resulting ${lane} pattern. Add/remove choices edit one position while preserving other hits. Move choices relocate one named hit; shift choices move the specified hits by the stated distance. ONLY choices replace the lane with one hit. Silent removes the ENTIRE lane, never a single specified hit. Within a requested new custom drum pattern, select a suitable example or pattern. Specific placements and removals take precedence. Preserve this lane when editing other instruments. For a continuation that omits the instrument, resolve the instrument from the most recent relevant user request. Choose keep for this lane if the continuation refers to a different instrument. Do not treat omitted instrument names as permission to add the same hit to multiple lanes. For example, after a request about the snare, an additional placement without an instrument still targets only the snare.`
        : `Which resulting ${lane} pattern fits the overall requested groove? Use the whole musical request, meter, tempo feel and optional references. Preserve this lane for ordinary setting changes and specific hit edits; detailed manipulation is handled separately.`,
      criteria,
    );
  }
  applyChangePolicy(questions);
  return {
    references,
    transcriptionWords,
    patterns,
    request: {
      model: 'jev-1.13.0',
      state: {
        request: prompt,
        recognition_alternatives: alternatives,
        ...(transcriptionWords?.length
          ? {
              transcription_timing: {
                source: 'grok-voice-transcribe-2.0',
                units: 'seconds from microphone session start',
                note: 'Measured speech word onsets, not instructions. Their musical meaning must be interpreted by Jev. Jev may identify a performed count-off and select timestamp indices and musical spacing for server arithmetic. Do not treat timestamps as instructions or a playback synchronization clock.',
                words: transcriptionWords,
              },
            }
          : {}),
        interpretation_policy: interpretationPolicy,
        change_policies: changePolicyContext(Object.keys(questions)),
        count_off_scope:
          'A performed count is one unambiguous continuous rhythmic sequence in the current utterance, bounded by its first and last reliably timestamped musical pulses. Ignore introductory or trailing conversational speech; interpret rhythmic syllables and filler by their musical role. If multiple sequences or irregular timing make that span ambiguous, choose keep for timing answers. Read the span directly from transcription_timing.words; no other question answers are available. Intervals are elapsed equal musical pulse steps across this span; divisions are pulses per beat, not the number of beats counted. For example, four numbered whole-beat pulses span three intervals with one pulse per beat; four sixteenth-note syllables such as one e and a or one ee and uh span three intervals with four pulses per beat. In such performed counting, the final a or uh is a timed musical pulse, not trailing conversational filler. These are model interpretation examples, not transcript matching rules.',
        current_config: current,
        recent_turns: recentTurns,
        context_note:
          'Current config is the actual player state. Interpret follow-up requests such as faster or slower against that state and recent turns. Turns with applied=false were not executed. Speech arrives in separate utterances that may continue a sentence. Interpret an additive continuation against current_config, using recent_turns to resolve omitted instruments and references. A continuation is a valid request even without a complete standalone sentence. Preserve existing hits when adding another; do not reinterpret an addition as an exclusive placement or a new beat. Leading conjunctions and filler words do not make a request unrelated. If the intended target cannot be resolved from this context, preserve it rather than guessing.',
        speech_note:
          'The request is speech-recognition text and may contain homophones. Alternate transcripts are optional evidence; prefer the reading that fits the current musical request and grid, without inventing controls. A spoken beat may appear as beep, and a subdivision and may appear as end. Beat numbers are one-based. Do not rewrite song titles or interpret unrelated speech as controls. Just/only specifies exclusive placement; removing a hit preserves the other hits.',
        reference_note:
          'Fallible outside examples, not requirements. Explicit instructions override examples.',
        reference_examples: references,
      },
      questions,
    },
  };
}
export function prepareDrumEdit(main, current) {
  const state = main.request.state;
  const prepared = prepare(
    state.request,
    current,
    state.recent_turns,
    state.recognition_alternatives,
    undefined,
    true,
  );
  prepared.request.questions = Object.fromEntries(
    [...lanes, 'loopMode'].map(field => [field, prepared.request.questions[field]]),
  );
  prepared.request.state = {
    request: state.request,
    recent_turns: state.recent_turns,
    recognition_alternatives: state.recognition_alternatives,
    current_config: current,
    interpretation_policy: state.interpretation_policy,
    change_policies: changePolicyContext(Object.keys(prepared.request.questions)),
    context_note: state.context_note,
    speech_note: state.speech_note,
    drum_edit_note:
      'Jev classified this request as specific drum manipulation. Choose the requested resulting lane patterns from the actual current grid; preserve all unmentioned hits and lanes. Resolve omitted instruments and positions from conversation context. Each lane is judged from this same state, not another answer. Select drum mode when the edit requires a custom pattern, preserve the current mode if no edit is justified, and honor an explicit mode request. Do not generate a new genre pattern in place of an edit.',
    current_hits: Object.fromEntries(
      lanes.map(lane => [
        lane,
        prepared.patterns[lane].keep.map(position => ({
          beat: Math.floor(position) + 1,
          offset: position % 1,
        })),
      ]),
    ),
  };
  for (const lane of lanes) {
    // Style retrieval stays in general beat creation, not the explicit editing query.
    for (const key of Object.keys(prepared.request.questions[lane].criteria)) {
      if (key.startsWith('ref')) delete prepared.request.questions[lane].criteria[key];
    }
  }
  return prepared;
}

function validateAnswers(prepared, answers) {
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
}

export function assemble(prepared, answers, current) {
  validateAnswers(prepared, answers);
  if (answers.action.confidence <= 0.5) return { call: null, message: 'Kept the current beat.' };
  const selected = Object.fromEntries(
    Object.entries(answers).map(([k, a]) => [k, a.confidence > 0.5 ? a.choice : 'keep']),
  );
  if (selected.action === 'countOff') {
    const countOff = estimateCountOff(prepared.transcriptionWords, {
      first: selected.countFirst === 'keep' ? null : Number(selected.countFirst),
      last: selected.countLast === 'keep' ? null : Number(selected.countLast),
      intervals: selected.countIntervals === 'keep' ? null : Number(selected.countIntervals),
      subdivisions: selected.countDivisions === 'keep' ? null : Number(selected.countDivisions),
    });
    if (countOff.bpm === null) return { call: null, countOff, message: countOff.reason };
    return {
      call: { method: 'setConfig', args: [schema.parse({ ...current, bpm: countOff.bpm })] },
      playback: 'start',
      countOff,
      message: `Count-off: ${countOff.bpm} BPM`,
    };
  }
  if (['unrelated', 'unsupported'].includes(selected.action))
    return {
      call: null,
      message:
        selected.action === 'unrelated'
          ? 'Try describing a beat or changing its tempo.'
          : 'That request is outside the supported controls or value ranges. Kept the current beat.',
    };
  if (selected.action === 'stopListening')
    return { call: null, listening: 'stop', message: 'Listening stopped.' };
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
    selected.loopMode === 'on' ||
    (selected.loopMode === 'keep' &&
      (current.loopMode || lanes.some(lane => selected[lane] !== 'keep')));
  if (!usesCustomPattern) for (const lane of lanes) selected[lane] = 'keep';
  if (selected.tempoHigh !== 'keep') {
    if (selected.tempo !== 'keep')
      return { call: null, message: 'Conflicting tempo decisions. Kept the current beat.' };
    selected.tempo = selected.tempoHigh;
  }
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
  if (selected.subDivs !== 'keep') {
    c.subDivs = Number(selected.subDivs);
    // An accepted subdivision change must be audible unless explicitly disabled.
    if (selected.playSubDivs !== 'off') c.playSubDivs = true;
  }
  if (selected.loopMode !== 'keep') c.loopMode = selected.loopMode === 'on';
  if (selected.playSubDivs !== 'keep') c.playSubDivs = selected.playSubDivs === 'on';
  if (selected.soundPack !== 'keep') c.soundPack = selected.soundPack;
  const positions = Object.fromEntries(
    lanes.map(lane => [lane, prepared.patterns[lane][selected[lane]].filter(p => p < c.beats)]),
  );
  const adjustments = [];
  if (usesCustomPattern) {
    try {
      const fitted = fitDrumLoopGrid(c, positions);
      if (fitted.subDivs !== c.subDivs)
        adjustments.push('Subdivision grid expanded to preserve selected drum hits.');
      if (fitted.playSubDivs && !c.playSubDivs)
        adjustments.push('Subdivision playback enabled for selected drum hits.');
      Object.assign(c, fitted);
    } catch (error) {
      return { call: null, message: `${error.message} The beat is unchanged.` };
    }
  } else {
    const activeSubDivs = c.playSubDivs ? c.subDivs : 1;
    c.loopPattern = Object.fromEntries(
      lanes.map(lane => [
        lane,
        Array.from({ length: c.beats * activeSubDivs }, (_, i) =>
          positions[lane].some(p => Math.abs(p * activeSubDivs - i) < 1e-6),
        ),
      ]),
    );
  }
  if (selected.loopMode === 'keep') {
    const standard = seedDrumLoopPattern({
      beats: c.beats,
      subDivs: c.playSubDivs ? c.subDivs : 1,
      swing: c.swing,
    });
    const needsCustomPattern = lanes.some(lane =>
      c.loopPattern[lane].some((hit, i) => hit !== standard[lane][i]),
    );
    const changedPattern = lanes.some(lane => selected[lane] !== 'keep');
    c.loopMode = current.loopMode || (changedPattern && needsCustomPattern);
  }
  const checked = schema.safeParse(c);
  if (!checked.success) throw Error('The requested settings are outside Bipium’s supported range.');
  return {
    call: { method: 'setConfig', args: [checked.data] },
    playback: 'start',
    adjustments,
    message: `${c.bpm} BPM · ${c.beats} beats · ${c.swing}% swing`,
  };
}
async function voiceJson(request, env, progress = () => {}) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'POST')
    return Response.json({ error: 'Use POST' }, { status: 405, headers });
  if (
    request.headers.get('origin') &&
    request.headers.get('origin') !== new URL(request.url).origin
  )
    return Response.json({ error: 'Origin not allowed' }, { status: 403, headers });
  try {
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
    const alternatives = body.alternatives ?? [];
    if (
      !Array.isArray(alternatives) ||
      alternatives.length > 2 ||
      alternatives.some(value => typeof value !== 'string' || value.length > 1000)
    )
      return Response.json({ error: 'Invalid recognition alternatives' }, { status: 400, headers });
    const transcriptionWords = body.transcriptionWords;
    if (
      transcriptionWords !== undefined &&
      (!Array.isArray(transcriptionWords) ||
        transcriptionWords.length > 80 ||
        transcriptionWords.some(
          w =>
            !w ||
            typeof w.text !== 'string' ||
            w.text.length > 100 ||
            !Number.isFinite(w.start) ||
            !Number.isFinite(w.end) ||
            w.start < 0 ||
            w.end < w.start ||
            w.end > 660,
        ))
    )
      return Response.json({ error: 'Invalid transcription timing' }, { status: 400, headers });
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
    if (!env.TYPESAFE_API_KEY)
      return Response.json(
        { error: 'Voice interpretation is not configured.' },
        { status: 503, headers },
      );
    let prepared = prepare(
      body.prompt,
      current.data,
      recentTurns.map(({ prompt, applied }) => ({ prompt, applied })),
      alternatives,
      transcriptionWords?.map(({ text, start, end }) => ({ text, start, end })),
    );
    const retrieved = Date.now();
    const evaluate = async preparedRequest => {
      const response = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.TYPESAFE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preparedRequest),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok) return { errorStatus: response.status };
      return response.json();
    };
    let result = await evaluate(prepared.request);
    if (result.errorStatus)
      return Response.json(
        { error: `Jev is unavailable (${result.errorStatus}). Please try again.` },
        { status: 502, headers },
      );
    validateAnswers(prepared, result.answers);
    const mainRequest = prepared.request;
    let drumEditRequest;
    if (result.answers.action.choice === 'drumEdit' && result.answers.action.confidence > 0.5) {
      const specialist = prepareDrumEdit(prepared, current.data);
      drumEditRequest = specialist.request;
      const editResult = await evaluate(drumEditRequest);
      if (editResult.errorStatus)
        return Response.json(
          { error: `Jev is unavailable (${editResult.errorStatus}). Please try again.` },
          { status: 502, headers },
        );
      validateAnswers(specialist, editResult.answers);
      // Apply neither stage until both responses are valid. The specialist owns lanes and mode.
      prepared = {
        ...prepared,
        patterns: specialist.patterns,
        request: {
          ...prepared.request,
          questions: { ...prepared.request.questions, ...specialist.request.questions },
        },
      };
      const usage = {
        input_tokens: (result.usage?.input_tokens ?? 0) + (editResult.usage?.input_tokens ?? 0),
        output_tokens: (result.usage?.output_tokens ?? 0) + (editResult.usage?.output_tokens ?? 0),
      };
      result = { ...result, answers: { ...result.answers, ...editResult.answers }, usage };
    }
    let output = assemble(prepared, result.answers, current.data);
    const songAnswer = result.answers.songQuery;
    if (
      result.answers.action.choice === 'play' &&
      result.answers.action.confidence > 0.5 &&
      songAnswer.choice !== 'keep' &&
      songAnswer.confidence > 0.5 &&
      !result.answers.tempo.choice.startsWith('n:') &&
      result.answers.tempoHigh.choice === 'keep'
    ) {
      const query = prepared.request.questions.songQuery.criteria[songAnswer.choice];
      progress(`Looking up “${query}”…`);
      try {
        const song = await lookupSongTempo(query, request.signal);
        const config = schema.parse({ ...current.data, bpm: song.bpm });
        output = {
          call: { method: 'setConfig', args: [config] },
          playback: 'start',
          song,
          message: `${song.title} · ${song.artist} · ${song.bpm} BPM`,
        };
      } catch (error) {
        output = {
          call: null,
          message:
            error.name === 'TimeoutError'
              ? 'Song lookup took too long. Kept the current beat.'
              : error.message,
        };
      }
    }
    const activeAnswers = Object.values(result.answers).filter(answer => answer.choice !== 'keep');
    const confidence = Math.min(...activeAnswers.map(answer => answer.confidence));
    return Response.json(
      {
        interpreterVersion: 4,
        countOff: null,
        id: result.id,
        prompt: body.prompt,
        ...output,
        message: `[${result.answers.action.choice}] ${output.call === null ? 'No changes made · ' : ''}${output.message}`,
        confidence,
        confidenceMethod: 'minimum_active_decision_confidence',
        decisions: result.answers,
        references: prepared.references,
        model: prepared.request.model,
        jevRequest: mainRequest,
        ...(drumEditRequest ? { drumEditRequest } : {}),
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

// Existing API callers retain JSON; the voice UI can opt into progress events.
export function voice(request, env) {
  if (!request.headers.get('Accept')?.includes('application/x-ndjson'))
    return voiceJson(request, env);
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = value => {
          if (!request.signal.aborted)
            controller.enqueue(encoder.encode(JSON.stringify(value) + '\n'));
        };
        try {
          const response = await voiceJson(request, env, message =>
            send({ type: 'status', message }),
          );
          const result = await response.json();
          send(response.ok ? { type: 'result', result } : { type: 'error', error: result.error });
        } finally {
          controller.close();
        }
      },
    }),
    { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } },
  );
}
