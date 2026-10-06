// POST /api/voice: interpret one spoken phrase and return a player call.
//   1. Main request (always): routes the phrase and answers every clicker setting.
//   2. Drum request (only for drum edits): what each lane plays in each beat.
// The server only validates, does arithmetic and builds the config patch; Jev decides.
import { createSchemas, fitDrumLoopGrid, mergeConfig } from '../src/core/api.ts';
import { askJev } from './voice/jev.mjs';
import { buildMainRequest, readMainAnswers } from './voice/main.mjs';
import { buildDrumRequest, readDrumAnswers } from './voice/drums.mjs';
import { describeGridChanges, positionsOf, stylePositions } from './voice/grid.mjs';
import { estimateCountIn } from './voice/count-in.mjs';
import { retrieve } from './voice/context.mjs';

const schemas = createSchemas(new Set(['drumkit', 'defaults']));
const headers = { 'Cache-Control': 'no-store' };
const fail = (error, status = 400) => Response.json({ error }, { status, headers });

function readBody(body) {
  const current = schemas.config.safeParse(body.currentConfig);
  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 1000)
    return { error: 'Please use a short beat description.' };
  if (!current.success) return { error: 'Invalid current configuration' };
  const alternatives = body.alternatives ?? [];
  if (
    !Array.isArray(alternatives) ||
    alternatives.length > 2 ||
    alternatives.some(a => typeof a !== 'string' || a.length > 1000)
  )
    return { error: 'Invalid recognition alternatives' };
  const words = body.transcriptionWords;
  if (
    words !== undefined &&
    (!Array.isArray(words) ||
      words.length > 80 ||
      words.some(
        w =>
          !w ||
          typeof w.text !== 'string' ||
          w.text.length > 100 ||
          !Number.isFinite(w.start) ||
          w.start < 0,
      ))
  )
    return { error: 'Invalid transcription timing' };
  const onsets = body.onsets ?? [];
  if (
    !Array.isArray(onsets) ||
    onsets.length > 400 ||
    onsets.some(o => !o || !Number.isFinite(o.time) || o.time < 0)
  )
    return { error: 'Invalid audio onsets' };
  const music = body.music;
  if (music !== undefined && !(Number.isFinite(music) && music >= 0 && music <= 1))
    return { error: 'Invalid music evidence' };
  const sung = body.sung ?? 0;
  if (!(Number.isFinite(sung) && sung >= 0 && sung <= 1))
    return { error: 'Invalid singing evidence' };
  if (body.playAlong !== undefined && typeof body.playAlong !== 'boolean')
    return { error: 'Invalid play-along state' };
  if (body.playing !== undefined && typeof body.playing !== 'boolean')
    return { error: 'Invalid playback state' };
  const recentTurns = body.recentTurns ?? [];
  if (
    !Array.isArray(recentTurns) ||
    recentTurns.length > 6 ||
    recentTurns.some(
      t =>
        !t ||
        typeof t.prompt !== 'string' ||
        t.prompt.length > 1000 ||
        typeof t.applied !== 'boolean' ||
        (t.outcome !== undefined && (typeof t.outcome !== 'string' || t.outcome.length > 500)),
    )
  )
    return { error: 'Invalid voice context' };
  return {
    prompt: body.prompt.trim(),
    current: current.data,
    alternatives,
    words: words?.map(({ text, start }) => ({ text, start })),
    onsets: onsets.map(({ time, strength, level }) => ({ time, strength, level })),
    music: music ?? 0,
    sung,
    playAlong: body.playAlong === true,
    playing: body.playing === true,
    // What each turn did, not just what was said, so "undo that" or "the last snare
    // you added" can be resolved.
    recentTurns: recentTurns.map(({ prompt, applied, outcome }) => ({
      said: prompt,
      applied,
      ...(outcome ? { result: outcome } : {}),
    })),
    debug: body.debug === true,
  };
}

const SIMPLE = {
  stop: { call: { method: 'stop', args: [] }, message: 'Stopped.' },
  stopListening: { call: null, listening: 'stop', message: 'Listening stopped.' },
  clear: { call: { method: 'clearLoopPattern', args: [] }, message: 'Drum grid cleared.' },
  reset: { call: { method: 'resetToDefaults', args: [] }, message: 'Reset to defaults.' },
  unrelated: { call: null, message: 'Try describing a beat or changing its tempo.' },
  unsupported: { call: null, message: 'The player can’t do that. Kept the current beat.' },
};

function summarize(patch, style) {
  const parts = [];
  if (style) parts.push(style.name);
  if ('bpm' in patch) parts.push(`${patch.bpm} BPM`);
  if ('beats' in patch) parts.push(`${patch.beats} beats`);
  if ('subDivs' in patch && patch.playSubDivs !== false) parts.push(`${patch.subDivs} per beat`);
  if (patch.playSubDivs === false) parts.push('subdivisions off');
  if ('swing' in patch) parts.push(patch.swing ? `${patch.swing}% swing` : 'straight');
  if ('volume' in patch) parts.push(`volume ${patch.volume}`);
  if ('loopRepeats' in patch)
    parts.push(patch.loopRepeats ? `${patch.loopRepeats} bars` : 'repeat forever');
  if ('soundPack' in patch) parts.push(patch.soundPack === 'drumkit' ? 'drum kit sounds' : 'beeps');
  if ('loopMode' in patch) parts.push(patch.loopMode ? 'custom drum mode' : 'regular metronome');
  return parts.join(' · ');
}

// Share of a phrase's audio in held, pitched notes above which it was sung, not spoken.
const SUNG = 0.5;

async function interpret(input, env, signal) {
  const { prompt, current, alternatives, words, recentTurns, music } = input;
  const trace = {};
  const query = [
    ...recentTurns
      .filter(t => t.applied)
      .slice(-2)
      .map(t => t.said),
    prompt,
  ].join(' ');
  // While the metronome plays, singing is never read as words (not even sent to Jev).
  if (input.playing && input.sung >= SUNG) return { output: { call: null, message: '' }, trace };

  const { context, styleNames } = await retrieve(env, query, signal);

  const timed = (words?.length ?? 0) >= 3;
  const main = buildMainRequest({
    prompt,
    current,
    recentTurns,
    alternatives,
    timed,
    music,
    context,
    styleNames,
  });
  const mainResult = await askJev(env, main, signal);
  trace.main = { request: main, answers: mainResult.answers, usage: mainResult.usage };
  const plan = readMainAnswers(mainResult.answers, current);

  // Playing along to a tempo heard from the user's instrument: stop is the only thing
  // voice acts on, so playing and lyrics can't keep changing the beat, and a stop that
  // was sung (the phrase's own audio held pitched notes) is a lyric, not a command.
  if (input.playAlong && (plan.action !== 'stop' || input.sung >= SUNG))
    return { output: { call: null, message: '' }, trace };

  // Over music, words Jev finds unrelated or can't place are likely lyrics or the
  // instrument itself: not worth a reply; keep whatever the status line shows.
  if ((!plan.action || plan.action === 'unrelated') && music >= 0.5)
    return { output: { call: null, message: '' }, trace };
  if (!plan.action)
    return {
      output: { call: null, message: 'I didn’t catch that. Kept the current beat.' },
      trace,
    };
  if (SIMPLE[plan.action]) return { output: SIMPLE[plan.action], trace };
  if (plan.action === 'countOff') {
    // Jev decided this is a count-in; the timing is measured, not interpreted.
    const countIn = estimateCountIn({
      words,
      onsets: input.onsets,
      subdivisions: plan.countSubdivisions,
    });
    trace.countIn = countIn;
    if (!countIn || countIn.confidence <= 0.5)
      return {
        output: { call: null, countIn, message: '[count-in] I couldn’t time that count-in.' },
        trace,
      };
    const patch = { bpm: countIn.bpm };
    // The count sets the feel: counted subdivisions turn them on, a plain beat count
    // turns them off, so an earlier setting can't linger under a new count.
    if (countIn.subdivisionConfidence >= 0.8) {
      if (countIn.subdivisions > 1) {
        patch.subDivs = countIn.subdivisions;
        patch.playSubDivs = true;
        patch.swing = countIn.swing;
      } else if (current.playSubDivs && current.subDivs > 1) patch.playSubDivs = false;
    }
    // Beats per bar only when the count clearly repeated a bar.
    if (countIn.beats) patch.beats = countIn.beats;
    const parts = [`[count-in] ${patch.bpm} BPM`];
    if (patch.beats) parts.push(`${patch.beats} beats`);
    if (patch.subDivs) parts.push(`${patch.subDivs} per beat`);
    if (patch.swing) parts.push(`${patch.swing}% swing`);
    return {
      output: {
        call: { method: 'setConfig', args: [patch] },
        playback: 'start',
        countIn,
        message: parts.join(' · '),
      },
      trace,
    };
  }

  const { patch, style, problems } = plan;
  // Settings first, so grid edits are made on the bar they'll play in.
  let next = mergeConfig(current, patch, schemas);
  let positions = null;
  if (plan.action === 'drumEdit') {
    const base = style ? stylePositions(style, next.beats) : positionsOf(next);
    const drums = buildDrumRequest({
      prompt,
      recentTurns,
      alternatives,
      config: next,
      base,
      style,
      // Hit edits work on the grid itself (or the chosen style's pattern): other styles'
      // patterns are noise there, so only the terminology goes along.
      context: { terminology: context.terminology },
    });
    const drumResult = await askJev(env, drums.request, signal);
    trace.drums = { request: drums.request, answers: drumResult.answers, usage: drumResult.usage };
    positions = readDrumAnswers(drumResult.answers, drums.slots, base, next.beats);
  } else if (style && next.loopMode) {
    positions = stylePositions(style, next.beats);
  } else if (style && !('subDivs' in patch) && !('playSubDivs' in patch)) {
    // On the regular metronome a style keeps its feel: the subdivisions its pattern uses.
    const plain = { beats: next.beats, subDivs: 1, playSubDivs: false };
    const { subDivs } = fitDrumLoopGrid(plain, stylePositions(style, next.beats));
    Object.assign(patch, { subDivs, playSubDivs: subDivs > 1 });
    next = mergeConfig(current, patch, schemas);
  }
  if (positions) {
    try {
      Object.assign(patch, fitDrumLoopGrid(next, positions));
    } catch (error) {
      return { output: { call: null, message: `${error.message} Kept the current beat.` }, trace };
    }
    next = mergeConfig(current, patch, schemas);
  }

  // Report and send only what actually changes.
  for (const key of Object.keys(patch))
    if (JSON.stringify(patch[key]) === JSON.stringify(current[key])) delete patch[key];
  const changed = Object.keys(patch).length > 0;
  if (!changed && problems.length)
    return { output: { call: null, message: problems.join(' ') }, trace };
  const { loopPattern, subDivs, playSubDivs, ...settings } = patch;
  const gridChanges = patch.loopPattern && !style ? describeGridChanges(current, next) : '';
  const summary = [summarize(patch.loopPattern && !style ? settings : patch, style), gridChanges];
  return {
    output: {
      call: { method: 'setConfig', args: [patch] },
      playback: 'start',
      message: [...summary.filter(Boolean), ...problems].join(' · ') || 'Playing.',
    },
    trace,
  };
}

async function handle(request, env) {
  if (request.method !== 'POST') return fail('Use POST', 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return fail('Origin not allowed', 403);
  if (!env.TYPESAFE_API_KEY) return fail('Voice interpretation is not configured.', 503);
  const raw = await request.text();
  if (raw.length > 20000) return fail('Request too large', 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail('Invalid JSON request');
  }
  const input = readBody(body);
  if (input.error) return fail(input.error);
  const started = Date.now();
  try {
    const { output, trace } = await interpret(input, env, request.signal);
    return Response.json(
      {
        prompt: input.prompt,
        ...output,
        ms: Date.now() - started,
        ...(input.debug ? { debug: trace } : {}),
      },
      { headers },
    );
  } catch (error) {
    if (error.name === 'TimeoutError') return fail('Jev took too long. Please try again.', 504);
    return fail(error.message || 'Could not interpret that phrase.', error.status ?? 422);
  }
}

// JSON by default; the voice UI asks for NDJSON so it can show progress.
export function voice(request, env) {
  if (!request.headers.get('Accept')?.includes('application/x-ndjson')) return handle(request, env);
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        const response = await handle(request, env);
        const result = await response.json();
        if (!request.signal.aborted)
          controller.enqueue(
            encoder.encode(
              JSON.stringify(
                response.ok ? { type: 'result', result } : { type: 'error', error: result.error },
              ) + '\n',
            ),
          );
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'application/x-ndjson', ...headers } },
  );
}
