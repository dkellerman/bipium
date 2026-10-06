# Bipium API (Machine Reference)

## Entry Point

- Global runtime object: `window.bpm`
- Native WebMCP progressively exposes the complete runtime API through `document.modelContext` when the browser supports it. Its tools cover discovery and state, validation, playback, every configuration control, loop patterns, sound URLs, query parsing and serialization, tapping, and the guitar tuner.

## Validate First

- `window.bpm.validateConfig(input)`

Returns:

- success: `{ ok: true, value: BipiumApiConfig }`
- failure: `{ ok: false, error: string }`

Do not start playback with invalid config.

## Start Method

- `window.bpm.start(bpm?, beats?, subDivs?, swing?, soundPack?, volume?)`

All parameters are optional. Any defined argument is validated and applied before starting.

## Runtime Methods

- `window.bpm.schemas`
- `window.bpm.schemaJson`
- `window.bpm.getSchemaJson()`
- `window.bpm.stop()`
- `window.bpm.toggle()`
- `window.bpm.isStarted()`
- `window.bpm.isLoopMode()`
- `window.bpm.getLoopRepeats()`
- `window.bpm.getSoundUrls()`
- `window.bpm.getConfig()`
- `window.bpm.setConfig(partial)`
- `window.bpm.getLoopPattern()`
- `window.bpm.setLoopMode(enabled)`
- `window.bpm.setLoopRepeats(repeats)`
- `window.bpm.setSoundUrls(soundUrls)`
- `window.bpm.setLoopPattern(pattern)`
- `window.bpm.resetLoopPattern()`
- `window.bpm.fromQuery(query?)`
- `window.bpm.toQuery(config?)`
- `window.bpm.applyQuery(query?)`
- `window.bpm.tap()`
- `window.bpm.getSoundPacks()`
- `window.bpm.now()`
- `window.bpm.startTuner()`
- `window.bpm.stopTuner()`
- `window.bpm.getTunerState()`

## Guitar Tuner

- `window.bpm.startTuner()` shows the tuner and listens with the user's microphone (the browser may ask for permission). Returns a promise of the tuner state. It rejects while the metronome is playing (stop it first), when the microphone is denied, or when the browser keeps audio suspended until the user taps the page.
- `window.bpm.getTunerState()` returns what the tuner shows, or showed last.
- `window.bpm.stopTuner()` closes it and stops its microphone.

The tuner hears open strings: one plucked string, a few, or a strum of all six. It closes after 45 s with no string ringing, and when the metronome starts. Voice mode opens it on its own when it hears open strings.

```ts
{
  available: boolean;        // false in players without a tuner
  showing: boolean;
  listening: boolean;        // the mic is listening for strings
  tuning: string | null;     // e.g. "Standard", "Drop D", "Whole step down"
  tuningConfirmed: boolean;  // false while it's a guess from single strings
  wholeGuitarCents: number | null; // the guitar's own reference against A440
  strings: {                 // low string first
    note: string;            // e.g. "E", "F♯"
    octave: number;
    cents: number | null;    // against the guitar's reference (A440 until three strings are heard)
    ringing: boolean;
  }[];
}
```

Strings are read against each other (relative pitch) once three have been heard, together or one at a time; `wholeGuitarCents` says how far the whole guitar is from A440.

## Zod Schemas

Bipium uses `zod` for runtime validation.

- `window.bpm.schemas.config` - strict full config schema
- `window.bpm.schemas.configPatch` - strict partial schema for updates
- `window.bpm.schemaJson` - JSON Schema snapshots
- `window.bpm.getSchemaJson()` - returns schema JSON snapshot

## BipiumApiConfig

```ts
{
  bpm: number;        // 20..320
  beats: number;      // 1..12
  subDivs: number;    // 1..8
  playSubDivs: boolean;
  swing: number;      // 0..100
  soundPack: string;  // e.g. "defaults" | "drumkit"
  volume: number;     // 0..100
  soundUrls: {
    bar?: string;
    beat?: string;
    half?: string;
    subDiv?: string;
    user?: string;
  };
  loopMode: boolean;
  loopRepeats: number; // 0..128, where 0 means forever
  loopPattern: {
    kick: boolean[];
    hat: boolean[];
    snare: boolean[];
  };
}
```

Swing guidance for AI/tooling:

- Prefer `swing: 0` unless the request explicitly asks for swing/shuffle or the groove strongly implies it.
- Around `33` is a basic swing feel.
- Around `50` is a very heavy shuffle.
- Values above `50` should be extremely rare.
- "A little swing" usually means clearly below `33`.

Stored `loopPattern` lane lengths match the active step count:

- `beats * subDivs` when `playSubDivs === true`
- `beats` when `playSubDivs === false`

When `setLoopPattern`, `setConfig`, or `validateConfig` receives equal-length lanes on a different supported grid, their length defines the input resolution (`lane.length / beats`). Core code preserves the exact hit positions and chooses the smallest compatible grid at least as fine as the current active grid. It enables subdivisions when required. An inactive subdivision setting does not force an unnecessarily fine grid. Unequal lane lengths and positions that cannot share a supported grid are rejected; hits are never rounded by this fitting rule.

Voice placements use the same deterministic `fitDrumLoopGrid` function. The model does not choose the required expansion. An explicitly requested grid remains respected. API/voice automation preserves the current playback mode unless a requested pattern requires custom drum mode; it does not automatically switch an existing drum-mode session back to regular mode. Direct user mode selections remain available.

When timing changes through `setConfig`, `start`, or query import and no new `loopPattern` is supplied, the existing pattern is remapped to the new grid automatically.

## URL Params

Bipium also supports URL-driven config via query params:

- `bpm`
- `beats`
- `playSubDivs`
- `subDivs`
- `swing`
- `soundPack`
- `soundBarUrl`
- `soundBeatUrl`
- `soundHalfUrl`
- `soundSubDivUrl`
- `soundUserUrl`
- `volume`
- `loopMode`
- `loopRepeats`
- `loopKick`
- `loopHat`
- `loopSnare`

`loopKick`, `loopHat`, and `loopSnare` are binary strings where each character is one step in the loop grid.

## Discovery

- Human docs: `/apidocs`
- Markdown docs: `/api.md`
- Agent docs: `/llms.txt`
- Compatibility mirror: `/agents.txt`

- `window.bpm.clearLoopPattern()` clears every drum-grid hit without changing timing, mode, or playback state.
- `window.bpm.resetToDefaults()` stops playback and restores all defaults, including sounds and pattern; removes custom sound URLs.
- Existing `resetLoopPattern()` only reseeds the pattern at the current timing.
