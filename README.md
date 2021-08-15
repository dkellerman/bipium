# Bipium

A metronome web app. https://bipium.com

## Features
- BPM slider, or type it in (allows fractional beats)
- Play sub-divisions if desired
- Swing!
- Tap tempo
- Tap along, shows feedback for early/late clicks
- Visualization vaguely imitates a piano roll
- Configurable sounds
- Set volume
- Values are stored in the session for stickiness through refreshes
- All parameters configurable via URL, you can copy a link to the clipboard
- Experimenting with voice commands, not going so well yet



## Tech
- React, Javascript, CSS (styled-components)
- PIXI.js for visualizer, to allow GPU rendering
- Metronome implementation inspired by https://github.com/cwilso/metronome
- create-react-app for UI, deployed to Vercel
- microsecond time syncing via AudioContext
