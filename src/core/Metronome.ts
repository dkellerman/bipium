import { Clicker } from "./Clicker";
import { Click } from "./types";

export interface MetronomeOptions {
  timerFn: () => number;
  clicker?: InstanceType<typeof Clicker>;
  bpm?: number;
  beats?: number;
  subDivs?: number;
  swing?: number;
  worker?: Worker;
  workerUrl?: string;
  onNextClick?: (click: Click) => void;
  onUnscheduleClick?: (click: Click) => void;
  onStart?: () => void;
  onStop?: () => void;
  onSchedulerTick?: () => void;
  lookaheadInterval?: number;
  scheduleAheadTime?: number;
  startDelayTime?: number;
}

const defaultOptions: Partial<MetronomeOptions> = {
  bpm: 80,
  beats: 4,
  subDivs: 1,
  swing: 0,
  workerUrl: undefined,
  lookaheadInterval: 0.025,
  scheduleAheadTime: .1,
  startDelayTime: 0.2,
};

export class Metronome {
  opts: Required<MetronomeOptions>;
  started: boolean = false;
  startTime: number = 0;
  stopTime?: number;
  barStart: number = 0;
  lastBar: number = 0;
  scheduledClicks: Click[] = [];
  next: Click;
  worker: Worker | MetronomeWorker;

  constructor(opts: MetronomeOptions) {
    this.opts = { ...defaultOptions, ...opts } as Required<MetronomeOptions>;
    this.started = false;
    this.next = { bar: 0, beat: 0, beats: this.opts.beats, subDiv: 0, subDivs: this.opts.subDivs, time: 0 };

    // prep the thread timer
    if (this.opts.workerUrl) {
      this.worker = new Worker(this.opts.workerUrl);
    } else {
      this.worker = new MetronomeWorker();
    }

    this.worker.onmessage = (e: { data?: string }) => {
      if (e.data === 'tick') {
        this.scheduler();
        this.opts.onSchedulerTick?.();
      }
    };

    this.worker.postMessage({ interval: this.opts.lookaheadInterval });
  }

  start() {
    if (this.started) return;

    this.startTime = this.now + this.opts.startDelayTime;
    this.stopTime = undefined;
    this.barStart = this.startTime;
    this.lastBar = 0;
    this.started = true;
    this.scheduledClicks = [];
    if (this.opts.subDivs % 2 > 0) this.opts.swing = 0;

    this.next = {
      bar: 1,
      beat: 1,
      beats: this.opts.beats,
      subDiv: 1,
      subDivs: this.opts.subDivs,
      time: this.startTime,
    };

    this.worker.postMessage('start');
    this.opts.onStart?.();

    if (this.opts.clicker?.audioContext?.state === 'suspended') {
      this.opts.clicker.audioContext.resume();
    }
  }

  stop() {
    if (!this.started) return;

    this.stopTime = this.now;
    this.started = false;
    this.worker.postMessage('stop');
    this.unscheduleClicks();
    this.opts.onStop?.();
  }

  update({ bpm, beats, subDivs, swing }: {
    bpm?: number;
    beats?: number;
    subDivs?: number;
    swing?: number;
  }) {
    this.unscheduleClicks();

    if (bpm !== undefined) this.opts.bpm = bpm;
    if (beats !== undefined) this.opts.beats = beats;
    if (subDivs !== undefined) this.opts.subDivs = subDivs;
    if (swing !== undefined) this.opts.swing = swing;

    // recalculate next scheduled beat if bar structure has changed
    if ((bpm !== undefined || beats !== undefined) && this.started && this.scheduledClicks.length) {
      if (this.lastClick)
        this.next = { ...this.lastClick } ;
      while (this.next.time <= this.now - this.subDivTime) {
        this.next.time += this.subDivTime;
      }
      this.advance();
    }
  }

  // main method called by the thread timer when started
  scheduler() {
    if (!this.started) return;

    // update the bar start time for quantization purposes
    const lc = this.lastClick;
    if (lc && ((lc.bar || 0) > this.lastBar)) {
      this.lastBar = lc.bar;
      this.barStart = lc.time;
    }

    while (this.next.time < this.now + this.opts.scheduleAheadTime) {
      this.scheduleClick();
      this.advance(); // updates this.next.time
    }
  }

  scheduleClick() {
    const click: Click = {
      ...this.next,
      beats: this.opts.beats,
      subDivs: this.opts.subDivs,
    };

    // notify clicker to schedule the actual sound - it returns a sound object
    // that we keep around so that if it needs to be cancelled it can be passed
    // to the onUnscheduleClick method
    const obj = this.opts.clicker?.scheduleClickSound(click);
    this.opts.onNextClick?.(click);
    this.scheduledClicks.push({ ...click, obj });

    // remove old clicks from memory
    const now = this.now;
    this.scheduledClicks = this.scheduledClicks.filter((c: Click) => c?.time >= now - 10.0);
  }

  advance() {
    // calculate next click time
    let delta = this.beatTime / this.opts.subDivs;
    if (this.next.subDiv % 2 === 1) {
      delta += delta * (this.opts.swing / 100.0);
    } else {
      delta *= (100.0 - this.opts.swing) / 100.0;
    }

    // advance time
    this.next.time += delta;

    // advance beat counter
    if (this.next.subDiv % this.opts.subDivs === 0) {
      this.next.subDiv = 1;
      this.next.beat++;
      if (this.next.beat > this.opts.beats) {
        this.next.beat = 1;
        this.next.bar++;
      }
    } else {
      this.next.subDiv++;
    }
  }

  unscheduleClicks() {
    this.scheduledClicks = (this.scheduledClicks || [])
      .map((click: Click) => {
        if (click.time > this.now) {
          this.opts.clicker?.removeClickSound(click);
          this.opts.onUnscheduleClick?.(click);
          return null;
        }
        return click;
      })
      .filter(Boolean) as Click[];
  }

  get now(): number {
    return this.opts.timerFn();
  }

  get beatTime(): number {
    return 60.0 / this.opts.bpm;
  }

  get subDivTime(): number {
    return this.beatTime / this.opts.subDivs;
  }

  get barTime(): number {
    return this.opts.beats * this.beatTime;
  }

  get totalSubDivs(): number {
    return this.opts.beats * this.opts.subDivs;
  }

  // relative timestamps for all sub-divisions in a bar
  get gridTimes(): number[] {
    const swingTime = (this.barTime / this.totalSubDivs) * (this.opts.swing / 100) || 0;
    return Array.from(Array(this.totalSubDivs).keys()).map(i => {
      const t = i * (this.barTime / this.totalSubDivs);
      return i % 2 === 1 ? t + swingTime : t;
    });
  }

  get elapsed(): number {
    return this.now - this.startTime;
  }

  get lastClick(): Click|null {
    const clicks = this.scheduledClicks?.filter((c: Click) => c.time <= this.now);
    return clicks?.[clicks.length - 1] || null;
  }

  getClickIndex(click: Click|null, subDivs?: number): number {
    if (!click) return -1;
    return (
      (click.bar - 1) * this.opts.beats +
      (click.beat - 1) * (subDivs ?? this.opts.subDivs) +
      (click.subDiv - 1)
    );
  }

  getClickBarIndex(click: Click, subDivs?: number) {
    return (click.beat - 1) * (subDivs ?? this.opts.subDivs) + (click.subDiv - 1);
  }

  // returns adjustment required in seconds to make t fall on the nearest grid line
  // toSubDivs - which sub division to quantize to (e.g. 4 = 16th notes)
  quantize(t: number, toSubDivs?: number): [number, number] {
    const to = toSubDivs ?? this.opts.subDivs;
    const timeInBar = t - this.barStart;

    const gridTimes = this.gridTimes
      .concat([this.barTime])
      .filter((_, idx) => idx % (this.opts.subDivs / to) === 0);

    const closestSubDivTime = gridTimes.reduce((prev, curr) =>
      Math.abs(curr - timeInBar) < Math.abs(prev - timeInBar) ? curr : prev,
    );
    const amount = closestSubDivTime - timeInBar;

    let closestSubDiv = gridTimes.indexOf(closestSubDivTime);
    if (closestSubDiv === this.opts.beats * to) closestSubDiv = 0;
    closestSubDiv++;

    // console.log(amount, amount > 0 ? 'early' : 'late', 'to', closestSubDiv);

    return [amount, closestSubDiv];
  }
}

// fallback worker, but should use worker.js instead in thread
class MetronomeWorker {
  interval?: number;
  timer?: any;

  onmessage(_: any) {}

  postMessage(data: 'start' | 'stop' | { interval?: number }) {
    if (typeof data === 'object' && data.interval) {
      this.interval = data.interval;
      this.clearTimer();
    } else if (data === 'start') {
      this.startTimer();
      this.tick();
    } else if (data === 'stop') {
      this.clearTimer();
    }
  }

  startTimer() {
    if (this.interval)
      this.timer = setInterval(this.tick.bind(this), this.interval * 1000);
  }

  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  tick() {
    this.onmessage({ data: 'tick' });
  }
}
