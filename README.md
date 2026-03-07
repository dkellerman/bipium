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
- Vite for app and core distribution builds, deployed to Vercel
- microsecond time syncing via AudioContext

The `src/core` directory contains an app-independent metronome implementation with no library dependencies.

## AI Dev Setup

The AI config generator now runs through a Vercel Function at `/api/ai-config`, so the OpenAI key stays server-side.

- Set `OPENAI_API_KEY` in Vercel project env vars for production.
- For local development, pull env vars locally with `vercel env pull .env.local`, or otherwise provide `OPENAI_API_KEY` before starting Vercel dev.
- Run `pnpm dev:vercel` when you need the app and the server function together.
- `pnpm dev` still runs the Vite app only.

## Example code

- See example of reusing the Metronome code in `public/example.html`
