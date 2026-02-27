import { Visualizer } from './core';
import type { TrackingWindow } from './types';

const trackingWindow = window as TrackingWindow;
trackingWindow._sentEvents = {};

export function sendEvent(
  action: string,
  cat = 'App',
  label: string | number | boolean = '',
  val = null,
) {
  trackingWindow.gtag?.('event', action, {
    event_category: cat,
    event_label: label,
    value: val,
  });
}

export function sendOneEvent(
  action: string,
  cat = 'App',
  label: string | number | boolean = '',
  val = null,
) {
  if (!trackingWindow._sentEvents?.[action]) {
    sendEvent(action, cat, label, val);
    if (trackingWindow._sentEvents) {
      trackingWindow._sentEvents[action] = true;
    }
  }
}

export function sendFrameRate() {
  if (!Visualizer.frameRate?.length) return;

  const info = Visualizer.frameRateInfo;
  if (typeof info === 'number') return;
  console.log('sending frame rate', info);
  sendOneEvent('frame_rate', 'Performance', `Mean: ${info.mean} / Std Dev: ${info.std}`, info.mean);
}
