export type Sound = string | number | AudioBuffer;

export type FinalSoundSpec = [Sound, number, number];

export type SoundSpec = string | number | FinalSoundSpec;

export const DRUM_LOOP_LANES = ['kick', 'hat', 'snare'] as const;

export type DrumLoopLane = (typeof DRUM_LOOP_LANES)[number];

export interface DrumLoopTiming {
  beats: number;
  subDivs: number;
  swing: number;
}

export type DrumLoopPattern = Record<DrumLoopLane, boolean[]>;

export type SoundPack = {
  [key: string]: SoundSpec;
};

export type AudioNode =
  | InstanceType<typeof OscillatorNode>
  | InstanceType<typeof AudioBufferSourceNode>;

export type ScheduledAudio = AudioNode | AudioNode[];

export type Click = {
  obj?: ScheduledAudio;
  bar: number;
  beat: number;
  beats: number;
  subDiv: number;
  subDivs: number;
  time: number;
};
