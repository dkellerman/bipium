export class Visualizer {
  constructor({ metronome, qThreshold = 0.04 }) {
    this.m = metronome;
    this.qThreshold = qThreshold;
  }

  start() {
    this.progress = 0;
    this.lastTime = this.m.elapsed;
    this.click = this.m.lastClick || {};
    this.count = [];
    this.qType = null;
    this.userClicks = [];
  }

  stop() {
    this.progress = 0;
    this.count = [];
    this.userClicks = [];
    this.qType = null;
  }

  update() {
    const { m, click, lastTime, userClicks, qThreshold } = this;

    const lastClick = m.lastClick || {};
    const lastClickIdx = m.getClickIndex(lastClick);
    const lastClickBarIdx = m.getClickBarIndex(lastClick);
    const savedClickIdx = m.getClickIndex(click || {}) || 0;

    // update now line
    if (lastClickIdx > savedClickIdx) {
      this.click = lastClick;
      this.progress = (1.0 / m.totalSubDivs) * lastClickBarIdx;
    } else {
      const curProgress = this.progress;
      const remProgress = 1.0 - curProgress;
      const remTime = m.barTime * remProgress;
      const perSecond = remProgress / remTime;
      const deltaT = m.elapsed - lastTime;
      const deltaP = deltaT * perSecond;
      const newProgress = (curProgress + deltaP) % 1.0;
      this.progress = newProgress;
    }

    this.lastTime = m.elapsed;

    // update count
    let beat = lastClick.beat || 1;
    let sub = lastClick.subDiv || 1;
    this.count = m.subDivs > 1 ? [beat, sub] : [beat];

    // show timing info for user clicks
    if (userClicks.length) {
      const t = userClicks.pop();
      while (userClicks.length) userClicks.pop(); // ignore old clicks

      const [qAmount] = m.quantize(t, 1);
      this.qType = getQuantizeType(qAmount, qThreshold);
    }
  }
}

function getQuantizeType(q, threshold) {
  if (q <= -1 * threshold) {
    return 'late';
  } else if (q >= threshold) {
    return 'early';
  } else {
    return 'ontime';
  }
}
