// Product defaults for interpretation, not measured usage probabilities.
// Assign a policy to a field, or override it for particular choices.
const levels = {
  contextual:
    'Ordinary musical adjustment: a clear implication of the current musical request is sufficient. Preserve it if unrelated to that request.',
  deliberate:
    'Change only when the current request targets this property, including natural paraphrases and relative edits. A genre or example association alone is insufficient.',
  rare: 'Rare change: strongly prefer preserving the current state. Require a clear, affirmative request for this property or capability in the current utterance; do not infer it as a side effect of another change. When clearly requested, select it normally: rarity is not a reason to reduce confidence in an explicit request.',
};
const policies = {
  songQuery: { level: 'deliberate' },
  action: { level: 'contextual', choices: { clear: 'rare', reset: 'rare' } },
  countFirst: { level: 'contextual' },
  countLast: { level: 'contextual' },
  countIntervals: { level: 'contextual' },
  countDivisions: { level: 'contextual' },
  tempo: { level: 'contextual' },
  tempoHigh: { level: 'deliberate' },
  beats: { level: 'contextual' },
  subDivs: { level: 'contextual' },
  swing: { level: 'deliberate' },
  volume: { level: 'deliberate' },
  loopRepeats: { level: 'deliberate' },
  soundPack: { level: 'rare' },
  loopMode: {
    level: 'contextual',
    scope:
      'A requested drum placement or edit authorizes drum mode as a required dependency. Do not require a separate mode-switch request.',
  },
  playSubDivs: { level: 'deliberate' },
  kick: {
    level: 'rare',
    scope:
      'A current request for a custom drum pattern authorizes choosing this lane as part of that pattern.',
  },
  hat: {
    level: 'rare',
    scope:
      'A current request for a custom drum pattern authorizes choosing this lane as part of that pattern.',
  },
  snare: {
    level: 'rare',
    scope:
      'A current request for a custom drum pattern authorizes choosing this lane as part of that pattern.',
  },
};
const shared =
  ' Interpret the smallest set of changes that satisfies the current request. Apply the change policy before choosing an answer and reporting confidence. History resolves references and relative edits; it does not renew past instructions. Retrieved examples are suggestions, not evidence of user intent. Negated or merely mentioned changes are not requests. Explicit means semantic intent, not exact keywords. If evidence is insufficient choose keep when available. These are product preferences, not measured probabilities.';
const contextGuidance =
  ' Interpret short replies, bare values, fragments, and continuations generically across every musical property and operation. Weigh the explicit meaning and units of the current utterance, the recent conversational topic and its recency, the current player state, ordinary musical plausibility, supported choices, and whether the user is correcting, replacing, adding to, or continuing the last request. No single factor is an automatic routing rule. Explicit meaning can establish a new topic; otherwise recent context can resolve an omitted target when the value plausibly fits. Do not blindly assign a value to the last-mentioned property if the context no longer fits. Recent turns can establish the topic even if not applied; applied=false still means no state change occurred. Interpret the intended quantity before checking whether the player can execute it. A value outside a supported range can still clearly refer to that quantity: select unsupported, preserve the player state, and never substitute a nearby value or reinterpret it as another property merely to make it executable. If there is no relevant context or explicit target, a bare number in the existing supported 20–320 BPM range is likely tempo; this is a model preference only, not a narrower normal-range cutoff or a rule overriding context. Choose one coherent interpretation across all questions; preserve properties not implicated by that interpretation instead of applying the same value to several settings. A lone value is not automatically a performed count-off; interpret the speech and rhythm context. When uncertainty remains, preserve uncertain settings rather than inventing intent.';

export const interpretationPolicy = contextGuidance + shared;
export function applyChangePolicy(questions) {
  for (const [field, question] of Object.entries(questions)) {
    const policy = policies[field];
    if (!policy) throw new Error(`Missing change policy: ${field}`);
    question.instructions +=
      ` Follow state.interpretation_policy. Before selecting a value, identify what the current request refers to using recent_turns and current_config. Choose keep if it targets another property. Change policy: ${policy.level}. ${levels[policy.level]}`;
    if (policy.scope) question.instructions += ' ' + policy.scope;
    for (const [option, level] of Object.entries(policy.choices || {})) {
      question.instructions += ` For choice ${option}, override the field policy with ${level}: ${levels[level]}`;
    }
  }
}
