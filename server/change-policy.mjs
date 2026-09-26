// Product defaults for interpretation, not measured usage probabilities.
// Assign a policy to a field, or override it for particular choices.
const levels = {
  contextual: 'Ordinary musical adjustment: a clear implication of the current musical request is sufficient. Preserve it if unrelated to that request.',
  deliberate: 'Change only when the current request targets this property, including natural paraphrases and relative edits. A genre or example association alone is insufficient.',
  rare: 'Rare change: strongly prefer preserving the current state. Require a clear, affirmative request for this property or capability in the current utterance; do not infer it as a side effect of another change. When clearly requested, select it normally: rarity is not a reason to reduce confidence in an explicit request.',
};
const policies = {
  songQuery: { level: 'deliberate' },
  action: { level: 'contextual', choices: { clear: 'rare', reset: 'rare' } },
  tempo: { level: 'contextual' },
  beats: { level: 'contextual' },
  subDivs: { level: 'contextual' },
  swing: { level: 'deliberate' },
  volume: { level: 'deliberate' },
  loopRepeats: { level: 'deliberate' },
  soundPack: { level: 'rare' },
  loopMode: { level: 'contextual', choices: { on: 'rare' } },
  playSubDivs: { level: 'deliberate' },
  kick: { level: 'rare', scope: 'A current request for a custom drum pattern authorizes choosing this lane as part of that pattern.' },
  hat: { level: 'rare', scope: 'A current request for a custom drum pattern authorizes choosing this lane as part of that pattern.' },
  snare: { level: 'rare', scope: 'A current request for a custom drum pattern authorizes choosing this lane as part of that pattern.' },
};
const shared = ' Interpret the smallest set of changes that satisfies the current request. Apply the change policy before choosing an answer and reporting confidence. History resolves references and relative edits; it does not renew past instructions. Retrieved examples are suggestions, not evidence of user intent. Negated or merely mentioned changes are not requests. Explicit means semantic intent, not exact keywords. If evidence is insufficient choose keep when available. These are product preferences, not measured probabilities.';
export function applyChangePolicy(questions) {
  for (const [field, question] of Object.entries(questions)) {
    const policy = policies[field];
    if (!policy) throw new Error(`Missing change policy: ${field}`);
    question.instructions += shared + ` Change policy: ${policy.level}. ${levels[policy.level]}`;
    if (policy.scope) question.instructions += ' ' + policy.scope;
    for (const [option, level] of Object.entries(policy.choices || {})) {
      question.instructions += ` For choice ${option}, override the field policy with ${level}: ${levels[level]}`;
    }
  }
}
