// Jev (Typesafe System One) client and question helpers.
// Jev answers typed questions: a choice returns one of our option keys, a probability
// for each, and a confidence. It never returns free text or numbers, so exact values
// are asked for digit by digit (see `digits`).
export const MODEL = 'jev-1.13.0';
export const MAX_OPTIONS = 255;
/** An answer is acted on only above this confidence; otherwise the setting is kept. */
export const THRESHOLD = 0.5;

export const choice = (instructions, criteria) => {
  const count = Object.keys(criteria).length;
  if (count < 2 || count > MAX_OPTIONS) throw Error(`A choice needs 2–${MAX_OPTIONS} options.`);
  return { type: 'choice', instructions, criteria };
};

/** The accepted option, or null if the answer is missing or not confident enough. */
export const picked = answer => (answer && answer.confidence > THRESHOLD ? answer.choice : null);

const PLACES = [
  ['hundreds', 100],
  ['tens', 10],
  ['ones', 1],
];
/** A digit option described by what it means in that place, with example numbers. */
function describeDigit(place, d) {
  if (place === 'hundreds')
    return d === 0 ? '0: under 100 (e.g. 95)' : `${d}: ${d} hundred and something (e.g. ${d}30)`;
  if (place === 'tens')
    return `${d}: ${d} in the tens place (e.g. 1${d}5${d ? `, ${d}0` : ', 105'})`;
  return `${d}: the number ends in ${d} (e.g. ${120 + d}, ${90 + d})`;
}

/**
 * One question per decimal place for an exact number the user stated.
 * Each is answerable on its own from the utterance, so they can share a request.
 */
export function digits(key, what, max) {
  const questions = {};
  for (const [place, size] of PLACES) {
    if (size > max) continue;
    const top = size === 100 ? Math.floor(max / 100) : 9;
    const options = { none: `No exact ${what} stated` };
    for (let d = 0; d <= top; d++) options[String(d)] = describeDigit(place, d);
    questions[`${key}_${place}`] = choice(
      `${place[0].toUpperCase()}${place.slice(1)} digit of the exact ${what} the user stated (see DIGITS in guidance).`,
      options,
    );
  }
  return questions;
}

/** The exact number from accepted digit answers, or null if any place is unsure. */
export function readDigits(answers, key) {
  let value = 0;
  for (const [place, size] of PLACES) {
    const answer = answers[`${key}_${place}`];
    if (!answer) continue;
    const digit = picked(answer);
    if (digit === null || digit === 'none') return null;
    value += Number(digit) * size;
  }
  return value;
}

export function validateAnswers(questions, answers) {
  for (const [key, question] of Object.entries(questions)) {
    const answer = answers?.[key];
    if (
      !answer ||
      !Object.hasOwn(question.criteria, answer.choice) ||
      !Number.isFinite(answer.confidence)
    )
      throw Error('Jev returned an incomplete decision. Please try again.');
  }
}

export async function askJev(env, request, signal) {
  const response = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.TYPESAFE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, ...request }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok) {
    const error = Error(`Jev is unavailable (${response.status}). Please try again.`);
    error.status = 502;
    throw error;
  }
  const result = await response.json();
  validateAnswers(request.questions, result.answers);
  return result;
}
