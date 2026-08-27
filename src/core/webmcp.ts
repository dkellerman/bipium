import type { ApiConfig, RuntimeApi } from './api';

type RegistrationTarget = Pick<WebMCP.ModelContext, 'registerTool'>;

const EMPTY_INPUT_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

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
      name: 'get_metronome_state',
      title: 'Get Bipium state',
      description:
        'Return whether Bipium is playing and its current metronome or drum-loop configuration.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      execute: async () =>
        JSON.stringify({
          started: runtime.isStarted(),
          config: runtime.getConfig(),
        }),
    },
    signal,
  );

  return () => controller.abort();
}
