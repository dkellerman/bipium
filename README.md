# Bipium

A metronome web app. https://bipium.com

## Features

- BPM slider, or type it in (allows fractional beats)
- Play sub-divisions if desired
- Swing!
- Tap tempo
- Tap along, shows feedback for early/late clicks
- Visualization vaguely imitates a piano roll
- Drum loop mode with editable kick / hat / snare steps
- Loop playback can run forever or stop after a chosen number of cycles
- Mobile-first layout
- On desktop (wide window, mouse, no touchscreen) the player is shown at phone width (460px) inside a phone-shaped bezel; `?noframe` turns it off
- Configurable sounds
- Set volume
- Values are stored in the session for stickiness through refreshes
- All parameters configurable via URL, you can copy a link to the clipboard
- Browser runtime API at `window.bpm`, including loop mode and loop pattern controls
- Runtime API can override individual `bar` / `beat` / `half` / `subDiv` / `user` sounds by URL

## Tech

- React, Typescript, Tailwind, Shadcn
- PIXI.js for visualizer, to allow GPU rendering
- Metronome implementation inspired by https://github.com/cwilso/metronome
- Vite for app and core distribution builds, deployed to GPT Sites
- microsecond time syncing via AudioContext

The `src/core` directory contains an app-independent metronome implementation with no library dependencies.

## Experimental GPT Sites copy

This branch preserves the current classic and machine interfaces, `window.bpm`,
all 18 native WebMCP tools, URL configuration, and the standalone core library.
The Listen control uses browser speech recognition. The previous
OpenAI request flow and Vercel model endpoint are removed. No reCAPTCHA or app login
is present; the original Vercel deployment is separate.

- `pnpm dev` serves the client. For full local voice requests, build and run the Worker.
- `pnpm build` builds the client and the Sites Worker.
- `pnpm test`, `pnpm typecheck`, and `pnpm test:server` verify controls, API, and routing.
- Production analytics is not loaded in this experimental copy.

### Voice and Jev

`POST /api/voice` takes `{ prompt, currentConfig, recentTurns, alternatives?, transcriptionWords? }`
and returns `{ call, playback?, message }`, where `call` is a `setConfig` patch of only
the settings that change, or `stop`, `clearLoopPattern`, `resetToDefaults`, or `null`.
The client merges the patch through `window.bpm` and starts playback.

Interpretation belongs to Typesafe Jev (`jev-1.13.0`, called directly with
`TYPESAFE_API_KEY`). Every question is a multiple-choice question; the server only
validates, does arithmetic, and builds the patch. Code lives in `server/voice/`:

- **Main request** (`main.mjs`, every phrase): the action (play, drum edit, count-in,
  stop, clear, reset, ...), drum or click mode, a style from `styles.json`, and every
  clicker setting. Numbers are asked as a mode (keep, exact, slow, faster, ...) plus
  one question per digit, so exact values and categories stay distinct.
- **Drum request** (`drums.mjs`, only for drum edits): per lane, one whole-lane question
  (shift, fill, empty) and, per beat, which existing hits come out and which new hits go
  in, at sixteenth-note resolution or the grid's own (triplets etc.).
- **Count-ins** (`count-in.mjs`, `rhythm.mjs`): Jev decides an utterance is a
  count-in; tempo, subdivisions, beats per bar (when the count repeats a bar) and
  (cautiously) swing are then estimated by scoring and refining competing hypotheses.
  Evidence: the transcript's word timings, plus audio onsets detected in the browser
  (`src/lib/onsets.ts`: spectral flux and RMS against rolling baselines). Words matched to
  onsets take the onset's time; onsets the transcript missed are added when the words
  are unsure or incomplete. Numerals and repeated syllables only weight which events are
  likely beats.
- **Heard rhythm** (`src/lib/rhythm-tracker.ts`): with the mic on, claps or an instrument
  heard steadily and confidently set the tempo (shown as "Hearing 110 BPM. Say “start” or
  press Start to play.") without starting playback. Speech pauses it unless the audio
  shows music (held notes, sharp percussion, or a steady rhythm already being heard);
  that music evidence is also sent to Jev so it can treat lyrics or stray words as
  unrelated. Rhythm isn't detected while the metronome is playing.
  While playing is being analyzed it shows "Instrument detected…", then the tempo. Add `?voicedebug` to the URL to show what detection
  sees (only while it's in the URL): mic level, onsets, state and why no rhythm yet.
- **Context** (`context.mjs`): retrieved terminology from `glossary.json` and reference
  grooves from the research corpus.

A named style plays as a regular metronome on drum kit sounds; drum mode is used only
when a drum loop or specific kick/snare/hat parts are asked for (in drum mode, a style
loads its pattern). An answer is acted on only above 50% confidence; otherwise that setting is kept. An
exact value the player can't do (e.g. 340 BPM) is reported, not clamped.

To test locally, put `TYPESAFE_API_KEY=...` and `OPENROUTER_API_KEY=...` in `.env.local` and run `pnpm dev`; Vite
serves `/api/voice` and Jev's answers are logged to the browser console. `node scripts/voice-eval.mjs` runs a live eval against it and
reports a score; it measures, it doesn't gate. `scripts/build-styles.mjs` rebuilds the style catalog.
Never use a `VITE_` prefix or put the key in client code.

### Vector store (retrieval for Jev)

`server/voice/embeddings.json` holds an embedding (`voyageai/voyage-4` through OpenRouter)
for every catalog style, every recorded groove in the research corpus and every glossary
term, with the text Jev reads for each. Each phrase is embedded at request time and the
most similar entries go into Jev's prompt as examples; the most similar styles are what
the style question offers. Rebuild with `node scripts/build-embeddings.mjs` after changing
the styles, the corpus or the glossary. The server needs `OPENROUTER_API_KEY` (in
`.env.local` locally, and as a site setting in production); without it voice says so and
changes nothing.

`data/reference-patterns.sqlite` is the research corpus (673 references with source URLs,
notes and drum patterns, plus the older word-count TF-IDF vectors, no longer used at
runtime); `server/reference-index.json` is its export, read by the build scripts.

See `data/README.md` for provenance, corpus coverage, and refresh instructions.

## Example code

- See example of reusing the Metronome code in `public/example.html`

