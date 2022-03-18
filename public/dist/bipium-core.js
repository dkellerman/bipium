var Bipium;
/******/ (function() { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 291:
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "Clicker": function() { return /* reexport */ Clicker; },
  "DEFAULT_SOUNDS": function() { return /* reexport */ DEFAULT_SOUNDS; },
  "Metronome": function() { return /* reexport */ Metronome; },
  "Visualizer": function() { return /* reexport */ Visualizer; },
  "createMetronome": function() { return /* binding */ createMetronome; }
});

;// CONCATENATED MODULE: ./src/core/Metronome.js
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }

var Metronome = /*#__PURE__*/function () {
  function Metronome() {
    var _this = this;

    var settings = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Metronome);

    var timerFn = settings.timerFn,
        clicker = settings.clicker,
        _settings$bpm = settings.bpm,
        bpm = _settings$bpm === void 0 ? 80 : _settings$bpm,
        _settings$beats = settings.beats,
        beats = _settings$beats === void 0 ? 4 : _settings$beats,
        _settings$subDivs = settings.subDivs,
        subDivs = _settings$subDivs === void 0 ? 1 : _settings$subDivs,
        _settings$swing = settings.swing,
        swing = _settings$swing === void 0 ? 0 : _settings$swing,
        _settings$workerUrl = settings.workerUrl,
        workerUrl = _settings$workerUrl === void 0 ? null : _settings$workerUrl,
        _settings$onNextClick = settings.onNextClick,
        onNextClick = _settings$onNextClick === void 0 ? function () {} : _settings$onNextClick,
        _settings$onUnschedul = settings.onUnscheduleClick,
        onUnscheduleClick = _settings$onUnschedul === void 0 ? function () {} : _settings$onUnschedul,
        _settings$onStart = settings.onStart,
        onStart = _settings$onStart === void 0 ? function () {} : _settings$onStart,
        _settings$onStop = settings.onStop,
        onStop = _settings$onStop === void 0 ? function () {} : _settings$onStop,
        _settings$onScheduler = settings.onSchedulerTick,
        onSchedulerTick = _settings$onScheduler === void 0 ? function () {} : _settings$onScheduler,
        _settings$lookaheadIn = settings.lookaheadInterval,
        lookaheadInterval = _settings$lookaheadIn === void 0 ? 0.025 : _settings$lookaheadIn,
        _settings$scheduleAhe = settings.scheduleAheadTime,
        scheduleAheadTime = _settings$scheduleAhe === void 0 ? 0.1 : _settings$scheduleAhe,
        _settings$startDelayT = settings.startDelayTime,
        startDelayTime = _settings$startDelayT === void 0 ? 0.2 : _settings$startDelayT;
    this.onStart = onStart;
    this.onStop = onStop;
    this.onNextClick = onNextClick;
    this.onUnscheduleClick = onUnscheduleClick;
    this.onSchedulerTick = onSchedulerTick;
    this.timerFn = timerFn;
    this.clicker = clicker;
    this.lookaheadInterval = lookaheadInterval;
    this.scheduleAheadTime = scheduleAheadTime;
    this.startDelayTime = startDelayTime;
    this.bpm = bpm;
    this.beats = beats;
    this.subDivs = subDivs;
    this.swing = swing;
    this.started = false; // prep the thread timer

    if (workerUrl) {
      this.worker = new Worker(workerUrl);
    } else {
      this.worker = new MetronomeWorker();
    }

    this.worker.onmessage = function (e) {
      if (e.data === 'tick') {
        _this.scheduler();

        _this.onSchedulerTick();
      }
    };

    this.worker.postMessage({
      interval: this.lookaheadInterval
    });
  }

  _createClass(Metronome, [{
    key: "start",
    value: function start() {
      var _this$clicker, _this$clicker$audioCo;

      if (this.started) return;
      this.startTime = this.now + this.startDelayTime;
      this.stopTime = null;
      this.barStart = this.startTime;
      this.lastBar = 0;
      this.started = true;
      this.scheduledClicks = [];
      if (this.subDivs % 2 > 0) this.swing = 0;
      this.next = {
        bar: 1,
        beat: 1,
        subDiv: 1,
        time: this.startTime
      };
      this.worker.postMessage('start');
      this.onStart();

      if (((_this$clicker = this.clicker) === null || _this$clicker === void 0 ? void 0 : (_this$clicker$audioCo = _this$clicker.audioContext) === null || _this$clicker$audioCo === void 0 ? void 0 : _this$clicker$audioCo.state) === 'suspended') {
        this.clicker.audioContext.resume();
      }
    }
  }, {
    key: "stop",
    value: function stop() {
      if (!this.started) return;
      this.stopTime = this.now;
      this.started = false;
      this.worker.postMessage('stop');
      this.unscheduleClicks();
      this.onStop();
    }
  }, {
    key: "update",
    value: function update(_ref) {
      var bpm = _ref.bpm,
          beats = _ref.beats,
          subDivs = _ref.subDivs,
          swing = _ref.swing;
      this.unscheduleClicks();
      if (bpm !== undefined) this.bpm = bpm;
      if (beats !== undefined) this.beats = beats;
      if (subDivs !== undefined) this.subDivs = subDivs;
      if (swing !== undefined) this.swing = swing; // recalculate next scheduled beat if bar structure has changed

      if ((bpm !== undefined || beats !== undefined) && this.started && this.scheduledClicks.length) {
        this.next = _objectSpread({}, this.lastClick);

        while (this.next.time <= this.now - this.subDivTime) {
          this.next.time += this.subDivTime;
        }

        this.advance();
      }
    } // main method called by the thread timer when started

  }, {
    key: "scheduler",
    value: function scheduler() {
      if (!this.started) return; // update the bar start time for quantization purposes

      var lc = this.lastClick;

      if (((lc === null || lc === void 0 ? void 0 : lc.bar) || 0) > this.lastBar) {
        this.lastBar = lc.bar;
        this.barStart = lc.time;
      }

      while (this.next.time < this.now + this.scheduleAheadTime) {
        this.scheduleClick();
        this.advance(); // updates this.next.time
      }
    }
  }, {
    key: "scheduleClick",
    value: function scheduleClick() {
      var _this$clicker2;

      var click = _objectSpread(_objectSpread({}, this.next), {}, {
        beats: this.beats,
        subDivs: this.subDivs
      }); // notify clicker to schedule the actual sound - it returns a sound object
      // that we keep around so that if it needs to be cancelled it can be passed
      // to the onUnscheduleClick method


      var obj = (_this$clicker2 = this.clicker) === null || _this$clicker2 === void 0 ? void 0 : _this$clicker2.scheduleClickSound(click);
      this.onNextClick(click);
      this.scheduledClicks.push(_objectSpread(_objectSpread({}, click), {}, {
        obj: obj
      })); // remove old clicks from memory

      var now = this.now;
      this.scheduledClicks = this.scheduledClicks.filter(function (c) {
        return (c === null || c === void 0 ? void 0 : c.time) >= now - 10.0;
      });
    }
  }, {
    key: "advance",
    value: function advance() {
      // calculate next click time
      var delta = this.beatTime / this.subDivs;

      if (this.next.subDiv % 2 === 1) {
        delta += delta * (this.swing / 100.0);
      } else {
        delta *= (100.0 - this.swing) / 100.0;
      } // advance time


      this.next.time += delta; // advance beat counter

      if (this.next.subDiv % this.subDivs === 0) {
        this.next.subDiv = 1;
        this.next.beat++;

        if (this.next.beat > this.beats) {
          this.next.beat = 1;
          this.next.bar++;
        }
      } else {
        this.next.subDiv++;
      }
    }
  }, {
    key: "unscheduleClicks",
    value: function unscheduleClicks() {
      var _this2 = this;

      this.scheduledClicks = (this.scheduledClicks || []).map(function (click) {
        if (click.time > _this2.now) {
          var _this2$clicker;

          (_this2$clicker = _this2.clicker) === null || _this2$clicker === void 0 ? void 0 : _this2$clicker.removeClickSound(click);

          _this2.onUnscheduleClick(click);

          return null;
        }

        return click;
      }).filter(Boolean);
    }
  }, {
    key: "now",
    get: function get() {
      return this.timerFn();
    }
  }, {
    key: "beatTime",
    get: function get() {
      return 60.0 / this.bpm;
    }
  }, {
    key: "subDivTime",
    get: function get() {
      return this.beatTime / this.subDivs;
    }
  }, {
    key: "barTime",
    get: function get() {
      return this.beats * this.beatTime;
    }
  }, {
    key: "totalSubDivs",
    get: function get() {
      return this.beats * this.subDivs;
    } // relative timestamps for all sub-divisions in a bar

  }, {
    key: "gridTimes",
    get: function get() {
      var _this3 = this;

      var swingTime = this.barTime / this.totalSubDivs * (this.swing / 100) || 0;
      return _toConsumableArray(Array(this.totalSubDivs).keys()).map(function (i) {
        var t = i * (_this3.barTime / _this3.totalSubDivs);
        return i % 2 === 1 ? t + swingTime : t;
      });
    }
  }, {
    key: "elapsed",
    get: function get() {
      return this.now - this.startTime;
    }
  }, {
    key: "lastClick",
    get: function get() {
      var _this$scheduledClicks,
          _this4 = this;

      var clicks = (_this$scheduledClicks = this.scheduledClicks) === null || _this$scheduledClicks === void 0 ? void 0 : _this$scheduledClicks.filter(function (c) {
        return c.time <= _this4.now;
      });
      return clicks === null || clicks === void 0 ? void 0 : clicks[clicks.length - 1];
    }
  }, {
    key: "getClickIndex",
    value: function getClickIndex(click) {
      var subDivs = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      return (click.bar - 1) * this.beats + (click.beat - 1) * (subDivs !== null && subDivs !== void 0 ? subDivs : this.subDivs) + (click.subDiv - 1);
    }
  }, {
    key: "getClickBarIndex",
    value: function getClickBarIndex(click) {
      var subDivs = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      return (click.beat - 1) * (subDivs !== null && subDivs !== void 0 ? subDivs : this.subDivs) + (click.subDiv - 1);
    } // returns adjustment required in seconds to make t fall on the nearest grid line
    // toSubDivs - which sub division to quantize to (e.g. 4 = 16th notes)

  }, {
    key: "quantize",
    value: function quantize(t) {
      var _this5 = this;

      var toSubDivs = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      var to = toSubDivs || this.subDivs;
      var timeInBar = t - this.barStart;
      var gridTimes = this.gridTimes.concat([this.barTime]).filter(function (_, idx) {
        return idx % (_this5.subDivs / to) === 0;
      });
      var closestSubDivTime = gridTimes.reduce(function (prev, curr) {
        return Math.abs(curr - timeInBar) < Math.abs(prev - timeInBar) ? curr : prev;
      });
      var amount = closestSubDivTime - timeInBar;
      var closestSubDiv = gridTimes.indexOf(closestSubDivTime);
      if (closestSubDiv === this.beats * to) closestSubDiv = 0;
      closestSubDiv++; // console.log(amount, amount > 0 ? 'early' : 'late', 'to', closestSubDiv);

      return [amount, closestSubDiv];
    }
  }]);

  return Metronome;
}(); // fallback worker, but should use worker.js instead in thread

var MetronomeWorker = /*#__PURE__*/function () {
  function MetronomeWorker() {
    _classCallCheck(this, MetronomeWorker);

    _defineProperty(this, "interval", void 0);

    _defineProperty(this, "timer", void 0);
  }

  _createClass(MetronomeWorker, [{
    key: "onmessage",
    value: function onmessage() {}
  }, {
    key: "postMessage",
    value: function postMessage(data) {
      if (data.interval) {
        this.interval = data.interval;
        this.clearTimer();
      } else if (data === 'start') {
        this.startTimer();
        this.tick();
      } else if (data === 'stop') {
        this.clearTimer();
      }
    }
  }, {
    key: "startTimer",
    value: function startTimer() {
      this.timer = setInterval(this.tick.bind(this), this.interval * 1000);
    }
  }, {
    key: "clearTimer",
    value: function clearTimer() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  }, {
    key: "tick",
    value: function tick() {
      this.onmessage({
        data: 'tick'
      });
    }
  }]);

  return MetronomeWorker;
}();
;// CONCATENATED MODULE: ./src/core/Clicker.js
function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || Clicker_unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function Clicker_unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return Clicker_arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return Clicker_arrayLikeToArray(o, minLen); }

function Clicker_arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function Clicker_classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function Clicker_defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function Clicker_createClass(Constructor, protoProps, staticProps) { if (protoProps) Clicker_defineProperties(Constructor.prototype, protoProps); if (staticProps) Clicker_defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }

var DEFAULT_SOUNDS = {
  name: 'Defaults',
  bar: 880.0,
  beat: 440.0,
  subDiv: 220.0,
  user: 660.0
};
var Clicker = /*#__PURE__*/function () {
  function Clicker(_ref) {
    var audioContext = _ref.audioContext,
        _ref$volume = _ref.volume,
        volume = _ref$volume === void 0 ? 100 : _ref$volume,
        _ref$sounds = _ref.sounds,
        sounds = _ref$sounds === void 0 ? DEFAULT_SOUNDS : _ref$sounds;

    Clicker_classCallCheck(this, Clicker);

    this.audioContext = audioContext;
    this.volume = volume;
    this.loading = false;
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
    this.setSounds(sounds);
  }

  Clicker_createClass(Clicker, [{
    key: "setSounds",
    value: function () {
      var _setSounds = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(sounds) {
        var result;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return this.fetchSounds(sounds);

              case 2:
                result = _context.sent;
                this.sounds = result;

              case 4:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function setSounds(_x) {
        return _setSounds.apply(this, arguments);
      }

      return setSounds;
    }()
  }, {
    key: "fetchSounds",
    value: function () {
      var _fetchSounds = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(sounds) {
        var k, _sounds$k, sound;

        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                this.loading = true;
                _context2.t0 = regeneratorRuntime.keys(sounds);

              case 2:
                if ((_context2.t1 = _context2.t0()).done) {
                  _context2.next = 14;
                  break;
                }

                k = _context2.t1.value;

                if (!(k === 'name')) {
                  _context2.next = 6;
                  break;
                }

                return _context2.abrupt("continue", 2);

              case 6:
                if (!Array.isArray(sounds[k])) sounds[k] = [sounds[k], 1.0, 0.05];
                _sounds$k = _slicedToArray(sounds[k], 1), sound = _sounds$k[0];

                if (!(typeof sound === 'string')) {
                  _context2.next = 12;
                  break;
                }

                _context2.next = 11;
                return fetchAudioBuffer(this.audioContext, sound);

              case 11:
                sounds[k][0] = _context2.sent;

              case 12:
                _context2.next = 2;
                break;

              case 14:
                this.loading = false;
                return _context2.abrupt("return", sounds);

              case 16:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function fetchSounds(_x2) {
        return _fetchSounds.apply(this, arguments);
      }

      return fetchSounds;
    }()
  }, {
    key: "setVolume",
    value: function setVolume(volume) {
      this.volume = volume;
    }
  }, {
    key: "scheduleClickSound",
    value: function scheduleClickSound(_ref2) {
      var time = _ref2.time,
          subDiv = _ref2.subDiv,
          beat = _ref2.beat,
          beats = _ref2.beats;
      // console.log('sch click', beat, subDiv, this.volume);
      if (this.loading) return;
      var sound;
      var sounds = this.sounds;

      if (beat === 1 && subDiv === 1) {
        sound = sounds.bar || sounds.beat;
      } else if (beat === Math.ceil(beats / 2) + 1 && subDiv === 1) {
        sound = sounds.half || sounds.beat;
      } else if (beat > 1 && subDiv === 1) {
        sound = sounds.beat;
      } else {
        sound = sounds.subDiv || sounds.beat;
      }

      var _sound = sound,
          _sound2 = _slicedToArray(_sound, 3),
          soundObj = _sound2[0],
          relativeVolume = _sound2[1],
          clickLength = _sound2[2];

      var audioObj = this.playSoundAt(soundObj, time, clickLength, relativeVolume);
      return audioObj;
    }
  }, {
    key: "removeClickSound",
    value: function removeClickSound(click) {
      var _click$obj;

      click === null || click === void 0 ? void 0 : (_click$obj = click.obj) === null || _click$obj === void 0 ? void 0 : _click$obj.stop(0);
    }
  }, {
    key: "playSoundAt",
    value: function playSoundAt(sound, time, clickLength) {
      var _this$audioContext;

      var relativeVolume = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 1.0;
      if (((_this$audioContext = this.audioContext) === null || _this$audioContext === void 0 ? void 0 : _this$audioContext.state) === 'suspended') this.audioContext.resume();
      var audioNode;

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
  }, {
    key: "click",
    value: function click() {
      var t = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      var _this$sounds$user = _slicedToArray(this.sounds.user, 3),
          soundObj = _this$sounds$user[0],
          vol = _this$sounds$user[1],
          length = _this$sounds$user[2];

      return this.playSoundAt(soundObj, t, length, vol);
    }
  }]);

  return Clicker;
}();

function fetchAudioBuffer(_x3, _x4) {
  return _fetchAudioBuffer.apply(this, arguments);
}

function _fetchAudioBuffer() {
  _fetchAudioBuffer = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(audioContext, filepath) {
    var response, arrayBuffer, audioBuffer;
    return regeneratorRuntime.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return fetch(filepath);

          case 2:
            response = _context3.sent;
            _context3.next = 5;
            return response.arrayBuffer();

          case 5:
            arrayBuffer = _context3.sent;
            _context3.next = 8;
            return audioContext.decodeAudioData(arrayBuffer);

          case 8:
            audioBuffer = _context3.sent;
            return _context3.abrupt("return", audioBuffer);

          case 10:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3);
  }));
  return _fetchAudioBuffer.apply(this, arguments);
}
;// CONCATENATED MODULE: ./src/core/Visualizer.js
function Visualizer_slicedToArray(arr, i) { return Visualizer_arrayWithHoles(arr) || Visualizer_iterableToArrayLimit(arr, i) || Visualizer_unsupportedIterableToArray(arr, i) || Visualizer_nonIterableRest(); }

function Visualizer_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function Visualizer_unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return Visualizer_arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return Visualizer_arrayLikeToArray(o, minLen); }

function Visualizer_arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function Visualizer_iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function Visualizer_arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function Visualizer_classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function Visualizer_defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function Visualizer_createClass(Constructor, protoProps, staticProps) { if (protoProps) Visualizer_defineProperties(Constructor.prototype, protoProps); if (staticProps) Visualizer_defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }

function Visualizer_defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Visualizer = /*#__PURE__*/function () {
  function Visualizer(_ref) {
    var metronome = _ref.metronome,
        _ref$qThreshold = _ref.qThreshold,
        qThreshold = _ref$qThreshold === void 0 ? 0.04 : _ref$qThreshold;

    Visualizer_classCallCheck(this, Visualizer);

    this.m = metronome;
    this.qThreshold = qThreshold;
  }

  Visualizer_createClass(Visualizer, [{
    key: "start",
    value: function start() {
      this.progress = 0;
      this.lastTime = 0;
      this.savedClick = this.m.lastClick || {};
      this.count = [];
      this.qType = null;
      this.userClicks = [];
    }
  }, {
    key: "stop",
    value: function stop() {
      this.progress = 0;
      this.count = [];
      this.userClicks = [];
      this.savedClick = null;
      this.qType = null;
    }
  }, {
    key: "update",
    value: function update() {
      var m = this.m,
          savedClick = this.savedClick,
          lastTime = this.lastTime,
          userClicks = this.userClicks,
          qThreshold = this.qThreshold;
      var deltaT = m.elapsed - lastTime;
      Visualizer.frameRate.push(deltaT);
      if (Visualizer.frameRate.length > 100) Visualizer.frameRate.shift();
      if (!m.started || m.elapsed < 0) return;
      var savedClickIdx = m.getClickIndex(savedClick || {}) || 0;
      var lastClick = m.lastClick || {}; // get last click index based on the saved click's number of sub divs

      var lastClickIdx = m.getClickIndex(lastClick, savedClick.subDivs); // update now line

      if (lastClickIdx > savedClickIdx) {
        this.savedClick = lastClick;
        var lastClickBarIdx = m.getClickBarIndex(lastClick);
        this.progress = 1.0 / m.totalSubDivs * lastClickBarIdx;

        if (lastClickBarIdx % 2 === 1) {
          this.progress += 1.0 / m.totalSubDivs * (m.swing / 100);
        }
      } else {
        var curProgress = this.progress;
        var remProgress = 1.0 - curProgress;
        var remTime = m.barTime * remProgress;
        var perSecond = remProgress / remTime;
        var deltaP = deltaT * perSecond;
        var newProgress = (curProgress + deltaP) % 1.0;
        this.progress = newProgress;
      }

      this.lastTime = m.elapsed; // update count

      var beat = lastClick.beat || 1;
      var sub = lastClick.subDiv || 1;
      this.count = m.subDivs > 1 ? [beat, sub] : [beat]; // show timing info for user clicks

      if (userClicks !== null && userClicks !== void 0 && userClicks.length) {
        var t = userClicks.pop();

        while (userClicks.length) {
          userClicks.pop();
        } // ignore old clicks


        var _m$quantize = m.quantize(t, 1),
            _m$quantize2 = Visualizer_slicedToArray(_m$quantize, 1),
            qAmount = _m$quantize2[0];

        this.qType = getQuantizeType(qAmount, qThreshold);
      }
    }
  }], [{
    key: "frameRateInfo",
    get: function get() {
      var arr = Visualizer.frameRate;
      if (!(arr !== null && arr !== void 0 && arr.length)) return 0;
      var mean = arr.reduce(function (a, b) {
        return a + b;
      }) / arr.length;
      var std = Math.sqrt(arr.map(function (x) {
        return Math.pow(x - mean, 2);
      }).reduce(function (a, b) {
        return a + b;
      }) / arr.length);
      return {
        mean: mean,
        std: std
      };
    }
  }]);

  return Visualizer;
}();

Visualizer_defineProperty(Visualizer, "frameRate", []);

function getQuantizeType(q, threshold) {
  if (q <= -1 * threshold) {
    return 'late';
  } else if (q >= threshold) {
    return 'early';
  } else {
    return 'ontime';
  }
}
;// CONCATENATED MODULE: ./src/core/index.js
function core_ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function core_objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? core_ownKeys(Object(source), !0).forEach(function (key) { core_defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : core_ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }

function core_defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }


 // utility method for creating a default metronome/clicker setup

function createMetronome() {
  var mSettings = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var clickerSettings = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var audioContext = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new AudioContext();
  var clicker = new Clicker(core_objectSpread({
    audioContext: audioContext
  }, clickerSettings));
  return new Metronome(core_objectSpread({
    timerFn: function timerFn() {
      return audioContext.currentTime;
    },
    clicker: clicker
  }, mSettings));
}




/***/ }),

/***/ 666:
/***/ (function(module) {

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
    generator._invoke = makeInvokeMethod(innerFn, self, context);

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
  define(Gp, "constructor", GeneratorFunctionPrototype);
  define(GeneratorFunctionPrototype, "constructor", GeneratorFunction);
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
    this._invoke = enqueue;
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
    var method = delegate.iterator[context.method];
    if (method === undefined) {
      // A .throw or .return when the delegate iterator has no .throw
      // method always terminates the yield* loop.
      context.delegate = null;

      if (context.method === "throw") {
        // Note: ["return"] must be used for ES3 parsing compatibility.
        if (delegate.iterator["return"]) {
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

        context.method = "throw";
        context.arg = new TypeError(
          "The iterator does not provide a 'throw' method");
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

  exports.keys = function(object) {
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
/******/ 	!function() {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = function(exports, definition) {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	!function() {
/******/ 		__webpack_require__.o = function(obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop); }
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	!function() {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = function(exports) {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	}();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	__webpack_require__(666);
/******/ 	var __webpack_exports__ = __webpack_require__(291);
/******/ 	Bipium = __webpack_exports__;
/******/ 	
/******/ })()
;