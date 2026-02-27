import { Metronome } from './Metronome';
import { Click } from './types';
export interface VisualizerOptions {
  metronome: InstanceType<typeof Metronome>;
  qThreshold?: number;
}
export declare class Visualizer {
  opts: Required<VisualizerOptions>;
  progress: number;
  lastTime: number;
  savedClick: Click | null;
  count: number[];
  qType: string | null;
  userClicks: number[];
  static frameRate: number[];
  constructor(opts: VisualizerOptions);
  start(): void;
  stop(): void;
  update(): void;
  static get frameRateInfo():
    | 0
    | {
        mean: number;
        std: number;
      };
}
//# sourceMappingURL=Visualizer.d.ts.map
