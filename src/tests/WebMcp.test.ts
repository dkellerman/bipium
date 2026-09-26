import { describe, expect, it, vi } from 'vitest';
import { registerBipiumWebMcp } from '@/core/webmcp';
import type { ApiConfig, RuntimeApi } from '@/core/api';

function createRuntime() {
  const config = {
    bpm: 120,
    beats: 4,
    subDivs: 2,
    playSubDivs: true,
    swing: 0,
    soundPack: 'defaults',
    volume: 1,
    loopMode: false,
    loopRepeats: 0,
    soundUrls: {},
    loopPattern: { kick: [], hat: [], snare: [] },
  } satisfies ApiConfig;

  return {
    version: 1,
    discovery: {},
    defaults: config,
    schemaJson: {
      config: { type: 'object' },
      configPatch: {
        type: 'object',
        properties: {
          loopRepeats: { type: 'integer' },
          soundUrls: { type: 'object' },
          loopPattern: { type: 'object' },
        },
      },
    },
    getSchemaJson: vi.fn(() => ({ config: {}, configPatch: {} })),
    validateConfig: vi.fn(() => ({ ok: true as const, value: config })),
    setConfig: vi.fn(() => config),
    start: vi.fn(() => config),
    stop: vi.fn(),
    toggle: vi.fn(() => false),
    isStarted: vi.fn(() => true),
    isLoopMode: vi.fn(() => false),
    getLoopRepeats: vi.fn(() => 0),
    getSoundUrls: vi.fn(() => ({})),
    getConfig: vi.fn(() => config),
    getLoopPattern: vi.fn(() => config.loopPattern),
    setLoopMode: vi.fn(() => config),
    setLoopRepeats: vi.fn(() => config),
    setSoundUrls: vi.fn(() => config),
    setLoopPattern: vi.fn(() => config),
    resetLoopPattern: vi.fn(() => config),
    clearLoopPattern: vi.fn(() => config),
    resetToDefaults: vi.fn(() => config),
    fromQuery: vi.fn(() => config),
    toQuery: vi.fn(() => '?bpm=120'),
    applyQuery: vi.fn(() => config),
    tap: vi.fn(),
    getSoundPacks: vi.fn(() => ['defaults', 'drumkit']),
    now: vi.fn(() => 1),
  } as unknown as RuntimeApi;
}

describe('registerBipiumWebMcp', () => {
  it('does nothing when WebMCP is unavailable', () => {
    expect(registerBipiumWebMcp(createRuntime())).not.toThrow();
  });

  it('reuses the runtime for start, stop, and state tools', async () => {
    const tools: WebMCP.ModelContextTool[] = [];
    const signals: AbortSignal[] = [];
    const context = {
      registerTool: vi.fn(async (tool: WebMCP.ModelContextTool, options) => {
        tools.push(tool);
        if (options?.signal) signals.push(options.signal);
      }),
    };
    const runtime = createRuntime();
    const unregister = registerBipiumWebMcp(runtime, context);

    expect(tools.map(tool => tool.name)).toEqual([
      'get_bipium_info',
      'validate_bipium_config',
      'start_metronome',
      'stop_metronome',
      'toggle_metronome',
      'set_metronome_config',
      'set_bipium_loop_mode',
      'set_bipium_loop_repeats',
      'set_bipium_sound_urls',
      'set_bipium_loop_pattern',
      'reset_bipium_loop_pattern',
      'clear_bipium_loop_pattern',
      'reset_bipium_to_defaults',
      'parse_bipium_query',
      'create_bipium_query',
      'apply_bipium_query',
      'tap_bipium',
      'get_metronome_state',
    ]);

    const byName = Object.fromEntries(
      tools.map((tool, index) => [tool.name, { tool, signal: signals[index] }]),
    );

    await byName.start_metronome.tool.execute(
      { bpm: 96, loopMode: true },
      { signal: byName.start_metronome.signal },
    );
    expect(runtime.setConfig).toHaveBeenCalledWith({ bpm: 96, loopMode: true });
    expect(runtime.start).toHaveBeenCalledOnce();

    await byName.stop_metronome.tool.execute({}, { signal: byName.stop_metronome.signal });
    expect(runtime.stop).toHaveBeenCalledOnce();

    const state = await byName.get_metronome_state.tool.execute(
      {},
      { signal: byName.get_metronome_state.signal },
    );
    expect(JSON.parse(state as string)).toMatchObject({ started: true, config: { bpm: 120 } });

    await byName.set_bipium_loop_pattern.tool.execute(
      { pattern: runtime.getConfig().loopPattern },
      { signal: byName.set_bipium_loop_pattern.signal },
    );
    expect(runtime.setLoopPattern).toHaveBeenCalledWith(runtime.getConfig().loopPattern);
    await byName.clear_bipium_loop_pattern.tool.execute(
      {},
      { signal: byName.clear_bipium_loop_pattern.signal },
    );
    expect(runtime.clearLoopPattern).toHaveBeenCalled();
    await byName.reset_bipium_to_defaults.tool.execute(
      {},
      { signal: byName.reset_bipium_to_defaults.signal },
    );
    expect(runtime.resetToDefaults).toHaveBeenCalled();

    await byName.apply_bipium_query.tool.execute(
      { query: '?bpm=96' },
      { signal: byName.apply_bipium_query.signal },
    );
    expect(runtime.applyQuery).toHaveBeenCalledWith('?bpm=96');

    unregister();
    expect(signals.every(signal => signal.aborted)).toBe(true);
  });

  it('does not start playback when the existing runtime rejects a config', async () => {
    const tools: WebMCP.ModelContextTool[] = [];
    const context = {
      registerTool: vi.fn(async (tool: WebMCP.ModelContextTool) => {
        tools.push(tool);
      }),
    };
    const runtime = createRuntime();
    vi.mocked(runtime.setConfig).mockImplementation(() => {
      throw new Error('loopPattern.kick has the wrong length');
    });
    registerBipiumWebMcp(runtime, context);

    await expect(
      tools
        .find(tool => tool.name === 'start_metronome')
        ?.execute(
          { loopMode: true, loopPattern: { kick: [true], hat: [], snare: [] } },
          { signal: new AbortController().signal },
        ),
    ).rejects.toThrow('wrong length');
    expect(runtime.start).not.toHaveBeenCalled();
  });
});
