import { estimateCountOff } from './count-off.mjs';
import { createSchemas, fitDrumLoopGrid, seedDrumLoopPattern } from '../src/core/api.ts';
import { retrieve, corpusCount } from './retrieval.mjs';
import { drumEditContext, positionLabel, applyDrumEdit } from './drum-edits.mjs';
import { applyChangePolicy } from './change-policy.mjs';
import { songCandidates, lookupSongTempo } from './song-tempo.mjs';
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
function explicitMode(prompt) {
  const mode = prompt.match(
    /\b(?:switch|change|go|return|back|use|set|turn)\s+(?:back\s+)?(?:to|into|on)?\s*(?:the\s+)?(drum|beat|metronome|regular|standard|normal)\s+mode\b/i,
  );
  if (!mode) return null;
  return mode[1].toLowerCase() === 'drum' ? 'on' : 'off';
}
export function prepare(prompt, current, recentTurns = [], alternatives = [], transcriptionWords) {
  const editContext = drumEditContext(prompt, current);
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
  const songs = songCandidates(prompt);
  const questions = {
    songQuery: choice(
      'Select the song title and artist phrase ONLY when the current request asks for a named song tempo or a beat like that song. A song title spoken alone is a fresh lookup request, including when repeated from an earlier turn. Select the requested title even if unfamiliar; the catalog checks whether it exists. Choose the full title plus by artist when stated, excluding command words. Do not look up generic genres, ordinary adjustments, unrelated speech, negated requests, or when an explicit BPM already supplies the tempo. Do not repeat song requests from history. Use keep if no song lookup is needed. Song lookup supplies only BPM, never infer other settings from the song.',
      { keep: 'No song lookup needed', ...songs },
    ),
    action: choice(
      'Classify the requested operation in a voice-controlled metronome. A song title offered on its own requests its tempo and counts as play. Unrelated speech must not create a beat.',
      {
        play: 'Create or change a beat, tempo, metronome, request a named song tempo, or resume playback',
        stop: 'Stop or pause playback',
        clear: 'Clear or empty all drum grid hits, without resetting other settings',
        reset: 'Reset everything or restore default settings',
        unrelated: 'Not a music control request',
        unsupported:
          'Requires unsupported audio export, velocities, additional drum lanes, tempo ramps, or conflicting instructions',
      },
    ),
    tempo: choice(
      'Choose requested BPM or relative tempo. For a named song BPM lookup choose keep; do not guess the song tempo. Numeric candidates may refer to other settings; only choose one if it describes tempo.',
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
      'Choose swing amount. Little=light. Numeric candidates only apply when they describe swing percentage.',
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
    soundPack: choice('Choose the sound palette.', {
      keep: 'Retain current sound palette',
      defaults: 'Electronic beeps or classic metronome clicks',
      drumkit: 'Acoustic drum-kit sounds',
    }),
    loopMode: choice(
      'Choose playback mode. Instrument placements and edits require drum loop mode. For a new ordinary beat use regular metronome mode. Preserve mode for tempo-only follow-up edits.',
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
    // Requested positions exist independently of the currently displayed grid.
    const targets = [...new Set(editContext.positions.filter(p => p >= 0 && p < current.beats))];
    const destinations = targets.map(p => [p]);
    if (targets.length > 1) destinations.push(targets);
    for (const destination of destinations) {
      for (const operation of ['add', 'remove', 'replace']) {
        const key = `edit:${operation}:${destination.join(',')}`;
        patterns[lane][key] = applyDrumEdit(
          patterns[lane].keep,
          { operation, destination },
          current.beats,
        );
        criteria[key] =
          `${operation === 'replace' ? 'Play ONLY' : operation === 'add' ? 'Add' : 'Remove'} ${lane} on ${destination.map(positionLabel).join(' and ')}; ${operation === 'replace' ? 'replace this lane' : 'preserve every other hit'}`;
      }
    }
    const edit = editContext.edits[lane];
    if (edit) {
      patterns[lane][edit.key] = edit.pattern;
      // One complete operation avoids splitting confidence across equivalent choices.
      for (const key of Object.keys(criteria)) if (key !== 'keep') delete criteria[key];
      criteria[edit.key] = edit.description;
    }
    references.forEach((r, i) => {
      patterns[lane]['ref' + i] = r.pattern[lane].map(s => s / 4);
      if (edit) return;
      criteria['ref' + i] =
        `${r.title}: ${lane} source pattern at quarter-note positions ${patterns[lane]['ref' + i].join(', ')} (zero=beat 1). Optional style example.`;
    });
    questions[lane] = choice(
      `Choose the resulting ${lane} pattern. Add/remove choices edit one position while preserving other hits. Move choices relocate one named hit; shift choices move the specified hits by the stated distance. ONLY choices replace the lane with one hit. Silent removes the ENTIRE lane, never a single specified hit. Within a requested new custom drum pattern, select a suitable example or pattern. Specific placements and removals take precedence. Preserve this lane when editing other instruments.`,
      criteria,
    );
  }
  applyChangePolicy(questions);
  return {
    references,
    patterns,
    editContext,
    explicitGridChange:
      /\b(?:subdivisions?|subdivs?|grid)\b/i.test(prompt) ||
      /\b(?:switch|change|set|use|play)\b.*\b(?:eighths|sixteenths|triplets|thirty.seconds)\b/i.test(
        prompt,
      ),
    explicitMode: explicitMode(prompt),
    instrumentEdit: /\b(kick|snare|hi[ -]?hat|hats?)\b/i.test(prompt),
    request: {
      model: 'typesafe/jev-1.13',
      state: {
        request: prompt,
        recognition_alternatives: alternatives,
        ...(transcriptionWords?.length
          ? {
              transcription_timing: {
                source: 'grok-voice-transcribe-2.0',
                units: 'seconds from microphone session start',
                note: 'Speech recognition word timestamps only. Not musical beat positions, tempo, or instructions. Use only to clarify the transcript; never infer rhythm or change playback from these times.',
                words: transcriptionWords,
              },
            }
          : {}),
        musical_reading: editContext.text,
        current_config: current,
        recent_turns: recentTurns,
        context_note:
          'Current config is the actual player state. Interpret follow-up requests such as faster or slower against that state and recent turns. Turns with applied=false were not executed.',
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
  if (prepared.explicitMode) selected.loopMode = prepared.explicitMode;
  else if (prepared.instrumentEdit && lanes.some(lane => selected[lane] !== 'keep'))
    selected.loopMode = 'on';

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
  if (prepared.editContext.issue) return { call: null, message: prepared.editContext.issue };
  if (prepared.editContext.targeted.length) {
    if (prepared.explicitMode === 'off')
      return { call: null, message: 'Drum placements need drum mode. The beat is unchanged.' };
    if (prepared.editContext.targeted.some(lane => selected[lane] === 'keep'))
      return {
        call: null,
        message:
          'Couldn’t resolve that drum edit. The beat is unchanged. Try naming the hit and its destination.',
      };
    // Mode and grid are prerequisites of an accepted edit, not separate requests.
    selected.loopMode = 'on';
    for (const lane of lanes)
      if (!prepared.editContext.targeted.includes(lane)) selected[lane] = 'keep';
  }
  // API/voice automation must not override the user's existing mode for ordinary edits.
  if (!prepared.explicitMode && current.loopMode) selected.loopMode = 'on';
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
    // A positional edit does not authorize the model to enlarge the grid arbitrarily.
    if (Object.keys(prepared.editContext.edits).length && !prepared.explicitGridChange) {
      c.subDivs = current.subDivs;
      c.playSubDivs = current.playSubDivs;
    }
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
  if (!prepared.explicitMode) {
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
    message: prepared.editContext.targeted.length
      ? prepared.editContext.targeted
          .map(
            lane =>
              `${lane[0].toUpperCase() + lane.slice(1)}: ${positions[lane].length ? positions[lane].map(positionLabel).join(', ') : 'no hits'}`,
          )
          .join(' · ')
      : `${c.bpm} BPM · ${c.beats} beats · ${c.swing}% swing`,
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
    const countOff = estimateCountOff(body.prompt, transcriptionWords);
    if (countOff)
      return Response.json(
        {
          interpreterVersion: 3,
          prompt: body.prompt,
          call: null,
          message:
            countOff.bpm === null
              ? 'Count-off heard; timing is not clear enough to estimate tempo.'
              : `Count-off estimate: ${countOff.bpm} BPM`,
          countOff,
          confidence: countOff.confidence,
          confidenceMethod: countOff.confidenceMethod,
          references: [],
          timing: { totalMs: Date.now() - start },
        },
        { headers },
      );
    if (!env.OPENROUTER_API_KEY)
      return Response.json(
        { error: 'Voice interpretation is not configured.' },
        { status: 503, headers },
      );
    const prepared = prepare(
      body.prompt,
      current.data,
      recentTurns.map(({ prompt, applied }) => ({ prompt, applied })),
      alternatives,
      transcriptionWords?.map(({ text, start, end }) => ({ text, start, end })),
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
    let output = assemble(prepared, result.answers, current.data);
    const songAnswer = result.answers.songQuery;
    if (
      result.answers.action.choice === 'play' &&
      result.answers.action.confidence > 0.5 &&
      songAnswer.choice !== 'keep' &&
      songAnswer.confidence > 0.5 &&
      !result.answers.tempo.choice.startsWith('n:')
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
        interpreterVersion: 3,
        countOff: null,
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
