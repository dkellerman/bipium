import type { ApiConfig, RuntimeApi } from './api';

type RegistrationTarget = Pick<WebMCP.ModelContext, 'registerTool'>;

const EMPTY_INPUT_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

function schemaProperty(schema: unknown, name: string) {
  if (!schema || typeof schema !== 'object') return {};
  const properties = (schema as { properties?: Record<string, unknown> }).properties;
  const property = properties?.[name];
  return property && typeof property === 'object' ? property : {};
}

function currentState(runtime: RuntimeApi) {
  return {
    started: runtime.isStarted(),
    config: runtime.getConfig(),
  };
}

function register(context: RegistrationTarget, tool: WebMCP.ModelContextTool, signal: AbortSignal) {
  void context.registerTool(tool, { signal }).catch((error: unknown) => {
    if (!signal.aborted) console.warn(`Could not register WebMCP tool "${tool.name}".`, error);
  });
}

/** Expose the existing window.bpm runtime through native WebMCP. */
export function registerBipiumWebMcp(runtime: RuntimeApi, context?: RegistrationTarget) {
  if (!context) return () => {};

  const controller = new AbortController();
  const { signal } = controller;

  register(
    context,
    {
      name: 'get_bipium_info',
      title: 'Get Bipium information',
      description:
        'Return the full Bipium runtime state, defaults, sound packs, schemas, timing, and discovery links.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      execute: async () =>
        JSON.stringify({
          version: runtime.version,
          entrypoint: runtime.entrypoint,
          discovery: runtime.discovery,
          defaults: runtime.defaults,
          ...currentState(runtime),
          loopMode: runtime.isLoopMode(),
          loopRepeats: runtime.getLoopRepeats(),
          loopPattern: runtime.getLoopPattern(),
          soundUrls: runtime.getSoundUrls(),
          soundPacks: runtime.getSoundPacks(),
          now: runtime.now(),
          schemas: runtime.getSchemaJson(),
        }),
    },
    signal,
  );

  register(
    context,
    {
      name: 'validate_bipium_config',
      title: 'Validate Bipium configuration',
      description: 'Validate a complete Bipium configuration without applying it.',
      inputSchema: runtime.schemaJson.config as object,
      annotations: { readOnlyHint: true },
      execute: async input => JSON.stringify(runtime.validateConfig(input)),
    },
    signal,
  );

  register(
    context,
    {
      name: 'start_metronome',
      title: 'Start Bipium metronome',
      description:
        'Apply an optional Bipium configuration and start visible metronome or drum-loop playback.',
      inputSchema: runtime.schemaJson.configPatch as object,
      execute: async input => {
        if (Object.keys(input).length > 0) runtime.setConfig(input as Partial<ApiConfig>);
        const config = runtime.start();
        return JSON.stringify({ status: 'playing', config });
      },
    },
    signal,
  );

  register(
    context,
    {
      name: 'stop_metronome',
      title: 'Stop Bipium metronome',
      description: 'Stop the active Bipium metronome or drum loop.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      execute: async () => {
        runtime.stop();
        return JSON.stringify({ status: 'stopped' });
      },
    },
    signal,
  );

  register(
    context,
    {
      name: 'toggle_metronome',
      title: 'Toggle Bipium metronome',
      description: 'Toggle Bipium playback and return the new playing state.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      execute: async () => JSON.stringify({ started: runtime.toggle() }),
    },
    signal,
  );

  register(
    context,
    {
      name: 'set_metronome_config',
      title: 'Set Bipium configuration',
      description:
        'Apply a partial Bipium metronome or drum-loop configuration without changing playback state.',
      inputSchema: runtime.schemaJson.configPatch as object,
      execute: async input =>
        JSON.stringify({ config: runtime.setConfig(input as Partial<ApiConfig>) }),
    },
    signal,
  );

  register(
    context,
    {
      name: 'set_bipium_loop_mode',
      title: 'Set Bipium loop mode',
      description: 'Enable or disable Bipium drum-loop mode.',
      inputSchema: {
        type: 'object',
        properties: { enabled: { type: 'boolean' } },
        required: ['enabled'],
        additionalProperties: false,
      },
      execute: async ({ enabled }) =>
        JSON.stringify({ config: runtime.setLoopMode(enabled as boolean) }),
    },
    signal,
  );

  register(
    context,
    {
      name: 'set_bipium_loop_repeats',
      title: 'Set Bipium loop repeats',
      description: 'Set how many drum-loop bars Bipium plays; zero repeats forever.',
      inputSchema: {
        type: 'object',
        properties: { repeats: schemaProperty(runtime.schemaJson.configPatch, 'loopRepeats') },
        required: ['repeats'],
        additionalProperties: false,
      },
      execute: async ({ repeats }) =>
        JSON.stringify({ config: runtime.setLoopRepeats(repeats as number) }),
    },
    signal,
  );

  register(
    context,
    {
      name: 'set_bipium_sound_urls',
      title: 'Set Bipium sound URLs',
      description: 'Override Bipium audio files for individual click and subdivision slots.',
      inputSchema: {
        type: 'object',
        properties: { soundUrls: schemaProperty(runtime.schemaJson.configPatch, 'soundUrls') },
        required: ['soundUrls'],
        additionalProperties: false,
      },
      execute: async ({ soundUrls }) =>
        JSON.stringify({ config: runtime.setSoundUrls(soundUrls as ApiConfig['soundUrls']) }),
    },
    signal,
  );

  register(
    context,
    {
      name: 'set_bipium_loop_pattern',
      title: 'Set Bipium loop pattern',
      description: 'Replace the kick, hat, and snare step arrays used by Bipium drum-loop mode.',
      inputSchema: {
        type: 'object',
        properties: { pattern: schemaProperty(runtime.schemaJson.configPatch, 'loopPattern') },
        required: ['pattern'],
        additionalProperties: false,
      },
      execute: async ({ pattern }) =>
        JSON.stringify({ config: runtime.setLoopPattern(pattern as ApiConfig['loopPattern']) }),
    },
    signal,
  );

  register(
    context,
    {
      name: 'reset_bipium_loop_pattern',
      title: 'Reset Bipium loop pattern',
      description: 'Reset the Bipium drum pattern for the current timing configuration.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      execute: async () => JSON.stringify({ config: runtime.resetLoopPattern() }),
    },
    signal,
  );

  const querySchema = {
    type: 'object',
    properties: { query: { type: 'string', description: 'A Bipium URL query string.' } },
    additionalProperties: false,
  };

  register(
    context,
    {
      name: 'clear_bipium_loop_pattern',
      title: 'Clear Bipium drum grid',
      description:
        'Remove every kick, hat, and snare hit while preserving timing, mode, and playback state.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      execute: async () => JSON.stringify({ config: runtime.clearLoopPattern() }),
    },
    signal,
  );
  register(
    context,
    {
      name: 'reset_bipium_to_defaults',
      title: 'Reset Bipium to defaults',
      description:
        'Stop playback and restore all default settings, sounds, and the default pattern. Remove custom sound URLs.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      execute: async () => JSON.stringify({ status: 'stopped', config: runtime.resetToDefaults() }),
    },
    signal,
  );

  register(
    context,
    {
      name: 'parse_bipium_query',
      title: 'Parse Bipium query',
      description: 'Parse a Bipium URL query into a configuration without applying it.',
      inputSchema: querySchema,
      annotations: { readOnlyHint: true },
      execute: async ({ query }) =>
        JSON.stringify({ config: runtime.fromQuery(query as string | undefined) }),
    },
    signal,
  );

  register(
    context,
    {
      name: 'create_bipium_query',
      title: 'Create Bipium query',
      description: 'Create a shareable Bipium URL query from an optional partial configuration.',
      inputSchema: {
        type: 'object',
        properties: { config: runtime.schemaJson.configPatch as object },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async ({ config }) =>
        JSON.stringify({ query: runtime.toQuery(config as Partial<ApiConfig> | undefined) }),
    },
    signal,
  );

  register(
    context,
    {
      name: 'apply_bipium_query',
      title: 'Apply Bipium query',
      description: 'Parse and apply a Bipium URL query to the visible metronome or drum loop.',
      inputSchema: querySchema,
      execute: async ({ query }) =>
        JSON.stringify({ config: runtime.applyQuery(query as string | undefined) }),
    },
    signal,
  );

  register(
    context,
    {
      name: 'tap_bipium',
      title: 'Tap Bipium',
      description: "Trigger Bipium's user click sound once.",
      inputSchema: EMPTY_INPUT_SCHEMA,
      execute: async () => {
        runtime.tap();
        return JSON.stringify({ status: 'tapped' });
      },
    },
    signal,
  );

  register(
    context,
    {
      name: 'get_metronome_state',
      title: 'Get Bipium state',
      description:
        'Return whether Bipium is playing and its current metronome or drum-loop configuration.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      execute: async () => JSON.stringify(currentState(runtime)),
    },
    signal,
  );

  register(
    context,
    {
      name: 'start_tuner',
      title: 'Start Bipium guitar tuner',
      description:
        "Show the guitar tuner and listen with the user's microphone (the browser may ask for permission). Only while the metronome is stopped. Then read it with get_tuner_state while the user plucks or strums open strings.",
      inputSchema: EMPTY_INPUT_SCHEMA,
      execute: async () => JSON.stringify(await runtime.startTuner()),
    },
    signal,
  );

  register(
    context,
    {
      name: 'stop_tuner',
      title: 'Stop Bipium guitar tuner',
      description: 'Close the guitar tuner and stop its microphone.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      execute: async () => JSON.stringify(runtime.stopTuner()),
    },
    signal,
  );

  register(
    context,
    {
      name: 'get_tuner_state',
      title: 'Get Bipium tuner state',
      description:
        "Return the guitar tuner's reading: the tuning, the whole guitar against A440, and each open string's cents against the guitar's own reference (low string first), with which strings are ringing now.",
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      execute: async () => JSON.stringify(runtime.getTunerState()),
    },
    signal,
  );

  return () => controller.abort();
}
