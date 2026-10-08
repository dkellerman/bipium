// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Metronome } from '@/core/index';

const pixi = vi.hoisted(() => ({
  mounts: 0,
  unmounts: 0,
  graphics: [] as any[],
  init: undefined as undefined | ((app: any) => void),
  overlays: [] as any[],
}));
vi.mock('@pixi/react', async () => {
  const React = await import('react');
  const Node = React.forwardRef(function Node({ draw }: any, ref: any) {
    const node = React.useMemo(
      () => ({
        x: 0,
        y: 0,
        visible: true,
        text: '',
        style: {},
        clear: vi.fn(),
        setStrokeStyle: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        getLocalBounds: () => ({ x: 0, y: 0, width: 10, height: 10 }),
        anchor: { set: vi.fn() },
      }),
      [],
    );
    React.useImperativeHandle(ref, () => node, [node]);
    React.useLayoutEffect(() => {
      if (draw) {
        pixi.graphics.push(node);
        draw(node);
      }
    }, [draw, node]);
    return null;
  });
  return {
    extend: () => {},
    Application: React.forwardRef(function Application({ children, onInit }: any, ref: any) {
      const app = React.useMemo(() => ({ renderer: { resize: vi.fn() } }), []);
      React.useImperativeHandle(ref, () => ({ getApplication: () => app }), [app]);
      React.useEffect(() => {
        pixi.mounts++;
        pixi.init = onInit;
        return () => {
          pixi.unmounts++;
        };
      }, []);
      return (
        <div data-testid="pixi-canvas">
          {React.Children.map(children, child => {
            if (!React.isValidElement(child)) return child;
            if (child.type === 'pixiGraphics' || child.type === 'pixiText')
              return React.createElement(Node, child.props as any);
            return child;
          })}
        </div>
      );
    }),
  };
});
vi.mock('@/components/DrumLoopOverlay', () => ({
  DrumLoopOverlay: (props: any) => {
    pixi.overlays.push(props);
    return null;
  },
}));
import { DefaultVisualizer } from '@/components/DefaultVisualizer';

let host: HTMLDivElement, root: Root, clock: number, frameId: number;
let frames: Map<number, FrameRequestCallback>;
let metronome: Metronome;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  pixi.mounts = pixi.unmounts = 0;
  pixi.graphics = [];
  pixi.overlays = [];
  pixi.init = undefined;
  clock = 0;
  frameId = 0;
  frames = new Map();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++frameId, cb);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  metronome = {
    started: true,
    opts: { beats: 4, subDivs: 1, swing: 0 },
    get elapsed() {
      return clock;
    },
    get barTime() {
      return 4;
    },
    get totalSubDivs() {
      return this.opts.beats * this.opts.subDivs;
    },
    get gridTimes() {
      return Array.from({ length: this.totalSubDivs }, (_, i) => (i * 4) / this.totalSubDivs);
    },
    lastClick: null,
    getClickIndex: () => 0,
  } as unknown as Metronome;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function frame() {
  await act(() => {
    clock += 0.1;
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(cb => cb(clock * 1000));
  });
}

describe('shared Pixi lifecycle', () => {
  it('keeps the renderer and moving Pixi now-line through grid, pattern, mode and size updates', async () => {
    const pattern = {
      kick: [true, false, false, false],
      hat: [true, true, true, true],
      snare: [false, false, true, false],
    };
    const toggle = vi.fn();
    const render = async (width: number, height: number, drums: boolean) =>
      act(() =>
        root.render(
          <DefaultVisualizer
            metronome={metronome}
            width={width}
            height={height}
            drumLoopPattern={drums ? pattern : undefined}
            onToggleDrumStep={toggle}
            horizontalLines={drums ? [height / 3, (height * 2) / 3] : []}
          />,
        ),
      );
    await render(350, 124, false);
    const canvas = host.querySelector('[data-testid="pixi-canvas"]');
    const line = pixi.graphics.find(g =>
      g.setStrokeStyle.mock.calls.some(([s]: any[]) => s.color === 0x00ff00),
    );
    expect(line).toBeTruthy();
    await frame();
    expect(line.x).toBeGreaterThan(0);
    for (let i = 0; i < 12; i++) {
      metronome.opts.beats = i % 2 ? 3 : 4;
      metronome.opts.subDivs = (i % 3) + 1;
      metronome.opts.swing = i % 2 ? 20 : 0;
      await render(320 + i, 140 + i, i % 2 === 0);
      expect(host.querySelector('[data-testid="pixi-canvas"]')).toBe(canvas);
      await frame();
      const x = line.x;
      await frame();
      expect(line.x).toBeGreaterThan(x);
      expect(line.visible).toBe(true);
      expect(line.lineTo).toHaveBeenLastCalledWith(0, 140 + i);
      expect(frames.size).toBe(1);
    }
    expect(pixi.mounts).toBe(1);
    expect(pixi.unmounts).toBe(0);
    expect(pixi.overlays.at(-1).pattern).toBe(pattern);
    pixi.overlays.at(-1).onToggleStep('snare', 3);
    expect(toggle).toHaveBeenCalledWith('snare', 3);
    // Late async renderer initialization must use the latest dimensions.
    const resize = vi.fn();
    pixi.init?.({ renderer: { resize } });
    expect(resize).toHaveBeenLastCalledWith(331, 151);
    metronome.started = false;
    await render(331, 151, false);
    expect(frames.size).toBe(0);
    expect(line.x).toBe(0);
    metronome.started = true;
    await render(331, 151, false);
    await frame();
    expect(line.x).toBeGreaterThan(0);
  });
});
