"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Visualizer = exports.DEFAULT_SOUNDS = exports.Clicker = exports.Metronome = exports.createMetronome = void 0;
const Metronome_1 = require("./Metronome");
const Clicker_1 = require("./Clicker");
// utility method for creating a default metronome/clicker setup
function createMetronome(mOpts, clickerOpts = {}, audioContext = new AudioContext()) {
    const clicker = new Clicker_1.Clicker(Object.assign({ audioContext }, clickerOpts));
    return new Metronome_1.Metronome(Object.assign({ timerFn: () => audioContext.currentTime, clicker }, mOpts));
}
exports.createMetronome = createMetronome;
var Metronome_2 = require("./Metronome");
Object.defineProperty(exports, "Metronome", { enumerable: true, get: function () { return Metronome_2.Metronome; } });
var Clicker_2 = require("./Clicker");
Object.defineProperty(exports, "Clicker", { enumerable: true, get: function () { return Clicker_2.Clicker; } });
Object.defineProperty(exports, "DEFAULT_SOUNDS", { enumerable: true, get: function () { return Clicker_2.DEFAULT_SOUNDS; } });
var Visualizer_1 = require("./Visualizer");
Object.defineProperty(exports, "Visualizer", { enumerable: true, get: function () { return Visualizer_1.Visualizer; } });
