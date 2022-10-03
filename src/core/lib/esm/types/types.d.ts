export declare type Sound = string | number | AudioBuffer;
export declare type FinalSoundSpec = [Sound, number, number];
export declare type SoundSpec = string | number | FinalSoundSpec;
export declare type SoundPack = {
    [key: string]: SoundSpec;
};
export declare type AudioNode = InstanceType<typeof OscillatorNode> | InstanceType<typeof AudioBufferSourceNode>;
export declare type Click = {
    obj?: AudioNode;
    bar: number;
    beat: number;
    beats: number;
    subDiv: number;
    subDivs: number;
    time: number;
};
//# sourceMappingURL=types.d.ts.map