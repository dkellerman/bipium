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
all 16 native WebMCP tools, URL configuration, and the standalone core library.
The AI button is disabled. The previous prompt modal, OpenAI request hook, and
Vercel model endpoint have been removed. No reCAPTCHA code is present.

- `pnpm dev` serves the application locally.
- `pnpm build` builds the client and the Sites Worker.
- `pnpm test`, `pnpm typecheck`, and `pnpm test:server` verify the retained API and routing.
- GPT Sites owns deployment and public access. There is no app login.
- Production analytics is not loaded in this experimental copy.

### Future voice and Jev integration

`server/index.mjs` is the server entrypoint. Store `OPENROUTER_API_KEY` only as a
secret in GPT Sites; the Worker receives it through `env.OPENROUTER_API_KEY`.
Never use a `VITE_` prefix or expose the key to client code. The client sends
requests to a same-origin server route; that route will call OpenRouter and
return only the classification result. No model-calling route is enabled yet.
Validated results can be applied through the existing `window.bpm.setConfig`
or corresponding WebMCP tools. The browser still owns timing and playback.

## Example code

- See example of reusing the Metronome code in `public/example.html`
