export type Sound = string | number | AudioBuffer;

export type FinalSoundSpec = [Sound, number, number];

export type SoundSpec = string | number | FinalSoundSpec;

export type SoundPack = {
  [key: string]: SoundSpec;
};

export type AudioNode =
  | InstanceType<typeof OscillatorNode>
  | InstanceType<typeof AudioBufferSourceNode>;

export type Click = {
  obj?: AudioNode;
  bar: number;
  beat: number;
  beats: number;
  subDiv: number;
  subDivs: number;
  time: number;
};

export type Pattern = number[];
