// Whether the voice mode intro is skipped ("Don't show this again", in localStorage).
const HIDE_KEY = 'voiceIntroHidden';

export function voiceIntroHidden() {
  try {
    return window.localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
}

export function hideVoiceIntro() {
  try {
    window.localStorage.setItem(HIDE_KEY, '1');
  } catch {
    // Only persistence is lost; it shows again next time.
  }
}
