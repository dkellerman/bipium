// The main request: one Jev call per utterance. It routes the utterance (action) and
// answers every clicker setting and the style at once. Each question is
// answerable from the shared state on its own.
import { choice, digits, picked, readDigits } from './jev.mjs';
import { describeGrid } from './grid.mjs';
import styles from './styles.json' with { type: 'json' };

export const BPM_RANGE = [20, 320];

export const styleKey = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
export const STYLES = Object.fromEntries(styles.map(s => [styleKey(s.name), s]));

const GUIDANCE = [
  'You control Bipium by voice. It is primarily a metronome; its custom drum mode is for small adjustments when the user asks for specific drum parts, never the default. Each question asks about one thing; answer it from the utterance, using the player state and recent utterances for context.',
  'Choose keep or none when the utterance does not ask to change that thing. Do not change settings as a side effect of an unrelated request.',
  'Recent utterances resolve follow-ups ("faster", "a bit more", "and on four too") but are not requests themselves.',
  'Speech recognition can mishear: "beat" may appear as "beep" and "and" as "end". Alternate transcripts are other guesses at the same speech.',
  'DIGITS: for an exact number the user said for a setting (as digits or words, even outside the supported range; a target value or an amount to change it by), the digit questions give each decimal place: 128 is hundreds 1, tens 2, ones 8; 95 is hundreds 0. Read spoken numbers as numbers first: "one thirty" and "a hundred thirty" are 130 (ones 0), "one oh five" is 105, "ninety" is 90. Answer none if no exact number was said for that setting; ignore numbers said for other settings.',
  'A number right next to a setting\'s name ("volume 60", "swing 30", "tempo 90") sets that setting. A bare number with no other context most likely means tempo in BPM. The player supports 20–320 BPM; a number outside that range still means what the user said.',
].join(' ');

const playerState = config => ({
  bpm: config.bpm,
  beats_per_bar: config.beats,
  subdivisions_per_beat: config.subDivs,
  subdivisions_audible: config.playSubDivs,
  swing_percent: config.swing,
  volume_percent: config.volume,
  mode: config.loopMode ? 'custom drum mode' : 'regular metronome',
  sounds: config.soundPack === 'drumkit' ? 'drum kit sounds' : 'beeps',
  repeat_bars: config.loopRepeats || 'forever',
  drum_grid: describeGrid(config),
});

const numberOptions = (from, to, describe) =>
  Object.fromEntries(
    Array.from({ length: to - from + 1 }, (_, i) => [String(from + i), describe(from + i)]),
  );

export function buildMainRequest({
  prompt,
  current,
  recentTurns,
  alternatives,
  timed,
  music = 0,
  context,
  styleNames = [],
}) {
  // The styles most similar to the phrase (see context.mjs); none are always offered.
  const offered = styleNames
    .map(name => STYLES[styleKey(name)])
    .filter(Boolean);
  // A count-in is only offered when there's word timing to measure it from.
  const hasCountOff = timed;
  const questions = {
    action: choice(
      music >= 0.5
        ? 'What does the user want the player to do? Music is being heard (state.heard_music): words not clearly addressed to the player are most likely lyrics or singing, so choose unrelated unless the request to the player is clear.'
        : 'What does the user want the player to do?',
      {
        play: 'Start or change the beat: tempo, meter or time signature, beats per bar, subdivisions, feel, volume, sounds, mode, a style or groove (naming one alone is enough), or just play',
        drumEdit:
          'Change specific drum hits: add, remove or move kick, snare or hat hits, including follow-ups such as "and on four too". Only for named drum hits; tempo, meter, time signature, beats or subdivisions are play, and this switches the player into custom drum mode',
        ...(hasCountOff
          ? {
              countOff:
                'The user performed a spoken count-in, counting beats or subdivisions aloud ("one, two, three, four", "one and two and", "one trip let two trip let", "one e and a two e and a"), to set the tempo. A count-in needs more than two numbers; two numbers alone, or a time signature named by its numbers ("three four"), are not a count-in',
            }
          : {}),
        stop: 'Stop or pause playback',
        stopListening: 'Stop listening to the microphone, leaving playback alone',
        clear: 'Clear all drum hits',
        reset: 'Reset everything to the defaults',
        unrelated: 'Not talking to the player (including singing or lyrics)',
        unsupported:
          'Asks for something this player cannot do, such as other instruments, tempo ramps, velocity or exporting audio',
      },
    ),
    mode: choice(
      'Should the player switch between regular mode and custom drum mode? Asking for a beat, groove, feel or style (a funk beat, a rock groove, bossa nova) is regular mode: choose keep. Choose drums only for an explicit drum loop, drum machine or custom drum pattern, or for specific kick, snare or hat placements.',
      {
        keep: 'Stay in the current mode; includes ordinary requests for a beat, groove or style',
        drums:
          'Custom drum mode: an explicit drum loop, drum machine or custom pattern, or specific kick/snare/hat placements',
        click:
          'Regular mode: the user explicitly asks to leave drum mode, or for a plain click or regular metronome',
      },
    ),
    style: choice(
      'Which drum style or genre does the user ask for as a new groove? Choose none when the user is changing particular hits or lanes of the current pattern, even if they use a style term to describe the change.',
      {
        none: 'No style or genre is asked for',
        ...Object.fromEntries(
          offered.map(s => [
            styleKey(s.name),
            s.tempo ? `${s.name} (around ${s.tempo} BPM)` : s.name,
          ]),
        ),
      },
    ),
    tempo: choice(
      'How should the tempo change? A number the user gives for another setting (volume, swing, beats, repeats) is not a tempo.',
      {
        keep: 'No tempo change',
        exact: 'To an exact BPM the user states as a number',
        style: 'To the typical tempo of the style the user asks for, when they give no tempo',
        slow: 'Slow',
        medium: 'Medium',
        fast: 'Fast',
        faster:
          'Faster than now, by the amount the user states if any ("5 BPM faster", "a bit faster")',
        slower:
          'Slower than now, by the amount the user states if any ("10 slower", "slow down a bit")',
        double: 'Double time',
        half: 'Half time',
      },
    ),
    ...digits('tempo', 'tempo in BPM, or number of BPM to change it by', 399),
    beats: choice(
      'How many beats per bar? A time signature, written or said as two numbers ("three four", "six eight"), gives the beats per bar as its first number; the second is the note value, not a beat count.',
      {
        keep: 'No change to beats per bar',
        ...numberOptions(1, 12, n =>
          n === 3 ? '3 beats per bar (also a waltz)' : `${n} beats per bar`,
        ),
      },
    ),
    subDivs: choice('How many subdivisions per beat?', {
      keep: 'No change to subdivisions',
      1: 'None: quarter notes only',
      2: 'Eighth notes (2 per beat)',
      3: 'Triplets (3 per beat)',
      4: 'Sixteenth notes (4 per beat)',
      5: 'Quintuplets (5 per beat)',
      6: 'Sextuplets (6 per beat)',
      7: 'Septuplets (7 per beat)',
      8: 'Thirty-second notes (8 per beat)',
    }),
    // How a count-in divides the beat is read from the words by Jev; timing is measured.
    ...(hasCountOff
      ? {
          countFeel: choice(
            'If the utterance is a spoken count-in, how does the count divide each beat? Count the syllables said between one beat number and the next.',
            {
              none: 'Not a count-in, or the division is unclear',
              1: 'Beats only: no syllables between the numbers',
              2: 'Two per beat, one syllable between numbers (eighth notes: 1 & 2 &)',
              3: 'Three per beat, two syllables between numbers (triplets: 1 trip-let 2 trip-let)',
              4: 'Four per beat, three syllables between numbers (sixteenth notes: 1 e & a 2 e & a, the a said "uh")',
            },
          ),
        }
      : {}),
    playSubDivs: choice('Should subdivision clicks be audible?', {
      keep: 'No change',
      on: 'Play the subdivisions',
      off: 'Only the main beats; silence the subdivisions',
    }),
    swing: choice('How should the swing change?', {
      keep: 'No swing change',
      exact: 'To an exact swing amount (0–100) the user states, with or without "percent"',
      straight: 'Straight, no swing',
      light: 'A little swing',
      medium: 'Swing or shuffle',
      heavy: 'Heavy swing',
      more: 'More swing than now, by the amount the user states if any ("20 more swing")',
      less: 'Less swing than now, by the amount the user states if any ("a little less swing")',
    }),
    ...digits('swing', 'swing amount (0–100), or amount to change it by', 100),
    volume: choice('How should the volume (loudness) change?', {
      keep: 'No volume change',
      exact: 'To an exact volume level (0–100) the user states, with or without "percent"',
      quieter: 'Quieter, by the amount the user states if any ("10% quieter")',
      louder: 'Louder, by the amount the user states if any ("volume up 20")',
      mute: 'Mute',
    }),
    ...digits('volume', 'volume level (0–100), or amount to change it by', 100),
    repeats: choice('How many bars should play before stopping?', {
      keep: 'No change',
      exact: 'An exact number of bars or repeats the user states',
      forever: 'Play forever',
    }),
    ...digits('repeats', 'number of bars or repeats', 128),
    sounds: choice('Which sounds should play?', {
      keep: 'No change',
      beeps: 'Electronic beeps or classic metronome clicks',
      drumkit: 'Acoustic drum kit sounds (in either mode)',
    }),
  };
  return {
    state: {
      utterance: prompt,
      alternate_transcripts: alternatives,
      recent_utterances: recentTurns,
      player: playerState(current),
      guidance: GUIDANCE,
      // Measured from the audio, not the words: singing or playing around the phrase.
      ...(music >= 0.5
        ? {
            heard_music:
              'The microphone is picking up music around this phrase (singing, an instrument or percussion). The words may be lyrics or singing rather than a request to the player.',
          }
        : {}),
      ...context,
    },
    questions,
  };
}

// Modes that move a setting up or down: by the amount the user stated (the digit
// answers), or by a default step when no number was stated.
const STEP = { faster: 1, slower: -1, more: 1, less: -1, louder: 1, quieter: -1 };
const DEFAULT_STEP = 10;

/**
 * The value a stated number gives: the number itself (`exact`), or `current` moved by it
 * (a STEP mode; with no number stated, by DEFAULT_STEP kept within `range`).
 */
const exactOr = (answers, key, setting, current, range = [-Infinity, Infinity]) => {
  if (setting !== 'exact' && !STEP[setting]) return { value: undefined };
  if (STEP[setting] && picked(answers[`${key}_ones`]) === 'none') {
    const stepped = current + STEP[setting] * DEFAULT_STEP;
    return { value: Math.min(range[1], Math.max(range[0], stepped)) };
  }
  const value = readDigits(answers, key);
  if (value === null) return { unclear: true };
  return { value: STEP[setting] ? current + STEP[setting] * value : value };
};

/** A number was clearly stated for a setting whose kind of change Jev couldn't settle. */
const numberWithoutChange = (answers, key, setting) =>
  !setting && answers[`${key}_ones`] !== undefined && readDigits(answers, key) !== null;

/**
 * Turn main answers into a plan: the action plus a config patch of what changed.
 * Values the user stated that the player can't do come back as `problem`.
 */
/** Confidence needed to switch from the regular metronome into custom drum mode. */
const DRUM_MODE_SURE = 0.9;

export function readMainAnswers(answers, current) {
  let action = picked(answers.action);
  // Drum mode is a last resort: leaving the regular metronome for it takes a sure answer.
  if (action === 'drumEdit' && !current.loopMode && !(answers.action.confidence >= DRUM_MODE_SURE))
    action = null;
  const plan = { action, patch: {}, problems: [] };
  if (action === 'countOff') {
    const feel = picked(answers.countFeel);
    plan.countSubdivisions = feel && feel !== 'none' ? Number(feel) : null;
  }
  if (action !== 'play' && action !== 'drumEdit') return plan;
  const { patch, problems } = plan;
  const style = STYLES[picked(answers.style)];
  plan.style = style;

  const tempo = picked(answers.tempo);
  if (numberWithoutChange(answers, 'tempo', tempo))
    problems.push('I didn’t catch how to change the tempo.');
  const exactTempo = exactOr(answers, 'tempo', tempo, current.bpm);
  const bpm =
    exactTempo.value ??
    {
      style: style?.tempo,
      slow: 70,
      medium: 100,
      fast: 150,
      double: current.bpm * 2,
      half: Math.round(current.bpm / 2),
    }[tempo];
  if (exactTempo.unclear) problems.push('I didn’t catch the exact tempo.');
  else if (bpm !== undefined) {
    if (bpm < BPM_RANGE[0] || bpm > BPM_RANGE[1])
      problems.push(
        `${bpm} BPM is outside the supported ${BPM_RANGE[0]}–${BPM_RANGE[1]} BPM range.`,
      );
    else if (bpm !== current.bpm) patch.bpm = bpm;
  }

  const beats = picked(answers.beats);
  if (beats && beats !== 'keep') patch.beats = Number(beats);
  else if (style && style.beats !== current.beats) patch.beats = style.beats;

  const subDivs = picked(answers.subDivs);
  const audible = picked(answers.playSubDivs);
  if (subDivs && subDivs !== 'keep') {
    patch.subDivs = Number(subDivs);
    // Asking for subdivisions means wanting to hear them, unless told otherwise.
    patch.playSubDivs = audible !== 'off';
  } else if (audible === 'on' || audible === 'off') patch.playSubDivs = audible === 'on';

  const swing = picked(answers.swing);
  if (numberWithoutChange(answers, 'swing', swing))
    problems.push('I didn’t catch how to change the swing.');
  const exactSwing = exactOr(answers, 'swing', swing, current.swing, [0, 100]);
  const swingValue =
    exactSwing.value ??
    {
      straight: 0,
      light: 15,
      medium: 33,
      heavy: 50,
    }[swing];
  if (exactSwing.unclear) problems.push('I didn’t catch the exact swing amount.');
  else if (swingValue !== undefined) {
    if (swingValue > 100) problems.push(`Swing goes up to 100%, not ${swingValue}%.`);
    else if (swingValue < 0) problems.push(`Swing can't go below 0%.`);
    else patch.swing = swingValue;
  }

  const volume = picked(answers.volume);
  if (numberWithoutChange(answers, 'volume', volume))
    problems.push('I didn’t catch how to change the volume.');
  const exactVolume = exactOr(answers, 'volume', volume, current.volume, [0, 100]);
  const volumeValue =
    exactVolume.value ??
    {
      mute: 0,
    }[volume];
  if (exactVolume.unclear) problems.push('I didn’t catch the exact volume.');
  else if (volumeValue !== undefined) {
    if (volumeValue > 100) problems.push(`Volume goes up to 100%, not ${volumeValue}%.`);
    else if (volumeValue < 0) problems.push(`Volume can't go below 0%.`);
    else patch.volume = volumeValue;
  }

  const repeats = picked(answers.repeats);
  const exactRepeats = exactOr(answers, 'repeats', repeats);
  const repeatsValue = repeats === 'forever' ? 0 : exactRepeats.value;
  if (exactRepeats.unclear) problems.push('I didn’t catch how many bars.');
  else if (repeatsValue !== undefined) {
    if (repeatsValue > 128) problems.push(`Repeats go up to 128 bars, not ${repeatsValue}.`);
    else patch.loopRepeats = repeatsValue;
  }

  // A style sounds best on the drum kit, unless the user asks for beeps.
  const sounds = picked(answers.sounds);
  if (sounds === 'beeps') patch.soundPack = 'defaults';
  else if (sounds === 'drumkit' || style) patch.soundPack = 'drumkit';

  // Mode: regular metronome unless drums are asked for. Drum edits and explicit
  // requests switch to drum mode; a style alone keeps the current mode.
  const mode = picked(answers.mode);
  const drumsSure = current.loopMode || answers.mode?.confidence >= DRUM_MODE_SURE;
  if (action === 'drumEdit' || (mode === 'drums' && drumsSure)) patch.loopMode = true;
  else if (mode === 'click') patch.loopMode = false;

  return plan;
}
