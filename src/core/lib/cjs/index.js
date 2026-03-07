"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DRUM_LOOP_LANES = exports.Visualizer = exports.DEFAULT_SOUNDS = exports.Clicker = exports.Metronome = void 0;
exports.createMetronome = createMetronome;
const Metronome_1 = require("./Metronome");
const Clicker_1 = require("./Clicker");
// utility method for creating a default metronome/clicker setup
function createMetronome(mOpts, clickerOpts = {}, audioContext = new AudioContext()) {
    const clicker = new Clicker_1.Clicker(Object.assign({ audioContext }, clickerOpts));
    return new Metronome_1.Metronome(Object.assign({ timerFn: () => audioContext.currentTime, clicker }, mOpts));
}
var Metronome_2 = require("./Metronome");
Object.defineProperty(exports, "Metronome", { enumerable: true, get: function () { return Metronome_2.Metronome; } });
var Clicker_2 = require("./Clicker");
Object.defineProperty(exports, "Clicker", { enumerable: true, get: function () { return Clicker_2.Clicker; } });
Object.defineProperty(exports, "DEFAULT_SOUNDS", { enumerable: true, get: function () { return Clicker_2.DEFAULT_SOUNDS; } });
var Visualizer_1 = require("./Visualizer");
Object.defineProperty(exports, "Visualizer", { enumerable: true, get: function () { return Visualizer_1.Visualizer; } });
var types_1 = require("./types");
Object.defineProperty(exports, "DRUM_LOOP_LANES", { enumerable: true, get: function () { return types_1.DRUM_LOOP_LANES; } });
__exportStar(require("./api"), exports);
