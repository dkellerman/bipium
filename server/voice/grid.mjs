// Drum grid arithmetic shared by the main and drum requests.
// Positions are in beats from the start of the bar (0 = beat 1, 1.5 = the & of 2).
export const LANES = ['kick', 'snare', 'hat'];
const EPSILON = 1e-6;

export const audibleDivisions = config => (config.playSubDivs ? config.subDivs : 1);

export function positionsOf(config) {
  const divisions = audibleDivisions(config);
  return Object.fromEntries(
    LANES.map(lane => [
      lane,
      config.loopPattern[lane].flatMap((hit, i) => (hit ? [i / divisions] : [])),
    ]),
  );
}

/** A style's sixteenth-note pattern laid over `beats`, repeating its bar as needed. */
export function stylePositions(style, beats) {
  return Object.fromEntries(
    LANES.map(lane => {
      const own = style.pattern[lane].map(step => step / 4);
      const positions = [];
      for (let beat = 0; beat < beats; beat++) {
        const source = beat % style.beats;
        for (const p of own) if (p >= source && p < source + 1) positions.push(beat + p - source);
      }
      return [lane, positions];
    }),
  );
}

/** Spoken name of a slot: part `part` of `per` within 1-based beat `beat`. */
export function slotName(beat, part, per) {
  if (part === 0) return String(beat);
  if (per === 2) return `& of ${beat}`;
  if (per === 4) return `${['', 'e', '&', 'a'][part]} of ${beat}`;
  if (per === 3) return `${['', 'trip', 'let'][part]} of ${beat}`;
  return `${beat} + ${part}/${per}`;
}

export function nameOf(position, per) {
  const beat = Math.floor(position + EPSILON);
  return slotName(beat + 1, Math.round((position - beat) * per), per);
}

/** "kick: 1, 3 · snare: 2, 4 · hat: 1, & of 1, …" at the audible resolution. */
export function describeGrid(config) {
  const per = audibleDivisions(config);
  const positions = positionsOf(config);
  return LANES.map(
    lane => `${lane}: ${positions[lane].map(p => nameOf(p, per)).join(', ') || 'none'}`,
  ).join(' · ');
}

export const samePosition = (a, b) => Math.abs(a - b) < EPSILON;

/** "added snare on & of 3; removed kick on 4": what changed between two configs' grids. */
export function describeGridChanges(before, after) {
  const per = [1, 2, 4].includes(audibleDivisions(after)) ? 4 : audibleDivisions(after);
  const a = positionsOf(before);
  const b = positionsOf(after);
  const changes = [];
  for (const lane of LANES) {
    const added = b[lane].filter(p => !a[lane].some(q => samePosition(p, q)));
    const removed = a[lane].filter(p => !b[lane].some(q => samePosition(p, q)));
    if (added.length) changes.push(`added ${lane} on ${added.map(p => nameOf(p, per)).join(', ')}`);
    if (removed.length) changes.push(`removed ${lane} on ${removed.map(p => nameOf(p, per)).join(', ')}`);
  }
  return changes.join('; ');
}
