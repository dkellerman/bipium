# Bipium

A metronome web app. https://bipium.com

## Features
- BPM slider, or type it in (allows fractional beats)
- Play sub-divisions if desired
- Swing!
- Tap tempo
- Tap along, shows feedback for early/late clicks
- Visualization vaguely imitates a piano roll
- Mobile-first layout
- Configurable sounds
- Set volume
- Values are stored in the session for stickiness through refreshes
- All parameters configurable via URL, you can copy a link to the clipboard

## Tech
- React, Typescript, Tailwind, Shadcn
- PIXI.js for visualizer, to allow GPU rendering
- Metronome implementation inspired by https://github.com/cwilso/metronome
- Vite for app and core distribution builds, deployed to Vercel
- microsecond time syncing via AudioContext

The `src/core` directory contains an app-independent metronome implementation with no library dependencies.

## Example code
- See example of reusing the Metronome code in `public/example.html`
