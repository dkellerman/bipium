"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Clicker = exports.DEFAULT_SOUNDS = void 0;
exports.DEFAULT_SOUNDS = {
    name: 'Defaults',
    bar: 880.0,
    beat: 440.0,
    subDiv: 220.0,
    user: 660.0,
};
;
class Clicker {
    constructor({ audioContext, volume = 100, sounds = exports.DEFAULT_SOUNDS }) {
        this.sounds = {};
        this.audioContext = audioContext;
        this.volume = volume;
        this.loading = false;
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        this.setSounds(sounds);
    }
    setSounds(sounds) {
        return __awaiter(this, void 0, void 0, function* () {
            this.sounds = yield this.fetchSounds(sounds);
        });
    }
    fetchSounds(sounds) {
        return __awaiter(this, void 0, void 0, function* () {
            this.loading = true;
            for (const k in sounds) {
                if (k === 'name')
                    continue;
                let sound;
                if (!Array.isArray(sounds[k])) {
                    sound = sounds[k];
                    sounds[k] = [sound, 1.0, 0.05];
                }
                else {
                    sound = sounds[k][0];
                }
                if (typeof sound === 'string') {
                    const buf = yield fetchAudioBuffer(this.audioContext, sound);
                    sounds[k][0] = buf;
                }
            }
            this.loading = false;
            return sounds;
        });
    }
    setVolume(volume) {
        this.volume = volume;
    }
    scheduleClickSound({ time, subDiv, beat, beats }) {
        // console.log('sch click', beat, subDiv, this.volume);
        if (this.loading)
            return;
        let sound;
        const sounds = this.sounds;
        if (beat === 1 && subDiv === 1) {
            sound = sounds.bar || sounds.beat;
        }
        else if (beat === Math.ceil(beats / 2) + 1 && subDiv === 1) {
            sound = sounds.half || sounds.beat;
        }
        else if (beat > 1 && subDiv === 1) {
            sound = sounds.beat;
        }
        else {
            sound = sounds.subDiv || sounds.beat;
        }
        const [soundObj, relativeVolume, clickLength] = sound;
        return this.playSoundAt(soundObj, time, clickLength, relativeVolume);
    }
    removeClickSound(click) {
        var _a;
        (_a = click === null || click === void 0 ? void 0 : click.obj) === null || _a === void 0 ? void 0 : _a.stop(0);
    }
    playSoundAt(sound, time, clickLength, relativeVolume = 1.0) {
        var _a;
        if (((_a = this.audioContext) === null || _a === void 0 ? void 0 : _a.state) === 'suspended')
            this.audioContext.resume();
        let audioNode;
        if (typeof sound === 'number') {
            // freq
            audioNode = this.audioContext.createOscillator();
            audioNode.connect(this.gainNode);
            audioNode.frequency.value = sound;
            audioNode.start(time);
            audioNode.stop(time + clickLength);
        }
        else {
            // buffer
            audioNode = this.audioContext.createBufferSource();
            try {
                audioNode.buffer = sound;
            }
            catch (e) {
                console.error(e);
            }
            audioNode.connect(this.gainNode);
            audioNode.start(time, 0, clickLength);
        }
        this.gainNode.gain.setValueAtTime((this.volume * relativeVolume) / 100, time);
        return audioNode;
    }
    click(t = 0) {
        const [soundObj, vol, length] = this.sounds.user;
        return this.playSoundAt(soundObj, t, length, vol);
    }
}
exports.Clicker = Clicker;
function fetchAudioBuffer(audioContext, filepath) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetch(filepath);
        const arrayBuffer = yield response.arrayBuffer();
        return yield audioContext.decodeAudioData(arrayBuffer);
    });
}
