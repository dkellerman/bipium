import { Clicker } from './Clicker';
import { Click } from './types';
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
  onUpdateOptions?: (opts: MetronomeOptions) => void;
  lookaheadInterval?: number;
  scheduleAheadTime?: number;
  startDelayTime?: number;
}
export declare class Metronome {
  opts: Required<MetronomeOptions>;
  started: boolean;
  startTime: number;
  stopTime?: number;
  barStart: number;
  lastBar: number;
  scheduledClicks: Click[];
  next: Click;
  worker: Worker | MetronomeWorker;
  constructor(opts: MetronomeOptions);
  start(): void;
  stop(): void;
  update({
    bpm,
    beats,
    subDivs,
    swing,
  }: {
    bpm?: number;
    beats?: number;
    subDivs?: number;
    swing?: number;
  }): void;
  scheduler(): void;
  scheduleClick(): void;
  advance(): void;
  unscheduleClicks(): void;
  get now(): number;
  get beatTime(): number;
  get subDivTime(): number;
  get barTime(): number;
  get totalSubDivs(): number;
  get gridTimes(): number[];
  get elapsed(): number;
  get lastClick(): Click | null;
  getClickIndex(click: Click | null, subDivs?: number): number;
  getClickBarIndex(click: Click, subDivs?: number): number;
  quantize(t: number, toSubDivs?: number): [number, number];
}
declare class MetronomeWorker {
  interval?: number;
  timer?: any;
  onmessage(_: any): void;
  postMessage(
    data:
      | 'start'
      | 'stop'
      | {
          interval?: number;
        },
  ): void;
  startTimer(): void;
  clearTimer(): void;
  tick(): void;
}
export {};
//# sourceMappingURL=Metronome.d.ts.map
