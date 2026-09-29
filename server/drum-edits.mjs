// Positions use quarter-note units, independent of the current display grid.
const words = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];
const number = `(?:${words.join('|')}|\\d{1,2})`;
const value = text => (words.indexOf(text) >= 0 ? words.indexOf(text) + 1 : Number(text));
const unique = values => [...new Set(values)].sort((a, b) => a - b);
const lanePattern = /\b(kicks?|snares?|hi[ -]?hats?|hats?)\b/gi;
export function positionLabel(position) {
  const beat = Math.floor(position) + 1;
  const fraction = position % 1;
  if (!fraction) return `beat ${beat}`;
  const names = new Map([
    [0.25, 'e'],
    [0.5, 'and'],
    [0.75, 'a'],
  ]);
  return names.has(fraction)
    ? `the ${names.get(fraction)} of beat ${beat}`
    : `${fraction} beats after beat ${beat}`;
}
export function musicalReading(text) {
  // Resolve a counting syllable only inside a named musical position.
  return text.replace(
    new RegExp(`\\bend(?=\\s+(?:of|after)\\s+(?:beat\\s+)?${number}\\b)`, 'gi'),
    'and',
  );
}
export function namedPositions(text) {
  const found = [];
  const occupied = [];
  const add = (match, position) => {
    if (occupied.some(([a, b]) => match.index < b && match.index + match[0].length > a)) return;
    occupied.push([match.index, match.index + match[0].length]);
    found.push({ index: match.index, position });
  };
  const normalized = musicalReading(text.toLowerCase());
  for (const m of normalized.matchAll(
    new RegExp(`\\b(and|e|ee|a|uh)\\s+(?:of|after)\\s+(?:beat\\s+)?(${number})\\b`, 'g'),
  ))
    add(m, value(m[2]) - 1 + { and: 0.5, e: 0.25, ee: 0.25, a: 0.75, uh: 0.75 }[m[1]]);
  for (const m of normalized.matchAll(
    new RegExp(`\\b(${number})\\s*(?:&|and(?=\\s*(?:$|[,.!?])))`, 'g'),
  ))
    add(m, value(m[1]) - 0.5);
  for (const m of normalized.matchAll(
    new RegExp(`\\b(?:beat|on|from|to|at|off)\\s+(?:the\\s+)?(?:beat\\s+)?(${number})\\b`, 'g'),
  ))
    add(m, value(m[1]) - 1);
  if (found.length) {
    for (const m of normalized.matchAll(
      new RegExp(`(?:\\band|,)\\s+(?:beat\\s+)?(${number})\\b`, 'g'),
    ))
      add(m, value(m[1]) - 1);
  }
  return found.sort((a, b) => a.index - b.index).map(item => item.position);
}
export function applyDrumEdit(hits, edit, beats) {
  const { operation, source, destination, amount } = edit;
  if (source?.some(p => !hits.includes(p))) throw Error('The source hit does not exist.');
  let result;
  if (operation === 'add') result = [...hits, ...destination];
  else if (operation === 'remove') result = hits.filter(p => !destination.includes(p));
  else if (operation === 'replace') result = destination;
  else if (operation === 'move')
    result = [...hits.filter(p => !source.includes(p)), ...destination];
  else if (operation === 'shift') {
    const selected = source ?? hits;
    result = [
      ...hits.filter(p => !selected.includes(p)),
      ...selected.map(p => (((p + amount) % beats) + beats) % beats),
    ];
  } else throw Error('Unknown drum edit.');
  if (result.some(p => !Number.isFinite(p) || p < 0 || p >= beats))
    throw Error('The destination is outside the bar.');
  return unique(result);
}
export function drumEditContext(prompt, current) {
  let text = prompt;
  const mentions = [...text.matchAll(lanePattern)].map(m =>
    /hat/i.test(m[1]) ? 'hat' : m[1].toLowerCase().replace(/s$/, ''),
  );
  const targeted = [...new Set(mentions)];
  const isEdit =
    targeted.length > 0 &&
    /\b(move|shift|relocate|slide|nudge|add|put|place|remove|delete|only|just)\b/i.test(text) &&
    !/\b(don't|do not|never|not|song|called|titled)\b/i.test(text);
  if (isEdit) text = musicalReading(prompt);
  const result = {
    text,
    targeted: isEdit ? targeted : [],
    positions: isEdit ? namedPositions(text) : [],
    edits: {},
    issue: null,
  };
  if (!isEdit || targeted.length !== 1) return result;
  const lane = targeted[0];
  const divisions = current.playSubDivs ? current.subDivs : 1;
  const hits = current.loopPattern[lane].flatMap((hit, i) => (hit ? [i / divisions] : []));
  const moving = /\b(move|shift|relocate|slide|nudge)\b/i.test(text);
  if (!moving) {
    const operation = /\b(only|just)\b/i.test(text)
      ? 'replace'
      : /\b(remove|delete)\b/i.test(text)
        ? 'remove'
        : /\b(add|put|place)\b/i.test(text)
          ? 'add'
          : null;
    const destination = result.positions.length
      ? unique(result.positions)
      : operation === 'remove'
        ? hits
        : [];
    if (!operation || (!destination.length && operation !== 'remove')) return result;
    const description = `${operation === 'replace' ? 'Play ONLY' : operation === 'add' ? 'Add' : 'Remove'} ${lane} ${destination.length ? 'on ' + destination.map(positionLabel).join(' and ') : 'hits'}; ${operation === 'replace' ? 'replace this lane' : 'preserve every other hit'}`;
    const edit = { operation, destination };
    try {
      result.edits[lane] = {
        edit,
        key: `edit:${operation}:${destination.join(',')}`,
        pattern: applyDrumEdit(hits, edit, current.beats),
        description,
      };
    } catch (error) {
      result.issue = `${error.message} The beat is unchanged.`;
    }
    return result;
  }
  const to =
    /\bto\s+(?:the\s+)?(?:(?:and|end|e|ee|a|uh)\s+of|beat|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d)/i.exec(
      text,
    );
  const relative =
    /\b(back|earlier|forward|later)\s+(?:by\s+)?(?:(a|one|two|three|four|half|quarter|\d+(?:\.\d+)?)\s+)?(?:a\s+)?(beats?|eighth(?:\s+note)?|sixteenth(?:\s+note)?)\b/i.exec(
      text,
    );
  let edit, description;
  if (to) {
    const source = namedPositions(text.slice(0, to.index));
    const destination = namedPositions(text.slice(to.index));
    if (destination.length !== 1 || source.length > 1) {
      result.issue = `Say which ${lane} hit to move and its destination. The beat is unchanged.`;
      return result;
    }
    if (!source.length && hits.length !== 1 && !/\ball\b/i.test(text)) {
      result.issue = hits.length
        ? `Which ${lane} hit should move to ${positionLabel(destination[0])}? The beat is unchanged.`
        : `There is no ${lane} hit to move. The beat is unchanged.`;
      return result;
    }
    edit = { operation: 'move', source: source.length ? source : hits, destination };
    description = `Move ${lane} from ${edit.source.map(positionLabel).join(', ')} to ${positionLabel(destination[0])}; preserve every other hit`;
  } else if (relative) {
    const source = namedPositions(text.slice(0, relative.index));
    const count = relative[2]?.toLowerCase();
    const unit = /^eighth/i.test(relative[3]) ? 0.5 : /^sixteenth/i.test(relative[3]) ? 0.25 : 1;
    const amount =
      ({ a: 1, half: 0.5, quarter: 0.25 }[count] ?? (count ? value(count) : 1)) *
      unit *
      (/back|earlier/i.test(relative[1]) ? -1 : 1);
    edit = { operation: 'shift', source: source.length ? source : undefined, amount };
    if (!hits.length) {
      result.issue = `There is no ${lane} hit to move. The beat is unchanged.`;
      return result;
    }
    description = `Move ${source.length ? lane + ' from ' + source.map(positionLabel).join(', ') : 'all ' + lane + ' hits'} ${amount < 0 ? 'earlier' : 'later'} by ${Math.abs(amount)} beat(s); preserve other hits and wrap within the bar`;
  } else {
    result.issue =
      'Couldn’t resolve the move. Name its source and destination. The beat is unchanged.';
    return result;
  }
  try {
    result.edits[lane] = {
      edit,
      key: 'edit:move',
      pattern: applyDrumEdit(hits, edit, current.beats),
      description,
    };
  } catch (error) {
    result.issue = `${error.message} The beat is unchanged.`;
  }
  return result;
}
