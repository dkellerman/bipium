"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Visualizer = void 0;
const defaultOptions = {
    qThreshold: 0.04,
};
class Visualizer {
    constructor(opts) {
        this.progress = 0;
        this.lastTime = 0;
        this.savedClick = null;
        this.count = [];
        this.qType = null;
        this.userClicks = [];
        this.opts = Object.assign(Object.assign({}, defaultOptions), opts);
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
        // get last click index based on the saved click's number of sub divs
        const lastClickIdx = m.getClickIndex(lastClick, savedClick === null || savedClick === void 0 ? void 0 : savedClick.subDivs);
        // update now line
        if (lastClick && lastClickIdx > savedClickIdx) {
            this.savedClick = lastClick;
            const lastClickBarIdx = m.getClickBarIndex(lastClick);
            this.progress = (1.0 / m.totalSubDivs) * lastClickBarIdx;
            if (lastClickBarIdx % 2 === 1) {
                this.progress += (1.0 / m.totalSubDivs) * (m.opts.swing / 100);
            }
        }
        else {
            const curProgress = this.progress;
            const remProgress = 1.0 - curProgress;
            const remTime = m.barTime * remProgress;
            const perSecond = remProgress / remTime;
            const deltaP = deltaT * perSecond;
            this.progress = (curProgress + deltaP) % 1.0;
        }
        this.lastTime = m.elapsed;
        // update count
        let beat = (lastClick === null || lastClick === void 0 ? void 0 : lastClick.beat) || 1;
        let sub = (lastClick === null || lastClick === void 0 ? void 0 : lastClick.subDiv) || 1;
        this.count = m.opts.subDivs > 1 ? [beat, sub] : [beat];
        // show timing info for user clicks
        if (userClicks === null || userClicks === void 0 ? void 0 : userClicks.length) {
            const t = userClicks.pop();
            while (userClicks.length)
                userClicks.pop(); // ignore old clicks
            const [qAmount] = m.quantize(t, 1);
            this.qType = getTimingLabel(qAmount, this.opts.qThreshold);
        }
    }
    static get frameRateInfo() {
        const arr = Visualizer.frameRate;
        if (!(arr === null || arr === void 0 ? void 0 : arr.length))
            return 0;
        const mean = arr.reduce((a, b) => a + b) / arr.length;
        const std = Math.sqrt(arr.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / arr.length);
        return {
            mean,
            std,
        };
    }
}
exports.Visualizer = Visualizer;
Visualizer.frameRate = [];
function getTimingLabel(q, threshold) {
    if (q <= -1 * threshold) {
        return 'late';
    }
    else if (q >= threshold) {
        return 'early';
    }
    else {
        return 'ontime';
    }
}
