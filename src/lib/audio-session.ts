// Safari's audio session (iOS 17+, including Home Screen apps). By default Web Audio is
// treated like a ringtone: the silent switch mutes it, and after the mic has been used the
// output can stay in call mode (quiet, through the earpiece). A metronome is media
// playback; only while voice mode captures the mic does it need play-and-record.
type AudioSession = { type: string };

const session = () =>
  typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { audioSession?: AudioSession }).audioSession;

let capturing = false;

function setType(type: string) {
  const current = session();
  if (!current || current.type === type) return;
  try {
    current.type = type;
  } catch {
    // Unsupported value or browser: leave the session as it is.
  }
}

/** Playback, unless the mic is capturing. Safe to call at any time. */
export function preferPlayback() {
  if (!capturing) setType('playback');
}

/** Around mic capture: play-and-record while on, back to playback after. */
export function setCapturing(on: boolean) {
  capturing = on;
  setType(on ? 'play-and-record' : 'playback');
}
