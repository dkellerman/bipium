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
- `window.bpm.getConfig()`
- `window.bpm.setConfig(partial)`
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
}
```

## URL Params

Bipium also supports URL-driven config via query params:

- `bpm`
- `beats`
- `playSubDivs`
- `subDivs`
- `swing`
- `soundPack`
- `volume`

## Discovery

- Human docs: `/api`
- Markdown docs: `/api.md`
- Agent docs: `/llms.txt`
- Compatibility mirror: `/agents.txt`
