"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Metronome = void 0;
const defaultOptions = {
    bpm: 80,
    beats: 4,
    subDivs: 1,
    swing: 0,
    workerUrl: undefined,
    lookaheadInterval: 0.025,
    scheduleAheadTime: .1,
    startDelayTime: 0.2,
};
class Metronome {
    constructor(opts) {
        this.started = false;
        this.startTime = 0;
        this.barStart = 0;
        this.lastBar = 0;
        this.scheduledClicks = [];
        this.opts = Object.assign(Object.assign({}, defaultOptions), opts);
        this.started = false;
        this.next = { bar: 0, beat: 0, beats: this.opts.beats, subDiv: 0, subDivs: this.opts.subDivs, time: 0 };
        // prep the thread timer
        if (this.opts.workerUrl) {
            this.worker = new Worker(this.opts.workerUrl);
        }
        else {
            this.worker = new MetronomeWorker();
        }
        this.worker.onmessage = (e) => {
            var _a, _b;
            if (e.data === 'tick') {
                this.scheduler();
                (_b = (_a = this.opts).onSchedulerTick) === null || _b === void 0 ? void 0 : _b.call(_a);
            }
        };
        this.worker.postMessage({ interval: this.opts.lookaheadInterval });
    }
    start() {
        var _a, _b, _c, _d;
        if (this.started)
            return;
        this.startTime = this.now + this.opts.startDelayTime;
        this.stopTime = undefined;
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
            time: this.startTime,
        };
        this.worker.postMessage('start');
        (_b = (_a = this.opts).onStart) === null || _b === void 0 ? void 0 : _b.call(_a);
        if (((_d = (_c = this.opts.clicker) === null || _c === void 0 ? void 0 : _c.audioContext) === null || _d === void 0 ? void 0 : _d.state) === 'suspended') {
            this.opts.clicker.audioContext.resume();
        }
    }
    stop() {
        var _a, _b;
        if (!this.started)
            return;
        this.stopTime = this.now;
        this.started = false;
        this.worker.postMessage('stop');
        this.unscheduleClicks();
        (_b = (_a = this.opts).onStop) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
    update({ bpm, beats, subDivs, swing }) {
        var _a, _b;
        this.unscheduleClicks();
        if (bpm !== undefined)
            this.opts.bpm = bpm;
        if (beats !== undefined)
            this.opts.beats = beats;
        if (subDivs !== undefined)
            this.opts.subDivs = subDivs;
        if (swing !== undefined)
            this.opts.swing = swing;
        // recalculate next scheduled beat if bar structure has changed
        if ((bpm !== undefined || beats !== undefined) && this.started && this.scheduledClicks.length) {
            if (this.lastClick)
                this.next = Object.assign({}, this.lastClick);
            while (this.next.time <= this.now - this.subDivTime) {
                this.next.time += this.subDivTime;
            }
            this.advance();
        }
        (_b = (_a = this.opts).onUpdateOptions) === null || _b === void 0 ? void 0 : _b.call(_a, this.opts);
    }
    // main method called by the thread timer when started
    scheduler() {
        if (!this.started)
            return;
        // update the bar start time for quantization purposes
        const lc = this.lastClick;
        if (lc && ((lc.bar || 0) > this.lastBar)) {
            this.lastBar = lc.bar;
            this.barStart = lc.time;
        }
        while (this.next.time < this.now + this.opts.scheduleAheadTime) {
            this.scheduleClick();
            this.advance(); // updates this.next.time
        }
    }
    scheduleClick() {
        var _a, _b, _c;
        const click = Object.assign(Object.assign({}, this.next), { beats: this.opts.beats, subDivs: this.opts.subDivs });
        // notify clicker to schedule the actual sound - it returns a sound object
        // that we keep around so that if it needs to be cancelled it can be passed
        // to the onUnscheduleClick method
        const obj = (_a = this.opts.clicker) === null || _a === void 0 ? void 0 : _a.scheduleClickSound(click);
        (_c = (_b = this.opts).onNextClick) === null || _c === void 0 ? void 0 : _c.call(_b, click);
        this.scheduledClicks.push(Object.assign(Object.assign({}, click), { obj }));
        // remove old clicks from memory
        const now = this.now;
        this.scheduledClicks = this.scheduledClicks.filter((c) => (c === null || c === void 0 ? void 0 : c.time) >= now - 10.0);
    }
    advance() {
        // calculate next click time
        let delta = this.beatTime / this.opts.subDivs;
        if (this.next.subDiv % 2 === 1) {
            delta += delta * (this.opts.swing / 100.0);
        }
        else {
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
        }
        else {
            this.next.subDiv++;
        }
    }
    unscheduleClicks() {
        this.scheduledClicks = (this.scheduledClicks || [])
            .map((click) => {
            var _a, _b, _c;
            if (click.time > this.now) {
                (_a = this.opts.clicker) === null || _a === void 0 ? void 0 : _a.removeClickSound(click);
                (_c = (_b = this.opts).onUnscheduleClick) === null || _c === void 0 ? void 0 : _c.call(_b, click);
                return null;
            }
            return click;
        })
            .filter(Boolean);
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
        const swingTime = (this.barTime / this.totalSubDivs) * (this.opts.swing / 100) || 0;
        return Array.from(Array(this.totalSubDivs).keys()).map(i => {
            const t = i * (this.barTime / this.totalSubDivs);
            return i % 2 === 1 ? t + swingTime : t;
        });
    }
    get elapsed() {
        return this.now - this.startTime;
    }
    get lastClick() {
        var _a;
        const clicks = (_a = this.scheduledClicks) === null || _a === void 0 ? void 0 : _a.filter((c) => c.time <= this.now);
        return (clicks === null || clicks === void 0 ? void 0 : clicks[clicks.length - 1]) || null;
    }
    getClickIndex(click, subDivs) {
        if (!click)
            return -1;
        return ((click.bar - 1) * this.opts.beats +
            (click.beat - 1) * (subDivs !== null && subDivs !== void 0 ? subDivs : this.opts.subDivs) +
            (click.subDiv - 1));
    }
    getClickBarIndex(click, subDivs) {
        return (click.beat - 1) * (subDivs !== null && subDivs !== void 0 ? subDivs : this.opts.subDivs) + (click.subDiv - 1);
    }
    // returns adjustment required in seconds to make t fall on the nearest grid line
    // toSubDivs - which sub division to quantize to (e.g. 4 = 16th notes)
    quantize(t, toSubDivs) {
        const to = toSubDivs !== null && toSubDivs !== void 0 ? toSubDivs : this.opts.subDivs;
        const timeInBar = t - this.barStart;
        const gridTimes = this.gridTimes
            .concat([this.barTime])
            .filter((_, idx) => idx % (this.opts.subDivs / to) === 0);
        const closestSubDivTime = gridTimes.reduce((prev, curr) => Math.abs(curr - timeInBar) < Math.abs(prev - timeInBar) ? curr : prev);
        const amount = closestSubDivTime - timeInBar;
        let closestSubDiv = gridTimes.indexOf(closestSubDivTime);
        if (closestSubDiv === this.opts.beats * to)
            closestSubDiv = 0;
        closestSubDiv++;
        // console.log(amount, amount > 0 ? 'early' : 'late', 'to', closestSubDiv);
        return [amount, closestSubDiv];
    }
}
exports.Metronome = Metronome;
// fallback worker, but should use worker.js instead in thread
class MetronomeWorker {
    onmessage(_) { }
    postMessage(data) {
        if (typeof data === 'object' && data.interval) {
            this.interval = data.interval;
            this.clearTimer();
        }
        else if (data === 'start') {
            this.startTimer();
            this.tick();
        }
        else if (data === 'stop') {
            this.clearTimer();
        }
    }
    startTimer() {
        if (this.interval)
            this.timer = setInterval(this.tick.bind(this), this.interval * 1000);
    }
    clearTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    tick() {
        this.onmessage({ data: 'tick' });
    }
}
