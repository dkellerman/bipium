export const DEFAULT_SOUNDS = {
  name: 'Defaults',
  bar: 880.0,
  beat: 440.0,
  subDiv: 220.0,
  user: 660.0,
};

export class Clicker {
  constructor({ audioContext, volume = 100, sounds = DEFAULT_SOUNDS }) {
    this.audioContext = audioContext;
    this.volume = volume;
    this.loading = false;
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
    this.setSounds(sounds);
  }

  async setSounds(sounds) {
    const result = await this.fetchSounds(sounds);
    this.sounds = result;
  }

  async fetchSounds(sounds) {
    this.loading = true;
    for (const k in sounds) {
      if (k === 'name') continue;
      if (!Array.isArray(sounds[k])) sounds[k] = [sounds[k], 1.0, .05];
      const [sound] = sounds[k];
      if (typeof sound === 'string') {
        sounds[k][0] = await fetchAudioBuffer(this.audioContext, sound);
      }
    }
    this.loading = false;

    return sounds;
  }

  setVolume(volume) {
    this.volume = volume;
  }

  scheduleClickSound({ time, subDiv, beat, beats }) {
    // console.log('sch click', beat, subDiv, this.volume);
    if (this.loading) return;

    let sound;
    const sounds = this.sounds;
    if (beat === 1 && subDiv === 1) {
      sound = sounds.bar || sounds.beat;
    } else if ((beat === Math.ceil(beats / 2) + 1) && subDiv === 1) {
      sound = sounds.half || sounds.beat;
    } else if (beat > 1 && subDiv === 1) {
      sound = sounds.beat;
    } else {
      sound = sounds.subDiv || sounds.beat;
    }

    let relativeVolume = 1.0;
    let clickLength = .05;
    if (Array.isArray(sound)) {
      [sound, relativeVolume, clickLength] = sound;
    }

    const audioObj = this.playSoundAt(sound, time, clickLength, relativeVolume);
    return audioObj;
  }

  removeClickSound(click) {
    click?.obj?.stop(0);
  }

  playSoundAt(sound, time, clickLength, relativeVolume = 1.0) {
    let audioNode;
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
        audioNode.buffer = sound;
      } catch (e) {
        console.error(e);
      }
      audioNode.connect(this.gainNode);
      audioNode.start(time, 0, clickLength);
    }

    this.gainNode.gain.setValueAtTime((this.volume * relativeVolume) / 100, time);
    return audioNode;
  }

  click(t = 0) {
    let sound = this.sounds.user;
    let vol = 1.0;
    if (Array.isArray(sound)) [sound, vol] = sound;

    return this.playSoundAt(sound, t, this.clickLength, vol);
  }
}

async function fetchAudioBuffer(audioContext, filepath) {
  const response = await fetch(filepath);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer;
}
