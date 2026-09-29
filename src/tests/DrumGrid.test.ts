import { describe, it, expect } from 'vitest';
import { API_DEFAULT_CONFIG, createRuntimeApi, createSchemas, mergeConfig } from '../core/api';
import * as core from '../core/api';
const schemas = createSchemas(new Set(['drumkit', 'defaults']));
const pattern = (divisions: number, snare: number[]) => ({
  kick: Array.from({ length: 4 * divisions }, (_, i) => i === 0),
  hat: Array.from({ length: 4 * divisions }, (_, i) => i % divisions === 0),
  snare: Array.from({ length: 4 * divisions }, (_, i) => snare.includes(i / divisions)),
});
describe('deterministic minimal drum grid', () => {
  it.each([
    [1.5, 2],
    [1.25, 4],
    [1.125, 8],
  ])('uses only the grid required for position %s', (position, expected) => {
    const result = mergeConfig(
      API_DEFAULT_CONFIG,
      { loopPattern: pattern(8, [position]) },
      schemas,
    );
    expect(result.subDivs).toBe(expected);
    expect(result.loopPattern.snare[Math.round(position * expected)]).toBe(true);
    expect(result.loopPattern.hat.filter(Boolean)).toHaveLength(4);
  });
  it('enables only the required subdivisions when they were off', () => {
    const result = mergeConfig(
      { ...API_DEFAULT_CONFIG, subDivs: 8, playSubDivs: false },
      { loopPattern: pattern(8, [1.5]) },
      schemas,
    );
    expect(result.subDivs).toBe(2);
    expect(result.playSubDivs).toBe(true);
  });
  it('does not shrink a compatible existing grid', () => {
    const base = { ...API_DEFAULT_CONFIG, subDivs: 4, loopPattern: pattern(4, [2]) };
    const result = mergeConfig(base, { loopPattern: pattern(8, [1.5]) }, schemas);
    expect(result.subDivs).toBe(4);
  });
  it('preserves triplets when fitting an eighth-note position', () => {
    const grid = core.fitDrumLoopGrid(
      { ...API_DEFAULT_CONFIG, subDivs: 3 },
      { kick: [0, 1 / 3], hat: [0, 1, 2, 3], snare: [1.5] },
    );
    expect(grid.subDivs).toBe(6);
    expect(grid.loopPattern.kick[2]).toBe(true);
    expect(grid.loopPattern.snare[9]).toBe(true);
  });
  it('rejects incompatible positions rather than rounding them', () => {
    expect(() =>
      core.fitDrumLoopGrid(
        { ...API_DEFAULT_CONFIG, subDivs: 7 },
        { kick: [1 / 7], hat: [], snare: [1.5] },
      ),
    ).toThrow(/supported grid/);
  });
  it('applies the same rule through the browser API without invoking AI', () => {
    let current = structuredClone(API_DEFAULT_CONFIG);
    const runtime = createRuntimeApi({
      getConfig: () => current,
      applyConfig: next => {
        current = next;
      },
      startPlayback: () => {},
      stopPlayback: () => {},
      togglePlayback: () => false,
      isPlaying: () => false,
      tap: () => {},
      now: () => 0,
      getSoundPacks: () => ['drumkit', 'defaults'],
    });
    runtime.setLoopPattern(pattern(8, [1.5]));
    expect(current.subDivs).toBe(2);
    expect(current.loopPattern.snare[3]).toBe(true);
  });
  it('still rejects malformed lane lengths', () => {
    expect(() =>
      mergeConfig(
        API_DEFAULT_CONFIG,
        { loopPattern: { ...pattern(2, [1.5]), kick: [true] } },
        schemas,
      ),
    ).toThrow();
  });
});
