import {AudioNode, Click, FinalSoundSpec, Sound, SoundPack} from "./types";

export const DEFAULT_SOUNDS: SoundPack = {
  name: 'Defaults',
  bar: 880.0,
  beat: 440.0,
  subDiv: 220.0,
  user: 660.0,
};

export interface ClickerOptions {
  audioContext: InstanceType<typeof AudioContext>;
  volume?: number;
  sounds?: SoundPack;
};

export class Clicker {
  audioContext: InstanceType<typeof AudioContext>;
  volume: number;
  loading: boolean;
  gainNode: InstanceType<typeof GainNode>;
  sounds: SoundPack = {};

  constructor({ audioContext, volume = 100, sounds = DEFAULT_SOUNDS }: ClickerOptions) {
    this.audioContext = audioContext;
    this.volume = volume;
    this.loading = false;
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
    this.setSounds(sounds);
  }

  async setSounds(sounds: SoundPack) {
    this.sounds = await this.fetchSounds(sounds);
  }

  async fetchSounds(sounds: SoundPack): Promise<SoundPack> {
    this.loading = true;
    for (const k in sounds) {
      if (k === 'name') continue;
      let sound;
      if (!Array.isArray(sounds[k])) {
        sound = sounds[k] as Sound;
        sounds[k] = [sound, 1.0, 0.05];
      } else {
        sound = (sounds[k] as any)[0];
      }
      if (typeof sound === 'string') {
        const buf = await fetchAudioBuffer(this.audioContext, sound);
        (sounds[k] as any[])[0] = buf;
      }
    }
    this.loading = false;

    return sounds;
  }

  setVolume(volume: number) {
    this.volume = volume;
  }

  scheduleClickSound({ time, subDiv, beat, beats }: {
    time: number;
    subDiv: number;
    beat: number;
    beats: number;
  }) {
    // console.log('sch click', beat, subDiv, this.volume);
    if (this.loading) return;

    let sound;
    const sounds = this.sounds;
    if (beat === 1 && subDiv === 1) {
      sound = sounds.bar || sounds.beat;
    } else if (beat === Math.ceil(beats / 2) + 1 && subDiv === 1) {
      sound = sounds.half || sounds.beat;
    } else if (beat > 1 && subDiv === 1) {
      sound = sounds.beat;
    } else {
      sound = sounds.subDiv || sounds.beat;
    }

    const [soundObj, relativeVolume, clickLength] = sound as any;
    return this.playSoundAt(soundObj, time, clickLength, relativeVolume);
  }

  removeClickSound(click: Click) {
    click?.obj?.stop(0);
  }

  playSoundAt(sound: Sound, time: number, clickLength: number, relativeVolume: number = 1.0): AudioNode {
    if (this.audioContext?.state === 'suspended') this.audioContext.resume();

    let audioNode: AudioNode;
    if (typeof sound === 'number') {
      // freq
      audioNode = this.audioContext.createOscillator();
      audioNode.connect(this.gainNode);
      audioNode.frequency.value = sound;
      audioNode.start(time);
      audioNode.stop(time + clickLength);
    } else {
      // buffer
      audioNode = this.audioContext.createBufferSource();
      try {
        audioNode.buffer = sound as AudioBuffer;
      } catch (e) {
        console.error(e);
      }
      audioNode.connect(this.gainNode);
      audioNode.start(time, 0, clickLength);
    }

    this.gainNode.gain.setValueAtTime((this.volume * relativeVolume) / 100, time);
    return audioNode;
  }

  click(t = 0): AudioNode {
    const [soundObj, vol, length] = this.sounds.user as any;
    return this.playSoundAt(soundObj, t, length, vol);
  }
}

async function fetchAudioBuffer(audioContext: AudioContext, filepath: string) {
  const response = await fetch(filepath);
  const arrayBuffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
}
