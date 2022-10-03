import { AudioNode, Click, Sound, SoundPack } from "./types";
export declare const DEFAULT_SOUNDS: SoundPack;
export interface ClickerOptions {
    audioContext: InstanceType<typeof AudioContext>;
    volume?: number;
    sounds?: SoundPack;
}
export declare class Clicker {
    audioContext: InstanceType<typeof AudioContext>;
    volume: number;
    loading: boolean;
    gainNode: InstanceType<typeof GainNode>;
    sounds: SoundPack;
    constructor({ audioContext, volume, sounds }: ClickerOptions);
    setSounds(sounds: SoundPack): Promise<void>;
    fetchSounds(sounds: SoundPack): Promise<SoundPack>;
    setVolume(volume: number): void;
    scheduleClickSound({ time, subDiv, beat, beats }: {
        time: number;
        subDiv: number;
        beat: number;
        beats: number;
    }): AudioNode | undefined;
    removeClickSound(click: Click): void;
    playSoundAt(sound: Sound, time: number, clickLength: number, relativeVolume?: number): AudioNode;
    click(t?: number): AudioNode;
}
//# sourceMappingURL=Clicker.d.ts.map