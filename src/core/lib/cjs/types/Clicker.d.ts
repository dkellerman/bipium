import { AudioNode, Click, Pattern, Sound, SoundPack } from './types';
export declare const DEFAULT_SOUNDS: SoundPack;
export interface ClickerOptions {
    audioContext: InstanceType<typeof AudioContext>;
    volume?: number;
    sounds?: SoundPack;
    pattern?: Pattern;
}
export declare class Clicker {
    audioContext: InstanceType<typeof AudioContext>;
    volume: number;
    loading: boolean;
    gainNode: InstanceType<typeof GainNode>;
    pattern?: Pattern;
    sounds: SoundPack;
    constructor({ audioContext, volume, sounds, pattern }: ClickerOptions);
    setSounds(sounds: SoundPack): Promise<void>;
    fetchSounds(sounds: SoundPack): Promise<SoundPack>;
    setVolume(volume: number): void;
    setPattern(pattern: Pattern): void;
    scheduleClickSound({ time, subDiv, subDivs, beat, beats, }: {
        time: number;
        subDiv: number;
        subDivs: number;
        beat: number;
        beats: number;
    }): AudioNode | undefined;
    removeClickSound(click: Click): void;
    playSoundAt(sound: Sound, time: number, clickLength: number, relativeVolume?: number): AudioNode;
    click(t?: number): AudioNode;
}
//# sourceMappingURL=Clicker.d.ts.map