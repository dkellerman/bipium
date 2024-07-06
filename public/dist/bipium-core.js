var Bipium;
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 175:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "Clicker": () => (/* reexport */ Clicker),
  "DEFAULT_SOUNDS": () => (/* reexport */ DEFAULT_SOUNDS),
  "Metronome": () => (/* reexport */ Metronome),
  "Visualizer": () => (/* reexport */ Visualizer),
  "createMetronome": () => (/* binding */ createMetronome)
});

;// CONCATENATED MODULE: ./src/core/lib/esm/Metronome.js
const defaultOptions = {
  bpm: 80,
  beats: 4,
  subDivs: 1,
  swing: 0,
  workerUrl: undefined,
  lookaheadInterval: 0.025,
  scheduleAheadTime: .1,
  startDelayTime: 0.2
};
class Metronome {
  constructor(opts) {
    this.started = false;
    this.startTime = 0;
    this.barStart = 0;
    this.lastBar = 0;
    this.scheduledClicks = [];
    this.opts = {
      ...defaultOptions,
      ...opts
    };
    this.started = false;
    this.next = {
      bar: 0,
      beat: 0,
      beats: this.opts.beats,
      subDiv: 0,
      subDivs: this.opts.subDivs,
      time: 0
    };
    // prep the thread timer
    if (this.opts.workerUrl) {
      this.worker = new Worker(this.opts.workerUrl);
    } else {
      this.worker = new MetronomeWorker();
    }
    this.worker.onmessage = e => {
      if (e.data === 'tick') {
        var _this$opts$onSchedule, _this$opts;
        this.scheduler();
        (_this$opts$onSchedule = (_this$opts = this.opts).onSchedulerTick) === null || _this$opts$onSchedule === void 0 || _this$opts$onSchedule.call(_this$opts);
      }
    };
    this.worker.postMessage({
      interval: this.opts.lookaheadInterval
    });
  }
  start() {
    var _this$opts$onStart, _this$opts2, _this$opts$clicker;
    if (this.started) return;
    this.startTime = this.now + this.opts.startDelayTime;
    this.stopTime = undefined;
    this.barStart = this.startTime;
    this.lastBar = 0;
    this.started = true;
    this.scheduledClicks = [];
    if (this.opts.subDivs % 2 > 0) this.opts.swing = 0;
    this.next = {
      bar: 1,
      beat: 1,
      beats: this.opts.beats,
      subDiv: 1,
      subDivs: this.opts.subDivs,
      time: this.startTime
    };
    this.worker.postMessage('start');
    (_this$opts$onStart = (_this$opts2 = this.opts).onStart) === null || _this$opts$onStart === void 0 || _this$opts$onStart.call(_this$opts2);
    if (((_this$opts$clicker = this.opts.clicker) === null || _this$opts$clicker === void 0 || (_this$opts$clicker = _this$opts$clicker.audioContext) === null || _this$opts$clicker === void 0 ? void 0 : _this$opts$clicker.state) === 'suspended') {
      this.opts.clicker.audioContext.resume();
    }
  }
  stop() {
    var _this$opts$onStop, _this$opts3;
    if (!this.started) return;
    this.stopTime = this.now;
    this.started = false;
    this.worker.postMessage('stop');
    this.unscheduleClicks();
    (_this$opts$onStop = (_this$opts3 = this.opts).onStop) === null || _this$opts$onStop === void 0 || _this$opts$onStop.call(_this$opts3);
  }
  update(_ref) {
    var _this$opts$onUpdateOp, _this$opts4;
    let {
      bpm,
      beats,
      subDivs,
      swing
    } = _ref;
    this.unscheduleClicks();
    if (bpm !== undefined) this.opts.bpm = bpm;
    if (beats !== undefined) this.opts.beats = beats;
    if (subDivs !== undefined) this.opts.subDivs = subDivs;
    if (swing !== undefined) this.opts.swing = swing;
    // recalculate next scheduled beat if bar structure has changed
    if ((bpm !== undefined || beats !== undefined) && this.started && this.scheduledClicks.length) {
      if (this.lastClick) this.next = {
        ...this.lastClick
      };
      while (this.next.time <= this.now - this.subDivTime) {
        this.next.time += this.subDivTime;
      }
      this.advance();
    }
    (_this$opts$onUpdateOp = (_this$opts4 = this.opts).onUpdateOptions) === null || _this$opts$onUpdateOp === void 0 || _this$opts$onUpdateOp.call(_this$opts4, this.opts);
  }
  // main method called by the thread timer when started
  scheduler() {
    if (!this.started) return;
    // update the bar start time for quantization purposes
    const lc = this.lastClick;
    if (lc && (lc.bar || 0) > this.lastBar) {
      this.lastBar = lc.bar;
      this.barStart = lc.time;
    }
    while (this.next.time < this.now + this.opts.scheduleAheadTime) {
      this.scheduleClick();
      this.advance(); // updates this.next.time
    }
  }
  scheduleClick() {
    var _this$opts$clicker2, _this$opts$onNextClic, _this$opts5;
    const click = {
      ...this.next,
      beats: this.opts.beats,
      subDivs: this.opts.subDivs
    };
    // notify clicker to schedule the actual sound - it returns a sound object
    // that we keep around so that if it needs to be cancelled it can be passed
    // to the onUnscheduleClick method
    const obj = (_this$opts$clicker2 = this.opts.clicker) === null || _this$opts$clicker2 === void 0 ? void 0 : _this$opts$clicker2.scheduleClickSound(click);
    (_this$opts$onNextClic = (_this$opts5 = this.opts).onNextClick) === null || _this$opts$onNextClic === void 0 || _this$opts$onNextClic.call(_this$opts5, click);
    this.scheduledClicks.push({
      ...click,
      obj
    });
    // remove old clicks from memory
    const now = this.now;
    this.scheduledClicks = this.scheduledClicks.filter(c => (c === null || c === void 0 ? void 0 : c.time) >= now - 10.0);
  }
  advance() {
    // calculate next click time
    let delta = this.beatTime / this.opts.subDivs;
    if (this.next.subDiv % 2 === 1) {
      delta += delta * (this.opts.swing / 100.0);
    } else {
      delta *= (100.0 - this.opts.swing) / 100.0;
    }
    // advance time
    this.next.time += delta;
    // advance beat counter
    if (this.next.subDiv % this.opts.subDivs === 0) {
      this.next.subDiv = 1;
      this.next.beat++;
      if (this.next.beat > this.opts.beats) {
        this.next.beat = 1;
        this.next.bar++;
      }
    } else {
      this.next.subDiv++;
    }
  }
  unscheduleClicks() {
    this.scheduledClicks = (this.scheduledClicks || []).map(click => {
      if (click.time > this.now) {
        var _this$opts$clicker3, _this$opts$onUnschedu, _this$opts6;
        (_this$opts$clicker3 = this.opts.clicker) === null || _this$opts$clicker3 === void 0 || _this$opts$clicker3.removeClickSound(click);
        (_this$opts$onUnschedu = (_this$opts6 = this.opts).onUnscheduleClick) === null || _this$opts$onUnschedu === void 0 || _this$opts$onUnschedu.call(_this$opts6, click);
        return null;
      }
      return click;
    }).filter(Boolean);
  }
  get now() {
    return this.opts.timerFn();
  }
  get beatTime() {
    return 60.0 / this.opts.bpm;
  }
  get subDivTime() {
    return this.beatTime / this.opts.subDivs;
  }
  get barTime() {
    return this.opts.beats * this.beatTime;
  }
  get totalSubDivs() {
    return this.opts.beats * this.opts.subDivs;
  }
  // relative timestamps for all sub-divisions in a bar
  get gridTimes() {
    const swingTime = this.barTime / this.totalSubDivs * (this.opts.swing / 100) || 0;
    return Array.from(Array(this.totalSubDivs).keys()).map(i => {
      const t = i * (this.barTime / this.totalSubDivs);
      return i % 2 === 1 ? t + swingTime : t;
    });
  }
  get elapsed() {
    return this.now - this.startTime;
  }
  get lastClick() {
    var _this$scheduledClicks;
    const clicks = (_this$scheduledClicks = this.scheduledClicks) === null || _this$scheduledClicks === void 0 ? void 0 : _this$scheduledClicks.filter(c => c.time <= this.now);
    return (clicks === null || clicks === void 0 ? void 0 : clicks[clicks.length - 1]) || null;
  }
  getClickIndex(click, subDivs) {
    if (!click) return -1;
    return (click.bar - 1) * this.opts.beats + (click.beat - 1) * (subDivs !== null && subDivs !== void 0 ? subDivs : this.opts.subDivs) + (click.subDiv - 1);
  }
  getClickBarIndex(click, subDivs) {
    return (click.beat - 1) * (subDivs !== null && subDivs !== void 0 ? subDivs : this.opts.subDivs) + (click.subDiv - 1);
  }
  // returns adjustment required in seconds to make t fall on the nearest grid line
  // toSubDivs - which sub division to quantize to (e.g. 4 = 16th notes)
  quantize(t, toSubDivs) {
    const to = toSubDivs !== null && toSubDivs !== void 0 ? toSubDivs : this.opts.subDivs;
    const timeInBar = t - this.barStart;
    const gridTimes = this.gridTimes.concat([this.barTime]).filter((_, idx) => idx % (this.opts.subDivs / to) === 0);
    const closestSubDivTime = gridTimes.reduce((prev, curr) => Math.abs(curr - timeInBar) < Math.abs(prev - timeInBar) ? curr : prev);
    const amount = closestSubDivTime - timeInBar;
    let closestSubDiv = gridTimes.indexOf(closestSubDivTime);
    if (closestSubDiv === this.opts.beats * to) closestSubDiv = 0;
    closestSubDiv++;
    // console.log(amount, amount > 0 ? 'early' : 'late', 'to', closestSubDiv);
    return [amount, closestSubDiv];
  }
}
// fallback worker, but should use worker.js instead in thread
class MetronomeWorker {
  onmessage(_) {}
  postMessage(data) {
    if (typeof data === 'object' && data.interval) {
      this.interval = data.interval;
      this.clearTimer();
    } else if (data === 'start') {
      this.startTimer();
      this.tick();
    } else if (data === 'stop') {
      this.clearTimer();
    }
  }
  startTimer() {
    if (this.interval) this.timer = setInterval(this.tick.bind(this), this.interval * 1000);
  }
  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  tick() {
    this.onmessage({
      data: 'tick'
    });
  }
}
;// CONCATENATED MODULE: ./src/core/lib/esm/Clicker.js
const DEFAULT_SOUNDS = {
  name: 'Defaults',
  bar: 880.0,
  beat: 440.0,
  subDiv: 220.0,
  user: 660.0
};
;
class Clicker {
  constructor(_ref) {
    let {
      audioContext,
      volume = 100,
      sounds = DEFAULT_SOUNDS
    } = _ref;
    this.sounds = {};
    this.audioContext = audioContext;
    this.volume = volume;
    this.loading = false;
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
    this.setSounds(sounds);
  }
  async setSounds(sounds) {
    this.sounds = await this.fetchSounds(sounds);
  }
  async fetchSounds(sounds) {
    this.loading = true;
    for (const k in sounds) {
      if (k === 'name') continue;
      let sound;
      if (!Array.isArray(sounds[k])) {
        sound = sounds[k];
        sounds[k] = [sound, 1.0, 0.05];
      } else {
        sound = sounds[k][0];
      }
      if (typeof sound === 'string') {
        const buf = await fetchAudioBuffer(this.audioContext, sound);
        sounds[k][0] = buf;
      }
    }
    this.loading = false;
    return sounds;
  }
  setVolume(volume) {
    this.volume = volume;
  }
  scheduleClickSound(_ref2) {
    let {
      time,
      subDiv,
      beat,
      beats
    } = _ref2;
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
    const [soundObj, relativeVolume, clickLength] = sound;
    return this.playSoundAt(soundObj, time, clickLength, relativeVolume);
  }
  removeClickSound(click) {
    var _click$obj;
    click === null || click === void 0 || (_click$obj = click.obj) === null || _click$obj === void 0 || _click$obj.stop(0);
  }
  playSoundAt(sound, time, clickLength) {
    var _this$audioContext;
    let relativeVolume = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 1.0;
    if (((_this$audioContext = this.audioContext) === null || _this$audioContext === void 0 ? void 0 : _this$audioContext.state) === 'suspended') this.audioContext.resume();
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
    this.gainNode.gain.setValueAtTime(this.volume * relativeVolume / 100, time);
    return audioNode;
  }
  click() {
    let t = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
    const [soundObj, vol, length] = this.sounds.user;
    return this.playSoundAt(soundObj, t, length, vol);
  }
}
async function fetchAudioBuffer(audioContext, filepath) {
  const response = await fetch(filepath);
  const arrayBuffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
}
;// CONCATENATED MODULE: ./src/core/lib/esm/Visualizer.js
const Visualizer_defaultOptions = {
  qThreshold: 0.04
};
class Visualizer {
  constructor(opts) {
    this.progress = 0;
    this.lastTime = 0;
    this.savedClick = null;
    this.count = [];
    this.qType = null;
    this.userClicks = [];
    this.opts = {
      ...Visualizer_defaultOptions,
      ...opts
    };
  }
  start() {
    this.progress = 0;
    this.lastTime = 0;
    this.savedClick = this.opts.metronome.lastClick;
    this.count = [];
    this.qType = null;
    this.userClicks = [];
  }
  stop() {
    this.progress = 0;
    this.count = [];
    this.userClicks = [];
    this.savedClick = null;
    this.qType = null;
  }
  update() {
    const {
      savedClick,
      lastTime,
      userClicks
    } = this;
    const m = this.opts.metronome;
    const deltaT = m.elapsed - lastTime;
    Visualizer.frameRate.push(deltaT);
    if (Visualizer.frameRate.length > 100) Visualizer.frameRate.shift();
    if (!m.started || m.elapsed < 0) return;
    const savedClickIdx = m.getClickIndex(savedClick);
    const lastClick = m.lastClick;
    // get last click index based on the saved click's number of sub divs
    const lastClickIdx = m.getClickIndex(lastClick, savedClick === null || savedClick === void 0 ? void 0 : savedClick.subDivs);
    // update now line
    if (lastClick && lastClickIdx > savedClickIdx) {
      this.savedClick = lastClick;
      const lastClickBarIdx = m.getClickBarIndex(lastClick);
      this.progress = 1.0 / m.totalSubDivs * lastClickBarIdx;
      if (lastClickBarIdx % 2 === 1) {
        this.progress += 1.0 / m.totalSubDivs * (m.opts.swing / 100);
      }
    } else {
      const curProgress = this.progress;
      const remProgress = 1.0 - curProgress;
      const remTime = m.barTime * remProgress;
      const perSecond = remProgress / remTime;
      const deltaP = deltaT * perSecond;
      this.progress = (curProgress + deltaP) % 1.0;
      ;
    }
    this.lastTime = m.elapsed;
    // update count
    let beat = (lastClick === null || lastClick === void 0 ? void 0 : lastClick.beat) || 1;
    let sub = (lastClick === null || lastClick === void 0 ? void 0 : lastClick.subDiv) || 1;
    this.count = m.opts.subDivs > 1 ? [beat, sub] : [beat];
    // show timing info for user clicks
    if (userClicks !== null && userClicks !== void 0 && userClicks.length) {
      const t = userClicks.pop();
      while (userClicks.length) userClicks.pop(); // ignore old clicks
      const [qAmount] = m.quantize(t, 1);
      this.qType = getQuantizeType(qAmount, this.opts.qThreshold);
    }
  }
  static get frameRateInfo() {
    const arr = Visualizer.frameRate;
    if (!(arr !== null && arr !== void 0 && arr.length)) return 0;
    const mean = arr.reduce((a, b) => a + b) / arr.length;
    const std = Math.sqrt(arr.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / arr.length);
    return {
      mean,
      std
    };
  }
}
Visualizer.frameRate = [];
function getQuantizeType(q, threshold) {
  if (q <= -1 * threshold) {
    return 'late';
  } else if (q >= threshold) {
    return 'early';
  } else {
    return 'ontime';
  }
}
;// CONCATENATED MODULE: ./src/core/lib/esm/index.js


// utility method for creating a default metronome/clicker setup
function createMetronome(mOpts) {
  let clickerOpts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  let audioContext = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new AudioContext();
  const clicker = new Clicker({
    audioContext,
    ...clickerOpts
  });
  return new Metronome({
    timerFn: () => audioContext.currentTime,
    clicker,
    ...mOpts
  });
}




/***/ }),

/***/ 666:
/***/ ((module) => {

/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var runtime = (function (exports) {
  "use strict";

  var Op = Object.prototype;
  var hasOwn = Op.hasOwnProperty;
  var defineProperty = Object.defineProperty || function (obj, key, desc) { obj[key] = desc.value; };
  var undefined; // More compressible than void 0.
  var $Symbol = typeof Symbol === "function" ? Symbol : {};
  var iteratorSymbol = $Symbol.iterator || "@@iterator";
  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  function define(obj, key, value) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
    return obj[key];
  }
  try {
    // IE 8 has a broken Object.defineProperty that only works on DOM objects.
    define({}, "");
  } catch (err) {
    define = function(obj, key, value) {
      return obj[key] = value;
    };
  }

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
    var generator = Object.create(protoGenerator.prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    defineProperty(generator, "_invoke", { value: makeInvokeMethod(innerFn, self, context) });

    return generator;
  }
  exports.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  // This is a polyfill for %IteratorPrototype% for environments that
  // don't natively support it.
  var IteratorPrototype = {};
  define(IteratorPrototype, iteratorSymbol, function () {
    return this;
  });

  var getProto = Object.getPrototypeOf;
  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
  if (NativeIteratorPrototype &&
      NativeIteratorPrototype !== Op &&
      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
    // This environment has a native %IteratorPrototype%; use it instead
    // of the polyfill.
    IteratorPrototype = NativeIteratorPrototype;
  }

  var Gp = GeneratorFunctionPrototype.prototype =
    Generator.prototype = Object.create(IteratorPrototype);
  GeneratorFunction.prototype = GeneratorFunctionPrototype;
  defineProperty(Gp, "constructor", { value: GeneratorFunctionPrototype, configurable: true });
  defineProperty(
    GeneratorFunctionPrototype,
    "constructor",
    { value: GeneratorFunction, configurable: true }
  );
  GeneratorFunction.displayName = define(
    GeneratorFunctionPrototype,
    toStringTagSymbol,
    "GeneratorFunction"
  );

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      define(prototype, method, function(arg) {
        return this._invoke(method, arg);
      });
    });
  }

  exports.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  exports.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
      define(genFun, toStringTagSymbol, "GeneratorFunction");
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `hasOwn.call(value, "__await")` to determine if the yielded value is
  // meant to be awaited.
  exports.awrap = function(arg) {
    return { __await: arg };
  };

  function AsyncIterator(generator, PromiseImpl) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);
      if (record.type === "throw") {
        reject(record.arg);
      } else {
        var result = record.arg;
        var value = result.value;
        if (value &&
            typeof value === "object" &&
            hasOwn.call(value, "__await")) {
          return PromiseImpl.resolve(value.__await).then(function(value) {
            invoke("next", value, resolve, reject);
          }, function(err) {
            invoke("throw", err, resolve, reject);
          });
        }

        return PromiseImpl.resolve(value).then(function(unwrapped) {
          // When a yielded Promise is resolved, its final value becomes
          // the .value of the Promise<{value,done}> result for the
          // current iteration.
          result.value = unwrapped;
          resolve(result);
        }, function(error) {
          // If a rejected Promise was yielded, throw the rejection back
          // into the async generator function so it can be handled there.
          return invoke("throw", error, resolve, reject);
        });
      }
    }

    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return new PromiseImpl(function(resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : callInvokeWithMethodAndArg();
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    defineProperty(this, "_invoke", { value: enqueue });
  }

  defineIteratorMethods(AsyncIterator.prototype);
  define(AsyncIterator.prototype, asyncIteratorSymbol, function () {
    return this;
  });
  exports.AsyncIterator = AsyncIterator;

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  exports.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
    if (PromiseImpl === void 0) PromiseImpl = Promise;

    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList),
      PromiseImpl
    );

    return exports.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      context.method = method;
      context.arg = arg;

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          var delegateResult = maybeInvokeDelegate(delegate, context);
          if (delegateResult) {
            if (delegateResult === ContinueSentinel) continue;
            return delegateResult;
          }
        }

        if (context.method === "next") {
          // Setting context._sent for legacy support of Babel's
          // function.sent implementation.
          context.sent = context._sent = context.arg;

        } else if (context.method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw context.arg;
          }

          context.dispatchException(context.arg);

        } else if (context.method === "return") {
          context.abrupt("return", context.arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          if (record.arg === ContinueSentinel) {
            continue;
          }

          return {
            value: record.arg,
            done: context.done
          };

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(context.arg) call above.
          context.method = "throw";
          context.arg = record.arg;
        }
      }
    };
  }

  // Call delegate.iterator[context.method](context.arg) and handle the
  // result, either by returning a { value, done } result from the
  // delegate iterator, or by modifying context.method and context.arg,
  // setting context.delegate to null, and returning the ContinueSentinel.
  function maybeInvokeDelegate(delegate, context) {
    var methodName = context.method;
    var method = delegate.iterator[methodName];
    if (method === undefined) {
      // A .throw or .return when the delegate iterator has no .throw
      // method, or a missing .next mehtod, always terminate the
      // yield* loop.
      context.delegate = null;

      // Note: ["return"] must be used for ES3 parsing compatibility.
      if (methodName === "throw" && delegate.iterator["return"]) {
        // If the delegate iterator has a return method, give it a
        // chance to clean up.
        context.method = "return";
        context.arg = undefined;
        maybeInvokeDelegate(delegate, context);

        if (context.method === "throw") {
          // If maybeInvokeDelegate(context) changed context.method from
          // "return" to "throw", let that override the TypeError below.
          return ContinueSentinel;
        }
      }
      if (methodName !== "return") {
        context.method = "throw";
        context.arg = new TypeError(
          "The iterator does not provide a '" + methodName + "' method");
      }

      return ContinueSentinel;
    }

    var record = tryCatch(method, delegate.iterator, context.arg);

    if (record.type === "throw") {
      context.method = "throw";
      context.arg = record.arg;
      context.delegate = null;
      return ContinueSentinel;
    }

    var info = record.arg;

    if (! info) {
      context.method = "throw";
      context.arg = new TypeError("iterator result is not an object");
      context.delegate = null;
      return ContinueSentinel;
    }

    if (info.done) {
      // Assign the result of the finished delegate to the temporary
      // variable specified by delegate.resultName (see delegateYield).
      context[delegate.resultName] = info.value;

      // Resume execution at the desired location (see delegateYield).
      context.next = delegate.nextLoc;

      // If context.method was "throw" but the delegate handled the
      // exception, let the outer generator proceed normally. If
      // context.method was "next", forget context.arg since it has been
      // "consumed" by the delegate iterator. If context.method was
      // "return", allow the original .return call to continue in the
      // outer generator.
      if (context.method !== "return") {
        context.method = "next";
        context.arg = undefined;
      }

    } else {
      // Re-yield the result returned by the delegate method.
      return info;
    }

    // The delegate iterator is finished, so forget it and continue with
    // the outer generator.
    context.delegate = null;
    return ContinueSentinel;
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  define(Gp, toStringTagSymbol, "Generator");

  // A Generator should always return itself as the iterator object when the
  // @@iterator function is called on it. Some browsers' implementations of the
  // iterator prototype chain incorrectly implement this, causing the Generator
  // object to not be returned from this call. This ensures that doesn't happen.
  // See https://github.com/facebook/regenerator/issues/274 for more details.
  define(Gp, iteratorSymbol, function() {
    return this;
  });

  define(Gp, "toString", function() {
    return "[object Generator]";
  });

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  exports.keys = function(val) {
    var object = Object(val);
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  exports.values = values;

  function doneResult() {
    return { value: undefined, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      // Resetting context._sent for legacy support of Babel's
      // function.sent implementation.
      this.sent = this._sent = undefined;
      this.done = false;
      this.delegate = null;

      this.method = "next";
      this.arg = undefined;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;

        if (caught) {
          // If the dispatched exception was caught by a catch block,
          // then let that catch block handle the exception normally.
          context.method = "next";
          context.arg = undefined;
        }

        return !! caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.method = "next";
        this.next = finallyEntry.finallyLoc;
        return ContinueSentinel;
      }

      return this.complete(record);
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = this.arg = record.arg;
        this.method = "return";
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }

      return ContinueSentinel;
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      if (this.method === "next") {
        // Deliberately forget the last sent value so that we don't
        // accidentally pass it on to the delegate.
        this.arg = undefined;
      }

      return ContinueSentinel;
    }
  };

  // Regardless of whether this script is executing as a CommonJS module
  // or not, return the runtime object so that we can declare the variable
  // regeneratorRuntime in the outer scope, which allows this module to be
  // injected easily by `bin/regenerator --include-runtime script.js`.
  return exports;

}(
  // If this script is executing as a CommonJS module, use module.exports
  // as the regeneratorRuntime namespace. Otherwise create a new empty
  // object. Either way, the resulting object will be used to initialize
  // the regeneratorRuntime variable at the top of this file.
   true ? module.exports : 0
));

try {
  regeneratorRuntime = runtime;
} catch (accidentalStrictMode) {
  // This module should not be running in strict mode, so the above
  // assignment should always work unless something is misconfigured. Just
  // in case runtime.js accidentally runs in strict mode, in modern engines
  // we can explicitly access globalThis. In older engines we can escape
  // strict mode using a global Function call. This could conceivably fail
  // if a Content Security Policy forbids using Function, but in that case
  // the proper solution is to fix the accidental strict mode problem. If
  // you've misconfigured your bundler to force strict mode and applied a
  // CSP to forbid Function, and you're not willing to fix either of those
  // problems, please detail your unique predicament in a GitHub issue.
  if (typeof globalThis === "object") {
    globalThis.regeneratorRuntime = runtime;
  } else {
    Function("r", "regeneratorRuntime = r")(runtime);
  }
}


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	__webpack_require__(666);
/******/ 	var __webpack_exports__ = __webpack_require__(175);
/******/ 	Bipium = __webpack_exports__;
/******/ 	
/******/ })()
;