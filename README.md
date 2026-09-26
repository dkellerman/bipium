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

`POST /api/voice` takes `{ prompt, currentConfig, recentTurns }`. Each phrase includes
the actual current player configuration and up to six recent spoken prompts with
whether they were applied, so relative edits use the ongoing context. The Worker retrieves four
references from the full research vector index, then calls OpenRouter Decisions
with `typesafe/jev-1.13`. It assembles and validates one `call` envelope:
`{ method: "setConfig", args: [config] }`, plus `playback: "start"`. A stop request
returns `{ method: "stop", args: [] }`; unsupported/unrelated speech returns no call.
Regular metronome playback is preferred for generic beat/style requests. Custom
drum patterns require an explicit drum-loop or instrument-placement request; later
relative edits preserve the established mode.
The client applies the configuration through the existing `window.bpm` API and
starts playback. The browser still owns audio and timing. Grid adjustments are
explicitly reported and preserve selected hits; impossible combinations are rejected.

Responses keep the exact prompt, all Jev answers including confidence and choice
probabilities, the full Jev request, selected source references, usage, and timing.
Confidence is Jev's distribution summary, not a calibrated accuracy estimate for
this app. For each setting, Jev confidence must exceed 50% to change it; otherwise the previous
value is preserved. Uncertain actions do nothing. Every valid server API call executes
without an overall confidence threshold or a second model check. The response has one diagnostic `confidence` number (minimum active
decision confidence); raw answers remain in `decisions`. Confidence never blocks
playback. Invalid or unsupported requests still return no executable call.
Recent responses are retained in browser session storage for conversational context.
Prompt and decision metadata remain in the server response, with no details UI or history download. Prompt history is not persisted on the
server. Stop listening cancels queued/in-flight interpretations but leaves any
already-playing beat alone. Spoken "stop playback" stops the player.

Store `OPENROUTER_API_KEY` only as a secret in GPT Sites. For local Worker testing,
put it in the ignored `dist/server/.dev.vars` after building. Never use a `VITE_`
prefix or put the key in client code. No other model or speech-service key is used.
Browser recognition support varies; it can use the browser vendor's remote speech
service and is not guaranteed offline. Microphone denial/unsupported browsers show a short voice availability message.
There is no typed prompt input. The Listen click unlocks the player's audio context.

### Research vector database

`data/reference-patterns.sqlite` stores all 673 indexed research references with
normalized character n-gram TF-IDF vectors, source URLs, notes, and drum patterns.
`server/reference-index.json` is its read-only runtime export: the Worker searches
these vectors directly in memory, without a separate paid vector service. The
SQLite database and source archives remain in source control and are not public
web assets. They are independent of user prompt history.

See `data/README.md` for provenance, corpus coverage, and refresh instructions.

## Example code

- See example of reusing the Metronome code in `public/example.html`

Voice commands “clear the drum grid” and “reset to defaults” invoke `clearLoopPattern()`
and `resetToDefaults()` through the browser API.
