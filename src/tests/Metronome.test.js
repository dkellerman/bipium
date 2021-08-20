import { act } from 'react-dom/test-utils';
import { Metronome, Visualizer, Clicker, DEFAULT_SOUNDS } from '../core';
import { AudioContext } from 'standardized-audio-context-mock';

let now = 0.0;
let lookahead = 0.025;

function fwd(t = lookahead) {
  return act(() => {
    now += t;
    jest.advanceTimersByTime(t * 1000);
    console.log('now =>', now);
  });
}

const mockOnNextClick = jest.fn(c => console.log('onNextClick =>', c.time));
const mockOnUnscheduleClick = jest.fn(c => console.log('onUnscheduleClick =>', c.time));
const mockAudioContext = new AudioContext();
const mockClicker = new Clicker({ audioContext: mockAudioContext });
const scheduleClickSound = jest.spyOn(mockClicker, 'scheduleClickSound');
const removeClickSound = jest.spyOn(mockClicker, 'removeClickSound');

describe('metronome', () => {
  beforeEach(async () => {
    now = 0.0;
    jest.useFakeTimers();
    jest.clearAllMocks();
    await mockClicker.setSounds(DEFAULT_SOUNDS);
  });

  it('performs basic functions', async () => {
    const m = new Metronome({
      timerFn: () => now,
      clicker: mockClicker,
      bpm: 60,
      subDivs: 4,
      onNextClick: mockOnNextClick,
      onUnscheduleClick: mockOnUnscheduleClick,
      startDelayTime: 0,
      lookaheadInterval: lookahead,
    });
    const v = new Visualizer({ metronome: m });

    expect(m.started).toBe(false);
    expect(m.barTime).toBe(4.0);

    expect(m.gridTimes).toEqual([
      0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75,
    ]);

    m.start();
    v.start();
    expect(m.started).toBe(true);
    expect(m.startTime).toBe(now);
    expect(m.stopTime).toBeFalsy();
    expect(v.progress).toBeCloseTo(0);
    expect(mockOnNextClick).toHaveBeenCalledWith(
      expect.objectContaining({
        time: 0,
        bar: 1,
        beat: 1,
        subDiv: 1,
      }),
    );
    expect(m.lastClick).not.toBeFalsy();

    fwd(); // => .025
    expect(mockOnNextClick).toHaveBeenCalledTimes(1);

    fwd(); // => .05
    expect(mockOnNextClick).toHaveBeenCalledTimes(1);

    fwd(lookahead * 6); // => .2
    expect(mockOnNextClick).toHaveBeenCalledTimes(2);
    expect(mockOnNextClick).toHaveBeenCalledWith(
      expect.objectContaining({
        time: 0.25,
        bar: 1,
        beat: 1,
        subDiv: 2,
      }),
    );

    fwd(lookahead * 32); // => 1s
    v.update();
    expect(v.progress).toBeCloseTo(0.25);
    expect(scheduleClickSound).toHaveBeenCalledTimes(5);

    fwd(lookahead * 120); // => 4s (bar time)
    v.update();
    expect(v.progress).toBeCloseTo(0);
    expect(scheduleClickSound).toHaveBeenCalledTimes(17);

    m.stop();
    expect(m.started).toBe(false);
    expect(m.stopTime).toBe(now);
  });

  it('syncs visual and metronome', async () => {
    const m = new Metronome({
      timerFn: () => now,
      clicker: mockClicker,
      bpm: 60,
      startDelayTime: 0,
      subDivs: 1,
      lookaheadInterval: lookahead,
    });
    const v = new Visualizer({ metronome: m });

    m.start();
    v.start();
    expect(v.progress).toBeCloseTo(0);
    expect(m.lastClick.beat).toBe(1);

    fwd(1.0); // => 1s
    v.update();
    expect(v.progress).toBeCloseTo(0.25);
    expect(m.lastClick.beat).toBe(2);

    m.update({ bpm: 120 });
    v.update();
    expect(m.lastClick.beat).toBe(2);

    fwd(0.5); // => 1.5s
    expect(m.lastClick.beat).toBe(3);

    fwd(0.5); // => 2s
    expect(m.lastClick.beat).toBe(4);

    fwd(0.5); // => 2.5s
    v.update();
    expect(v.progress).toBeCloseTo(0);
    expect(m.lastClick.bar).toBe(2);
    expect(m.lastClick.beat).toBe(1);

    fwd(0.5); // => 3s
    expect(m.lastClick.bar).toBe(2);
    expect(m.lastClick.beat).toBe(2);
    expect(scheduleClickSound).toHaveBeenCalledTimes(6);

    m.stop();
  });

  it('can change bpm correctly', async () => {
    const m = new Metronome({
      timerFn: () => now,
      clicker: mockClicker,
      bpm: 60, // .25s per subdiv
      subDivs: 4,
      onNextClick: mockOnNextClick,
      onUnscheduleClick: mockOnUnscheduleClick,
      startDelayTime: 0,
      lookaheadInterval: lookahead,
    });

    const v = new Visualizer({ metronome: m });

    m.start();
    v.start();
    fwd(lookahead * 8); // => .2
    expect(v.progress).toBeCloseTo(0);

    v.update();
    expect(v.progress).toBeCloseTo(0.05);

    // tempo change
    m.update({ bpm: 240 }); // .0625s per sub div
    expect(removeClickSound).toHaveBeenCalledTimes(1);
    expect(mockOnNextClick).toHaveBeenCalledTimes(2);
    expect(m.barTime).toBe(1);
    expect(m.next.bar).toBe(1);
    expect(m.next.beat).toBe(1);
    expect(m.next.subDiv).toBe(2);
    expect(m.next.time).toBe(0.25);
    expect(m.lastClick).toEqual(expect.objectContaining({ beat: 1, subDiv: 1, time: 0 }));
    v.update();
    expect(v.progress).toBeCloseTo(0.05);

    fwd(lookahead * 4); // => .3
    expect(mockOnNextClick).toHaveBeenCalledTimes(5);
    expect(mockOnNextClick).toHaveBeenCalledWith(
      expect.objectContaining({
        time: 0.3125,
        bar: 1,
        beat: 1,
        subDiv: 3,
      }),
    );
    expect(mockOnNextClick).toHaveBeenCalledWith(
      expect.objectContaining({
        time: 0.375,
        bar: 1,
        beat: 1,
        subDiv: 4,
      }),
    );
    expect(m.lastClick).toEqual(expect.objectContaining({ beat: 1, subDiv: 2, time: 0.25 }));
    v.update();
    // expect(v.nowX).toBeCloseTo(15);

    fwd(lookahead * 4); // => .4
    v.update();
    // expect(v.nowX).toBeCloseTo(25);

    fwd(lookahead * 31.5); // => 1.1875s (next bar)
    expect(m.lastClick).toEqual(
      expect.objectContaining({ bar: 2, beat: 1, subDiv: 1, time: 1.1875 }),
    );
    v.update();
    expect(v.progress).toBeCloseTo(0);

    m.stop();
  });
});
