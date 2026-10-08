# Bipium agent instructions

Bipium is primarily a metronome. Voice control and the drum grid serve that; custom drum
mode is for small adjustments when someone asks for specific drum parts, never the default.

## The core rule: Jev interprets, code executes

Language is understood by Jev (Typesafe's decision model), never by our code. Code does
mechanics only: validation, transport, state, arithmetic, grid math, signal processing, and
executing what Jev chose.

- No keyword lists, phrase matching, regexes or grammars over the transcript, number-word
  parsers, transcript rewrites, or wording-based overrides, unless the user approved that
  exact behavior (see the register below).
- No silent local fallback when Jev is unsure or unavailable. Say so and keep the current
  state.
- If something fails on a particular phrase, fix it generally: the questions, the shared
  state, the option wording or the context. Never add a rule for that phrase.

### Getting approval for an exception

Before building any hardcoded interpretation, describe the exact behavior and ask. Once
the user approves, record it below (behavior, scope, their words, limits) before
implementing. No record means no permission; an earlier exception or old code is not
permission. Surface unrecorded heuristics you find rather than keeping them quietly.

## Designing Jev questions (what has worked)

Jev answers multiple-choice questions (`choice`; max 255 options), each with a
probability per option and a confidence. It can't return free text or numbers. An answer
is acted on only above 0.5 confidence; otherwise that setting stays as it is.

- **Keep option lists small and meaningful.** One option per possible value (e.g. every
  BPM) is slow, costly and less accurate.
- **Separate exact numbers from categories.** Ask a mode (`keep | exact | faster | slow…`)
  and, for exact values, one question per digit. Report values the player can't do
  (340 BPM) instead of clamping them.
- **Questions in one request are answered independently.** Each must be answerable from
  the shared state alone; never refer to another question's answer. If two questions
  must agree, restructure (e.g. split "remove" from "add").
- **Describe options by what they change.** "Remove snare on 2, add snare on & of 2"
  beats "snare on & of 2".
- **Don't put the answer's consequence where it can anchor.** Count-in candidates showed
  BPMs and Jev drifted towards the tempo already playing; describe the evidence instead
  and let code do the arithmetic.
- **Give Jev what happened, not just what was said.** Recent turns carry each turn's
  outcome ("added snare on & of 3").
- **Keep shared guidance short and general.** Retrieval (`context.mjs`) supplies
  terminology and reference grooves; avoid essays and rules written for one failure.
- One main request per phrase; a second (drum) request only when Jev routes to a
  drum edit (user, 2026-09-29: "ok let's try this"; no transcript matching).

## Voice pipeline map

- `server/voice.mjs`: `/api/voice`. Validates input, runs the requests, returns a
  `setConfig` patch of only what changes (or stop/clear/reset/null).
- `server/voice/main.mjs`: the main request (action, mode, style, clicker settings).
- `server/voice/drums.mjs`: drum edits; per lane, a whole-lane question plus remove/add
  questions per beat over the actual grid (or the chosen style's pattern).
- `server/voice/count-in.mjs` + `rhythm.mjs`: count-in timing (see the register).
- `server/voice/context.mjs`, `embed.mjs`, `embeddings.json`: RAG. The phrase is embedded
  (OpenRouter) and the most similar styles, grooves and glossary terms go into the prompt
  as examples; the similar styles are the style question's options. Similarity only, no
  hand-picked or always-offered entries. `glossary.json`, `styles.json` are the sources
  (`scripts/build-styles.mjs`, then `scripts/build-embeddings.mjs`).
- `src/lib/onsets.ts`, `rhythm-tracker.ts`, `rhythm-worker.ts`: browser-side onset
  detection, music evidence (held notes, sharp percussion) and live rhythm tracking from
  the mic. Music evidence keeps rhythm tracking going through speech (singing over a
  guitar, clapping while talking) and reaches Jev as `heard_music` context, so Jev can
  treat lyrics as unrelated. That's context for Jev, not a rule.
- `src/lib/tuner.ts`, `tuner-store.ts`, `src/components/TunerPopup.tsx`: the guitar tuner
  (see the register); also `window.bpm.startTuner()` and the WebMCP tuner tools.

## Testing

- Unit tests stub Jev; they check mechanics (arithmetic, grids, limits, that wording can't
  bypass Jev), not understanding. Never tune them, or the code, to make a phrase pass.
- `node scripts/voice-eval.mjs` measures live interpretation against `pnpm dev`. A miss
  is evidence about the questions or context. Don't encode a disputed reading as the
  only right answer.
- Local dev: `TYPESAFE_API_KEY` in `.env.local`; `pnpm dev` serves `/api/voice` and
  proxies speech recognition to the production relay. Jev's answers log to the console.

## Approved exceptions register

- **Numeric context (2026-09-29).** The user asked that Jev weigh "the last thing said"
  and "a normal range for that thing", with context-free plain numbers likely BPM, and
  answered "Use only the existing 20–320 supported range". This is general model
  guidance in `server/voice/main.mjs`, not a parser: Jev weighs units, recent topic,
  player state and plausibility. "340" right after "320" probably still means BPM.
  Ranges never veto meaning; unsupported values are reported, not redirected. Not
  approved: a 40–240 typical range, per-property thresholds, number parsers, numeric
  routing. "Eighths" is a subdivision request for Jev to interpret, not a keyword rule.
- **Count-in timing (2026-10-03).** Jev alone decides that an utterance is a count-in
  ("jev identifies it as a likely count in from the words - it's out of it after that").
  Jev also reads how the count divides the beat (`countFeel`: "1 trip-let" is three per
  beat); when it's confident, timing is fitted within that division. Timing then comes from a converging hypothesis process (`count-in.mjs`, `rhythm.mjs`)
  over word timings and browser audio onsets. Approved: "numbers are ok to identify is
  countins for specific clustering and weighting reasons, NOT for parsing directly and
  'deciding' the beat or IF it's a count in", and for beats per bar, "one COULD get extra
  weight towards the measure" ("yes"). Words only set soft weights (numerals lean to
  beats, repeated syllables to subdivisions, a recurring "one" to bar starts); number
  values never place beats. Swing only when clearly supported. Not approved: deciding
  whether something is a count-in, hard rules on which words are beats or bars, use
  outside count-in timing. (The old count-off grammar was revoked 2026-09-29.)
- **Heard rhythm (2026-10-03).** Rhythm heard with no speech (claps, an instrument) may set
  tempo/subdivisions/swing when the estimate is confident and has held steady. User:
  "play if high enough confidence", revised to "don't play auto, show it but don't auto
  start it"; a spoken confirmation step was rejected. Then (2026-10-06) "how about very
  high confidence claps or snaps", meaning "confident ... that they ARE claps, not that
  they're perfect rhythm": when nearly all hits in the analyzed stretch are sharp (claps
  or snaps; measured share) with no held notes, a reported tempo starts playing at once.
  It does not count as playing along (2026-10-07, after voice commands were ignored once
  claps started it: "I clapped ... and THEN i talked and it ignored me"); every voice
  command still works. Anything else (an instrument, singing, unsure) never
  starts playback; saying "play" or pressing Start does. Rhythm isn't detected at all while the metronome plays ("don't detect
  instrument while it's playing"). When one is reported, the status says "Hearing …"
  and to say "start" or press Start. Before that, every sharp hit (clap, snap, drum)
  pulses the voice button and a few evenly spaced show "Hearing a rhythm… keep going" (user:
  "it would also be nice if it showed SOMETHING"; chose pulse + text), replacing an older
  reply but not one in progress or a tempo already shown.
  `?voicedebug` in the URL adds a diagnostics line, only while it's in the URL.
- **Instrument over stray words (2026-10-03).** The transcriber sometimes turns an
  instrument into words ("Mm"). User: "if it's low confidence probably better to make sure
  that's ignored if the instrument prob is super high". A steady rhythm held across two
  consecutive analyses (only while the metronome is stopped) counts as music for 4 s: transcribed words
  don't pause rhythm tracking (the stricter over-speech bar applies), phrases reach Jev
  with `heard_music`, and over music a phrase Jev finds unrelated or can't place is
  dropped silently. Jev still decides what every phrase means; clear requests still act.
  While the metronome plays, phrases are never flagged as music: its own clicks read as
  percussion and made commands like "stop" look like lyrics (user: "I stopped playing
  and said stop and it recognized it but didn't act").
- **Playing along (2026-10-03).** Once the metronome is started while a tempo heard
  from the user's playing is showing (Start badge, "start", or the Start button), only
  a spoken stop acts until it stops. User: "if it's activated due to instrument
  detection, then you're only allowed to stop ... if you say stop, it should stop. But if
  you sing stop, it shouldn't. [Don't] hard code stuff". Jev still decides that a phrase
  means stop; code allows only that action. "Sung" is measured from audio (held,
  pitched notes over the phrase's own words), never from the words. Everything else is
  ignored silently while playing along.
  More generally, while the metronome plays (however it was started), a sung phrase is
  never read as words: it's dropped before Jev ("when you're playing, your singing should
  not be interpreted as words"). With the metronome stopped, singing still counts as
  music evidence for rhythm tracking.
- **Guitar tuner (2026-10-06, prototype).** In voice mode, open strings ringing (any
  number of them) pop up a six-string tuner that shows whichever strings are ringing ("can
  we just show tuners for whatever strings are playing currently?"). User: "if you play
  ALL [six] strings (strummed) it would detect that sound and pop up some kind of
  [six]-way tuner ... OR with a single guitar string", "If you started *playing* guitar I
  wouldn't want to popup", and "it should tune as close to what you have, and maybe ALSO
  indicate that the whole thing is off, but it should use relative pitch". Audio only:
  when nearly all strings ring they're fitted against a table of common tunings (a single
  string from another tuning moves to the first tuning in the table with a string there,
  shown as a guess until a strum confirms it); strings are read against the guitar's own
  median offset once three or more have been heard, together or one at a time, and that
  offset is shown against A440. Steady room sound (hum, rumble) is learned and ignored. It
  opens only for strings that fade like plucks, and any strong pitch that isn't a ringing
  open string (chords, fretted notes) means nothing is shown: spectral checks, not rules
  about playing. Like rhythm, it never listens while the metronome plays; while it shows,
  rhythm isn't tracked. The API and WebMCP can also open it on request (`startTuner`, "add
  mcp/webmcp/api/docs"), with a mic of its own when voice mode is off. Not approved:
  reading tuning from words, or detecting tuning while playing along (discussed as a later
  step).
- **Audio-only percussion analysis.** "instrument is fine" / "ok, no jev then":
  PCM onset detection and timing estimation (`server/percussion.mjs` on the relay; now
  superseded in the app by the browser tracker). No transcript parsing.
- **Whole-BPM estimates (2026-09-29).** "don't sent fractional beats unless specifically
  requested, especially with count offs / percussion": estimated tempos round to whole
  BPM. Explicit values the user states are kept as given.

## Product rules

- A named style plays as a regular metronome on drum-kit sounds; drum mode only when a
  drum loop or specific kick/snare/hat parts are asked for.
- Leaving the regular metronome for drum mode needs a sure answer from Jev (0.9, not the
  usual 0.5); otherwise the phrase isn't acted on. User, 2026-10-03: "try not to go into
  drum mode unless it absolutely has to". Already in drum mode, the usual bar applies.
- Voice mode must not change playback volume or apply any gain; no ducking or boosting.
  Mic capture requests automatic gain control, noise suppression and echo cancellation
  off (noise suppression keeps only voice and erases the instruments rhythm tracking
  listens for; on iPhone, echo cancellation puts playback through call processing, louder
  and crackling on the drum kit). With the mic on, iOS keeps its own volume level, set
  with the volume buttons; that's the system's, not ours.

## The shared Pixi visualizer (do not regress)

- Classic and machine both use `src/components/DefaultVisualizer.tsx`. Don't fork its
  rendering, animation or lifecycle per theme; theme differences are presentation props.
- Keep the Pixi green now-line, timing and rendering as they are. Don't move the line out
  of Pixi or redesign the visualizer without explicit approval.
- Keep the Pixi Application/canvas alive across beat, subdivision, swing, pattern, mode
  and size updates. Never key the Application on the grid. Resize the existing renderer
  and apply the latest size after async initialization.
- Keep the explicit grid and now-line redraws after size/grid updates (physical-device
  fixes `b841edc`, `c393021`).
- Run `VisualizerLifecycle.test.tsx` after visualizer or lifecycle changes and check both
  themes. Desktop responsive mode and Chrome emulation don't reproduce the iPhone issue;
  never claim physical-device success without testing on a device.

## Delivery

- No pull requests. Push authorized, completed work directly to master and deploy.
- Preserve unrelated local changes; use the existing worktree.
- Check both classic and machine themes for UI changes.
- On this machine plain `cat` may colorize; use `sed -n` or `/bin/cat` to read files.
