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
    schemaJson: { configPatch: { type: 'object' } },
    setConfig: vi.fn(() => config),
    start: vi.fn(() => config),
    stop: vi.fn(),
    isStarted: vi.fn(() => true),
    getConfig: vi.fn(() => config),
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
      'start_metronome',
      'stop_metronome',
      'get_metronome_state',
    ]);

    await tools[0].execute({ bpm: 96, loopMode: true }, { signal: signals[0] });
    expect(runtime.setConfig).toHaveBeenCalledWith({ bpm: 96, loopMode: true });
    expect(runtime.start).toHaveBeenCalledOnce();

    await tools[1].execute({}, { signal: signals[1] });
    expect(runtime.stop).toHaveBeenCalledOnce();

    const state = await tools[2].execute({}, { signal: signals[2] });
    expect(JSON.parse(state as string)).toMatchObject({ started: true, config: { bpm: 120 } });

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
      tools[0].execute(
        { loopMode: true, loopPattern: { kick: [true], hat: [], snare: [] } },
        { signal: new AbortController().signal },
      ),
    ).rejects.toThrow('wrong length');
    expect(runtime.start).not.toHaveBeenCalled();
  });
});
