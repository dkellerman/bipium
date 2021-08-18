export class Metronome {
  constructor(settings = {}) {
    const {
      // required:
      timerFn, // provides microseconds, e.g. AudioContext::currentTime
      clicker, // provide clicker class to schedule sounds with the audio context

      // basic config - use update() to adjust on the fly:
      bpm = 80,
      beats = 4,
      subDivs = 1,
      swing = 0,
      workerUrl = null, // supply URL for worker thread, otherwise uses local timer

      // optional metronome events:
      onNextClick = () => {},
      onUnscheduleClick = () => {},
      onStart = () => {},
      onStop = () => {},
      onSchedulerTick = () => {},

      // detailed configuration:
      lookaheadInterval = 0.025,
      scheduleAheadTime = 0.1,
      startDelayTime = 0, // doesn't work currently
    } = settings;

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
    this.started = false;

    // prep the thread timer
    if (workerUrl) {
      this.worker = new Worker(workerUrl);
    } else {
      this.worker = new MetronomeWorker();
    }

    this.worker.onmessage = e => {
      if (e.data === 'tick') {
        this.scheduler();
        this.onSchedulerTick();
      }
    };

    this.worker.postMessage({ interval: this.lookaheadInterval });
  }

  start() {
    if (this.started) return;

    this.startTime = this.now + this.startDelayTime;
    this.stopTime = null;
    this.started = true;
    this.scheduledClicks = [];
    if (this.subDivs % 2 > 0) this.swing = 0;

    this.next = {
      bar: 1,
      beat: 1,
      subDiv: 1,
      time: this.startTime,
    };

    this.worker.postMessage('start');
    this.onStart();
  }

  stop() {
    if (!this.started) return;

    this.stopTime = this.now;
    this.started = false;
    this.worker.postMessage('stop');
    this.unscheduleClicks();
    this.onStop();
  }

  update({ bpm, beats, subDivs, swing }) {
    this.unscheduleClicks();

    if (bpm !== undefined) this.bpm = bpm;
    if (beats !== undefined) this.beats = beats;
    if (subDivs !== undefined) this.subDivs = subDivs;
    if (swing !== undefined) this.swing = swing;

    // recalculate next scheduled beat if bar structure has changed
    if ((bpm !== undefined || beats !== undefined) && this.started && this.scheduledClicks.length) {
      this.next = { ...this.lastClick };
      while (this.next.time <= this.now - this.subDivTime) {
        this.next.time += this.subDivTime;
      }
      this.advance();
    }
  }

  // main method called by the thread timer when started
  scheduler() {
    if (!this.started) return;

    while (this.next.time < this.now + this.scheduleAheadTime) {
      this.scheduleClick();
      this.advance(); // updates this.next.time
    }
  }

  scheduleClick() {
    const click = {
      ...this.next,
      beats: this.beats,
      subDivs: this.subDivs,
    };

    // notify clicker to schedule the actual sound - it returns a sound object
    // that we keep around so that if it needs to be cancelled it can be passed
    // to the onUnscheduleClick method
    const obj = this.clicker?.scheduleClickSound(click);
    this.onNextClick(click);
    this.scheduledClicks.push({ ...click, obj });

    // remove old clicks from memory
    const now = this.now;
    this.scheduledClicks = this.scheduledClicks.filter(c => c?.time >= now - 10.0);
  }

  advance() {
    // calculate next click time
    let delta = this.beatTime / this.subDivs;
    if (this.next.subDiv % 2 === 1) {
      delta += delta * (this.swing / 100.0);
    } else {
      delta *= (100.0 - this.swing) / 100.0;
    }

    // advance time
    this.next.time += delta;

    // advance beat counter
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

  unscheduleClicks() {
    this.scheduledClicks = (this.scheduledClicks || [])
      .map(click => {
        if (click.time > this.now) {
          this.clicker?.removeClickSound(click);
          this.onUnscheduleClick(click);
          return null;
        }
        return click;
      })
      .filter(Boolean);
  }

  get now() {
    return this.timerFn();
  }

  get beatTime() {
    return 60.0 / this.bpm;
  }

  get subDivTime() {
    return this.beatTime / this.subDivs;
  }

  get barTime() {
    return this.beats * this.beatTime;
  }

  get totalSubDivs() {
    return this.beats * this.subDivs;
  }

  // relative timestamps for all sub-divisions in a bar
  get gridTimes() {
    const swingTime = (this.barTime / this.totalSubDivs) * (this.swing / 100) || 0;
    return [...Array(this.totalSubDivs).keys()].map(i => {
      const t = i * (this.barTime / this.totalSubDivs);
      return i % 2 === 1 ? t + swingTime : t;
    });
  }

  get elapsed() {
    return this.now - this.startTime;
  }

  get lastClick() {
    const clicks = this.scheduledClicks?.filter(c => c.time <= this.now);
    return clicks?.[clicks.length - 1];
  }

  getClickIndex(click) {
    return (click.bar - 1) * this.beats + (click.beat - 1) * this.subDivs + (click.subDiv - 1);
  }

  getClickBarIndex(click) {
    return (click.beat - 1) * this.subDivs + (click.subDiv - 1);
  }

  // returns adjustment required in seconds to make t fall on the nearest grid line
  // toSubDivs - which sub division to quantize to (e.g. 4 = 16th notes)
  quantize(t, toSubDivs = null) {
    const to = toSubDivs || this.subDivs;
    const elapsed = (t - (this.startTime || 0)) % this.barTime;

    const gridTimes = this.gridTimes
      .concat([this.barTime])
      .filter((_, idx) => idx % (this.subDivs / to) === 0);

    const closestSubDivTime = gridTimes.reduce((prev, curr) =>
      Math.abs(curr - elapsed) < Math.abs(prev - elapsed) ? curr : prev,
    );
    const amount = closestSubDivTime - elapsed;

    let closestSubDiv = gridTimes.indexOf(closestSubDivTime);
    if (closestSubDiv === this.beats * to) closestSubDiv = 0;
    closestSubDiv++;

    // console.log(amount, amount > 0 ? 'early' : 'late', 'to', closestSubDiv);
    return [amount, closestSubDiv];
  }
}

// fallback worker, but should use worker.js instead in thread
class MetronomeWorker {
  interval;
  timer;

  onmessage() {}

  postMessage(data) {
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

  startTimer() {
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
