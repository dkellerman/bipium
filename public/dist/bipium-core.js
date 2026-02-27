(function(exports) {
  "use strict";
  var runtime = { exports: {} };
  var hasRequiredRuntime;
  function requireRuntime() {
    if (hasRequiredRuntime) return runtime.exports;
    hasRequiredRuntime = 1;
    (function(module) {
      var runtime2 = (function(exports$1) {
        var Op = Object.prototype;
        var hasOwn = Op.hasOwnProperty;
        var undefined$1;
        var $Symbol = typeof Symbol === "function" ? Symbol : {};
        var iteratorSymbol = $Symbol.iterator || "@@iterator";
        var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
        var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";
        function define(obj, key, value) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
          return obj[key];
        }
        try {
          define({}, "");
        } catch (err) {
          define = function(obj, key, value) {
            return obj[key] = value;
          };
        }
        function wrap(innerFn, outerFn, self, tryLocsList) {
          var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
          var generator = Object.create(protoGenerator.prototype);
          var context = new Context(tryLocsList || []);
          generator._invoke = makeInvokeMethod(innerFn, self, context);
          return generator;
        }
        exports$1.wrap = wrap;
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
        var ContinueSentinel = {};
        function Generator() {
        }
        function GeneratorFunction() {
        }
        function GeneratorFunctionPrototype() {
        }
        var IteratorPrototype = {};
        define(IteratorPrototype, iteratorSymbol, function() {
          return this;
        });
        var getProto = Object.getPrototypeOf;
        var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
        if (NativeIteratorPrototype && NativeIteratorPrototype !== Op && hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
          IteratorPrototype = NativeIteratorPrototype;
        }
        var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(IteratorPrototype);
        GeneratorFunction.prototype = GeneratorFunctionPrototype;
        define(Gp, "constructor", GeneratorFunctionPrototype);
        define(GeneratorFunctionPrototype, "constructor", GeneratorFunction);
        GeneratorFunction.displayName = define(
          GeneratorFunctionPrototype,
          toStringTagSymbol,
          "GeneratorFunction"
        );
        function defineIteratorMethods(prototype) {
          ["next", "throw", "return"].forEach(function(method) {
            define(prototype, method, function(arg) {
              return this._invoke(method, arg);
            });
          });
        }
        exports$1.isGeneratorFunction = function(genFun) {
          var ctor = typeof genFun === "function" && genFun.constructor;
          return ctor ? ctor === GeneratorFunction || // For the native GeneratorFunction constructor, the best we can
          // do is to check its .name property.
          (ctor.displayName || ctor.name) === "GeneratorFunction" : false;
        };
        exports$1.mark = function(genFun) {
          if (Object.setPrototypeOf) {
            Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
          } else {
            genFun.__proto__ = GeneratorFunctionPrototype;
            define(genFun, toStringTagSymbol, "GeneratorFunction");
          }
          genFun.prototype = Object.create(Gp);
          return genFun;
        };
        exports$1.awrap = function(arg) {
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
              if (value && typeof value === "object" && hasOwn.call(value, "__await")) {
                return PromiseImpl.resolve(value.__await).then(function(value2) {
                  invoke("next", value2, resolve, reject);
                }, function(err) {
                  invoke("throw", err, resolve, reject);
                });
              }
              return PromiseImpl.resolve(value).then(function(unwrapped) {
                result.value = unwrapped;
                resolve(result);
              }, function(error) {
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
            return previousPromise = // If enqueue has been called before, then we want to wait until
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
          this._invoke = enqueue;
        }
        defineIteratorMethods(AsyncIterator.prototype);
        define(AsyncIterator.prototype, asyncIteratorSymbol, function() {
          return this;
        });
        exports$1.AsyncIterator = AsyncIterator;
        exports$1.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
          if (PromiseImpl === void 0) PromiseImpl = Promise;
          var iter = new AsyncIterator(
            wrap(innerFn, outerFn, self, tryLocsList),
            PromiseImpl
          );
          return exports$1.isGeneratorFunction(outerFn) ? iter : iter.next().then(function(result) {
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
                state = context.done ? GenStateCompleted : GenStateSuspendedYield;
                if (record.arg === ContinueSentinel) {
                  continue;
                }
                return {
                  value: record.arg,
                  done: context.done
                };
              } else if (record.type === "throw") {
                state = GenStateCompleted;
                context.method = "throw";
                context.arg = record.arg;
              }
            }
          };
        }
        function maybeInvokeDelegate(delegate, context) {
          var method = delegate.iterator[context.method];
          if (method === undefined$1) {
            context.delegate = null;
            if (context.method === "throw") {
              if (delegate.iterator["return"]) {
                context.method = "return";
                context.arg = undefined$1;
                maybeInvokeDelegate(delegate, context);
                if (context.method === "throw") {
                  return ContinueSentinel;
                }
              }
              context.method = "throw";
              context.arg = new TypeError(
                "The iterator does not provide a 'throw' method"
              );
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
          if (!info) {
            context.method = "throw";
            context.arg = new TypeError("iterator result is not an object");
            context.delegate = null;
            return ContinueSentinel;
          }
          if (info.done) {
            context[delegate.resultName] = info.value;
            context.next = delegate.nextLoc;
            if (context.method !== "return") {
              context.method = "next";
              context.arg = undefined$1;
            }
          } else {
            return info;
          }
          context.delegate = null;
          return ContinueSentinel;
        }
        defineIteratorMethods(Gp);
        define(Gp, toStringTagSymbol, "Generator");
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
          this.tryEntries = [{ tryLoc: "root" }];
          tryLocsList.forEach(pushTryEntry, this);
          this.reset(true);
        }
        exports$1.keys = function(object) {
          var keys = [];
          for (var key in object) {
            keys.push(key);
          }
          keys.reverse();
          return function next() {
            while (keys.length) {
              var key2 = keys.pop();
              if (key2 in object) {
                next.value = key2;
                next.done = false;
                return next;
              }
            }
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
              var i = -1, next = function next2() {
                while (++i < iterable.length) {
                  if (hasOwn.call(iterable, i)) {
                    next2.value = iterable[i];
                    next2.done = false;
                    return next2;
                  }
                }
                next2.value = undefined$1;
                next2.done = true;
                return next2;
              };
              return next.next = next;
            }
          }
          return { next: doneResult };
        }
        exports$1.values = values;
        function doneResult() {
          return { value: undefined$1, done: true };
        }
        Context.prototype = {
          constructor: Context,
          reset: function(skipTempReset) {
            this.prev = 0;
            this.next = 0;
            this.sent = this._sent = undefined$1;
            this.done = false;
            this.delegate = null;
            this.method = "next";
            this.arg = undefined$1;
            this.tryEntries.forEach(resetTryEntry);
            if (!skipTempReset) {
              for (var name in this) {
                if (name.charAt(0) === "t" && hasOwn.call(this, name) && !isNaN(+name.slice(1))) {
                  this[name] = undefined$1;
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
                context.method = "next";
                context.arg = undefined$1;
              }
              return !!caught;
            }
            for (var i = this.tryEntries.length - 1; i >= 0; --i) {
              var entry = this.tryEntries[i];
              var record = entry.completion;
              if (entry.tryLoc === "root") {
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
              if (entry.tryLoc <= this.prev && hasOwn.call(entry, "finallyLoc") && this.prev < entry.finallyLoc) {
                var finallyEntry = entry;
                break;
              }
            }
            if (finallyEntry && (type === "break" || type === "continue") && finallyEntry.tryLoc <= arg && arg <= finallyEntry.finallyLoc) {
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
            if (record.type === "break" || record.type === "continue") {
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
            throw new Error("illegal catch attempt");
          },
          delegateYield: function(iterable, resultName, nextLoc) {
            this.delegate = {
              iterator: values(iterable),
              resultName,
              nextLoc
            };
            if (this.method === "next") {
              this.arg = undefined$1;
            }
            return ContinueSentinel;
          }
        };
        return exports$1;
      })(
        // If this script is executing as a CommonJS module, use module.exports
        // as the regeneratorRuntime namespace. Otherwise create a new empty
        // object. Either way, the resulting object will be used to initialize
        // the regeneratorRuntime variable at the top of this file.
        module.exports
      );
      try {
        regeneratorRuntime = runtime2;
      } catch (accidentalStrictMode) {
        if (typeof globalThis === "object") {
          globalThis.regeneratorRuntime = runtime2;
        } else {
          Function("r", "regeneratorRuntime = r")(runtime2);
        }
      }
    })(runtime);
    return runtime.exports;
  }
  requireRuntime();
  const defaultOptions$1 = {
    bpm: 80,
    beats: 4,
    subDivs: 1,
    swing: 0,
    workerUrl: void 0,
    lookaheadInterval: 0.025,
    scheduleAheadTime: 0.1,
    startDelayTime: 0.2
  };
  class Metronome {
    constructor(opts) {
      this.started = false;
      this.startTime = 0;
      this.barStart = 0;
      this.lastBar = 0;
      this.scheduledClicks = [];
      this.opts = { ...defaultOptions$1, ...opts };
      this.started = false;
      this.next = { bar: 0, beat: 0, beats: this.opts.beats, subDiv: 0, subDivs: this.opts.subDivs, time: 0 };
      if (this.opts.workerUrl) {
        this.worker = new Worker(this.opts.workerUrl);
      } else {
        this.worker = new MetronomeWorker();
      }
      this.worker.onmessage = (e) => {
        if (e.data === "tick") {
          this.scheduler();
          this.opts.onSchedulerTick?.();
        }
      };
      this.worker.postMessage({ interval: this.opts.lookaheadInterval });
    }
    start() {
      if (this.started)
        return;
      this.startTime = this.now + this.opts.startDelayTime;
      this.stopTime = void 0;
      this.barStart = this.startTime;
      this.lastBar = 0;
      this.started = true;
      this.scheduledClicks = [];
      if (this.opts.subDivs % 2 > 0)
        this.opts.swing = 0;
      this.next = {
        bar: 1,
        beat: 1,
        beats: this.opts.beats,
        subDiv: 1,
        subDivs: this.opts.subDivs,
        time: this.startTime
      };
      this.worker.postMessage("start");
      this.opts.onStart?.();
      if (this.opts.clicker?.audioContext?.state === "suspended") {
        this.opts.clicker.audioContext.resume();
      }
    }
    stop() {
      if (!this.started)
        return;
      this.stopTime = this.now;
      this.started = false;
      this.worker.postMessage("stop");
      this.unscheduleClicks();
      this.opts.onStop?.();
    }
    update({ bpm, beats, subDivs, swing }) {
      this.unscheduleClicks();
      if (bpm !== void 0)
        this.opts.bpm = bpm;
      if (beats !== void 0)
        this.opts.beats = beats;
      if (subDivs !== void 0)
        this.opts.subDivs = subDivs;
      if (swing !== void 0)
        this.opts.swing = swing;
      if ((bpm !== void 0 || beats !== void 0) && this.started && this.scheduledClicks.length) {
        if (this.lastClick)
          this.next = { ...this.lastClick };
        while (this.next.time <= this.now - this.subDivTime) {
          this.next.time += this.subDivTime;
        }
        this.advance();
      }
      this.opts.onUpdateOptions?.(this.opts);
    }
    // main method called by the thread timer when started
    scheduler() {
      if (!this.started)
        return;
      const lc = this.lastClick;
      if (lc && (lc.bar || 0) > this.lastBar) {
        this.lastBar = lc.bar;
        this.barStart = lc.time;
      }
      while (this.next.time < this.now + this.opts.scheduleAheadTime) {
        this.scheduleClick();
        this.advance();
      }
    }
    scheduleClick() {
      const click = {
        ...this.next,
        beats: this.opts.beats,
        subDivs: this.opts.subDivs
      };
      const obj = this.opts.clicker?.scheduleClickSound(click);
      this.opts.onNextClick?.(click);
      this.scheduledClicks.push({ ...click, obj });
      const now = this.now;
      this.scheduledClicks = this.scheduledClicks.filter((c) => c?.time >= now - 10);
    }
    advance() {
      let delta = this.beatTime / this.opts.subDivs;
      if (this.next.subDiv % 2 === 1) {
        delta += delta * (this.opts.swing / 100);
      } else {
        delta *= (100 - this.opts.swing) / 100;
      }
      this.next.time += delta;
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
      this.scheduledClicks = (this.scheduledClicks || []).map((click) => {
        if (click.time > this.now) {
          this.opts.clicker?.removeClickSound(click);
          this.opts.onUnscheduleClick?.(click);
          return null;
        }
        return click;
      }).filter(Boolean);
    }
    get now() {
      return this.opts.timerFn();
    }
    get beatTime() {
      return 60 / this.opts.bpm;
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
      return Array.from(Array(this.totalSubDivs).keys()).map((i) => {
        const t = i * (this.barTime / this.totalSubDivs);
        return i % 2 === 1 ? t + swingTime : t;
      });
    }
    get elapsed() {
      return this.now - this.startTime;
    }
    get lastClick() {
      const clicks = this.scheduledClicks?.filter((c) => c.time <= this.now);
      return clicks?.[clicks.length - 1] || null;
    }
    getClickIndex(click, subDivs) {
      if (!click)
        return -1;
      return (click.bar - 1) * this.opts.beats + (click.beat - 1) * (subDivs ?? this.opts.subDivs) + (click.subDiv - 1);
    }
    getClickBarIndex(click, subDivs) {
      return (click.beat - 1) * (subDivs ?? this.opts.subDivs) + (click.subDiv - 1);
    }
    // returns adjustment required in seconds to make t fall on the nearest grid line
    // toSubDivs - which sub division to quantize to (e.g. 4 = 16th notes)
    quantize(t, toSubDivs) {
      const to = toSubDivs ?? this.opts.subDivs;
      const timeInBar = t - this.barStart;
      const gridTimes = this.gridTimes.concat([this.barTime]).filter((_, idx) => idx % (this.opts.subDivs / to) === 0);
      const closestSubDivTime = gridTimes.reduce((prev, curr) => Math.abs(curr - timeInBar) < Math.abs(prev - timeInBar) ? curr : prev);
      const amount = closestSubDivTime - timeInBar;
      let closestSubDiv = gridTimes.indexOf(closestSubDivTime);
      if (closestSubDiv === this.opts.beats * to)
        closestSubDiv = 0;
      closestSubDiv++;
      return [amount, closestSubDiv];
    }
  }
  class MetronomeWorker {
    onmessage(_) {
    }
    postMessage(data) {
      if (typeof data === "object" && data.interval) {
        this.interval = data.interval;
        this.clearTimer();
      } else if (data === "start") {
        this.startTimer();
        this.tick();
      } else if (data === "stop") {
        this.clearTimer();
      }
    }
    startTimer() {
      if (this.interval)
        this.timer = setInterval(this.tick.bind(this), this.interval * 1e3);
    }
    clearTimer() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
    tick() {
      this.onmessage({ data: "tick" });
    }
  }
  const DEFAULT_SOUNDS = {
    name: "Defaults",
    bar: 880,
    beat: 440,
    subDiv: 220,
    user: 660
  };
  class Clicker {
    constructor({ audioContext, volume = 100, sounds = DEFAULT_SOUNDS }) {
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
        if (k === "name")
          continue;
        let sound;
        if (!Array.isArray(sounds[k])) {
          sound = sounds[k];
          sounds[k] = [sound, 1, 0.05];
        } else {
          sound = sounds[k][0];
        }
        if (typeof sound === "string") {
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
    scheduleClickSound({ time, subDiv, beat, beats }) {
      if (this.loading)
        return;
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
      click?.obj?.stop(0);
    }
    playSoundAt(sound, time, clickLength, relativeVolume = 1) {
      if (this.audioContext?.state === "suspended")
        this.audioContext.resume();
      let audioNode;
      if (typeof sound === "number") {
        audioNode = this.audioContext.createOscillator();
        audioNode.connect(this.gainNode);
        audioNode.frequency.value = sound;
        audioNode.start(time);
        audioNode.stop(time + clickLength);
      } else {
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
    click(t = 0) {
      const [soundObj, vol, length] = this.sounds.user;
      return this.playSoundAt(soundObj, t, length, vol);
    }
  }
  async function fetchAudioBuffer(audioContext, filepath) {
    const response = await fetch(filepath);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  }
  const defaultOptions = {
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
      this.opts = { ...defaultOptions, ...opts };
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
      const { savedClick, lastTime, userClicks } = this;
      const m = this.opts.metronome;
      const deltaT = m.elapsed - lastTime;
      Visualizer.frameRate.push(deltaT);
      if (Visualizer.frameRate.length > 100)
        Visualizer.frameRate.shift();
      if (!m.started || m.elapsed < 0)
        return;
      const savedClickIdx = m.getClickIndex(savedClick);
      const lastClick = m.lastClick;
      const lastClickIdx = m.getClickIndex(lastClick, savedClick?.subDivs);
      if (lastClick && lastClickIdx > savedClickIdx) {
        this.savedClick = lastClick;
        const lastClickBarIdx = m.getClickBarIndex(lastClick);
        this.progress = 1 / m.totalSubDivs * lastClickBarIdx;
        if (lastClickBarIdx % 2 === 1) {
          this.progress += 1 / m.totalSubDivs * (m.opts.swing / 100);
        }
      } else {
        const curProgress = this.progress;
        const remProgress = 1 - curProgress;
        const remTime = m.barTime * remProgress;
        const perSecond = remProgress / remTime;
        const deltaP = deltaT * perSecond;
        this.progress = (curProgress + deltaP) % 1;
      }
      this.lastTime = m.elapsed;
      let beat = lastClick?.beat || 1;
      let sub = lastClick?.subDiv || 1;
      this.count = m.opts.subDivs > 1 ? [beat, sub] : [beat];
      if (userClicks?.length) {
        const t = userClicks.pop();
        while (userClicks.length)
          userClicks.pop();
        const [qAmount] = m.quantize(t, 1);
        this.qType = getQuantizeType(qAmount, this.opts.qThreshold);
      }
    }
    static get frameRateInfo() {
      const arr = Visualizer.frameRate;
      if (!arr?.length)
        return 0;
      const mean = arr.reduce((a, b) => a + b) / arr.length;
      const std = Math.sqrt(arr.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / arr.length);
      return {
        mean,
        std
      };
    }
  }
  Visualizer.frameRate = [];
  function getQuantizeType(q, threshold) {
    if (q <= -1 * threshold) {
      return "late";
    } else if (q >= threshold) {
      return "early";
    } else {
      return "ontime";
    }
  }
  function createMetronome(mOpts, clickerOpts = {}, audioContext = new AudioContext()) {
    const clicker = new Clicker({ audioContext, ...clickerOpts });
    return new Metronome({
      timerFn: () => audioContext.currentTime,
      clicker,
      ...mOpts
    });
  }
  exports.Clicker = Clicker;
  exports.DEFAULT_SOUNDS = DEFAULT_SOUNDS;
  exports.Metronome = Metronome;
  exports.Visualizer = Visualizer;
  exports.createMetronome = createMetronome;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
})(this.Bipium = this.Bipium || {});
