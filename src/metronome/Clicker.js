export const DEFAULT_SOUNDS = {
  name: 'Defaults',
  bar: 880.0,
  beat: 440.0,
  subDiv: 220.0,
  user: 660.0,
};

export class Clicker {
  constructor({ audioContext, volume = 100, sounds = DEFAULT_SOUNDS, defaultClickLength = 0.05 }) {
    this.volume = volume;
    this.audioContext = audioContext;
    this.clickLength = defaultClickLength;
    this.loading = false;
    this.setSounds(sounds);
  }

  async setSounds(sounds) {
    const result = await this.fetchSounds(sounds);
    this.sounds = result;
  }

  async fetchSounds(sounds) {
    this.loading = true;
    for (const k in sounds) {
      if (k !== 'name' && typeof sounds[k] === 'string') {
        sounds[k] = await fetchAudioBuffer(this.audioContext, sounds[k]);
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
    } else if (beat === beats / 2 + 1 && subDiv === 1) {
      sound = sounds.half || sounds.beat;
    } else if (beat > 1 && subDiv === 1) {
      sound = sounds.beat;
    } else {
      sound = sounds.subDiv || sounds.beat;
    }

    const audioObj = this.playSoundAt(sound, time, this.clickLength);
    return audioObj;
  }

  removeClickSound(click) {
    click?.obj?.stop(0);
  }

  playSoundAt(sound, time, clickLength) {
    const gainNode = this.audioContext.createGain();
    gainNode.connect(this.audioContext.destination);
    gainNode.gain.setValueAtTime(this.volume / 100, time);

    let audio;
    if (typeof sound === 'number') {
      // freq
      audio = this.audioContext.createOscillator();
      audio.connect(gainNode);
      audio.frequency.value = sound;
      audio.start(time);
      audio.stop(time + clickLength);
    } else {
      // buffer
      audio = this.audioContext.createBufferSource();
      try {
        audio.buffer = sound;
      } catch (e) {
        console.error(e);
      }
      audio.connect(gainNode);
      audio.start(time, 0, clickLength);
    }
    return audio;
  }

  click(t = 0) {
    return this.playSoundAt(this.sounds.user, t, this.clickLength);
  }
}

async function fetchAudioBuffer(audioContext, filepath) {
  const response = await fetch(filepath);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer;
}
