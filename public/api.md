# Bipium API (Machine Reference)

## Entry Point

- Global runtime object: `window.bpm`

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

`loopPattern` lane lengths must match the active step count:

- `beats * subDivs` when `playSubDivs === true`
- `beats` when `playSubDivs === false`

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

- Human docs: `/api`
- Markdown docs: `/api.md`
- Agent docs: `/llms.txt`
- Compatibility mirror: `/agents.txt`
