import { Visualizer } from './core';

window._sentEvents = {};

export function sendEvent(action, cat = 'App', label = '', val = null) {
  window.gtag?.('event', action, {
    event_category: cat,
    event_label: label,
    value: val,
  });
}

export function sendOneEvent(action, cat = 'App', label = '', val = null) {
  if (!window._sentEvents[action]) {
    sendEvent(action, cat, label, val);
    window._sentEvents[action] = true;
  }
}

export function sendFrameRate() {
  if (!Visualizer.frameRate?.length) return;

  const info = Visualizer.frameRateInfo;
  console.log('sending frame rate', info);
  sendOneEvent('frame_rate', 'Performance', `Mean: ${info.mean} / Std Dev: ${info.std}`, info.mean);
}
