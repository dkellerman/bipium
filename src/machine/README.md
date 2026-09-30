# Machine UI

An alternate, hardware-drum-machine-style interface for Bipium, served at
**`/machine`**. Prototyped 2026-07-15 (three design variants were built and
compared; this one won).

Design principles it upholds:

- fits on one mobile screen with no scrolling
- all buttons big and easy to press
- options progressively revealed (subdiv strip, swing slider)
- both themes use the shared Pixi `DefaultVisualizer`

## Isolation rules

This folder is deliberately **self-contained** so the classic UI at `/` is
unaffected:

- Nothing outside `src/machine/` imports from this folder except the `/machine`
  route in `main.tsx`.
- The visualizer is shared with classic; `skipEdgeGridLines` controls its only
  theme-specific drawing difference. Never copy the visualizer.
- Separate presentation components include `DrumLaneLabels` (full-word lane labels),
  `MachineDrawer` (menu only — volume/sounds live on the faceplate).
- Shared infrastructure is imported read-only: `AppContext`, hooks
  (`useClicker`, `useMetronome`, `useTapBPM`, `SOUND_PACKS`), `core/`,
  `components/DrumLoopOverlay`, and the ui
  primitives used by the drawer.
- Styles live in `machine.css` (`.machine-range`), imported only by
  `MachinePage`.

`MachinePage.tsx` duplicates the state wiring of `pages/App.tsx` (metronome,
runtime `window.bpm` API, URL config, session-backed settings — the same
sessionStorage keys, so settings carry between `/` and `/machine`). If
`pages/App.tsx` wiring changes materially, mirror it here.
