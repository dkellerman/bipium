import { AudioNode, Click, FinalSoundSpec, ScheduledAudio, Sound, SoundPack } from './types';
export declare const DEFAULT_SOUNDS: SoundPack;
export interface ClickerOptions {
  audioContext: InstanceType<typeof AudioContext>;
  volume?: number;
  sounds?: SoundPack;
  resolveScheduledSounds?: (click: Click, sounds: SoundPack) => FinalSoundSpec[] | null | undefined;
}
export declare class Clicker {
  audioContext: InstanceType<typeof AudioContext>;
  volume: number;
  loading: boolean;
  gainNode: InstanceType<typeof GainNode>;
  sounds: SoundPack;
  resolveScheduledSounds?: ClickerOptions['resolveScheduledSounds'];
  constructor({ audioContext, volume, sounds, resolveScheduledSounds }: ClickerOptions);
  setSounds(sounds: SoundPack): Promise<void>;
  fetchSounds(sounds: SoundPack): Promise<SoundPack>;
  setVolume(volume: number): void;
  setResolveScheduledSounds(
    resolveScheduledSounds?: ClickerOptions['resolveScheduledSounds'],
  ): void;
  scheduleClickSound({
    time,
    subDiv,
    beat,
    beats,
  }: {
    time: number;
    subDiv: number;
    beat: number;
    beats: number;
  } & Click): ScheduledAudio | undefined;
  removeClickSound(click: Click): void;
  playSoundAt(sound: Sound, time: number, clickLength: number, relativeVolume?: number): AudioNode;
  click(t?: number): AudioNode;
}
//# sourceMappingURL=Clicker.d.ts.map
