// Retrieved context for Jev: reference grooves from the research corpus and entries
// from a glossary of musical terms. Both use the same sparse character n-gram TF-IDF
// similarity; nothing here decides intent, it only supplies vocabulary and examples.
import corpus from '../reference-index.json' with { type: 'json' };
import glossary from './glossary.json' with { type: 'json' };

function features(text) {
  const counts = {};
  const add = k => (counts[k] = (counts[k] || 0) + 1);
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) || []) {
    // Whole words count double relative to their character n-grams.
    add('w:' + word);
    add('w:' + word);
    const padded = ` ${word} `;
    for (const n of [3, 4])
      for (let i = 0; i <= padded.length - n; i++) add('c:' + padded.slice(i, i + n));
  }
  return counts;
}

function vectorize(text, idf) {
  const vector = Object.entries(features(text))
    .filter(([k]) => idf[k])
    .map(([k, n]) => [k, (1 + Math.log(n)) * idf[k]]);
  const norm = Math.hypot(...vector.map(([, v]) => v)) || 1;
  return Object.fromEntries(vector.map(([k, v]) => [k, v / norm]));
}

const similarity = (a, b) => Object.entries(a).reduce((sum, [k, v]) => sum + v * (b[k] || 0), 0);

const glossaryIdf = (() => {
  const df = {};
  for (const entry of glossary)
    for (const k of Object.keys(features(entry.term + ' ' + entry.meaning))) df[k] = (df[k] || 0) + 1;
  return Object.fromEntries(
    Object.entries(df).map(([k, n]) => [k, Math.log((1 + glossary.length) / (1 + n)) + 1]),
  );
})();
const glossaryIndex = glossary.map(entry => ({
  entry,
  // The term is what users say; weight it above the explanation.
  vector: vectorize(`${entry.term} ${entry.term} ${entry.meaning}`, glossaryIdf),
}));

const thumpRefs = corpus.refs.filter(r => r.source === 'Thump');
// Names alone, so a style the user names isn't drowned out by the rest of the sentence
// ("beats per minute", numbers) matching words in the reference write-ups.
const thumpNames = thumpRefs.map(r => ({ name: r.title, vector: vectorize(r.title, corpus.idf) }));

/** Names of the catalog styles closest to the text, for Jev to choose among: the closest
 * by name, then the closest by reference write-up. */
export function candidateStyles(text, count = 16) {
  const query = vectorize(text, corpus.idf);
  const ranked = items =>
    items
      .map(r => ({ name: r.name ?? r.title, score: similarity(query, r.vector) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.name);
  const byName = ranked(thumpNames).slice(0, count / 2);
  return [...new Set([...byName, ...ranked(thumpRefs)])].slice(0, count);
}

export function retrieveContext(text, { grooves = 4, terms = 8 } = {}) {
  const groove = vectorize(text, corpus.idf);
  const reference_grooves = corpus.refs
    .map(r => ({ r, score: similarity(groove, r.vector) }))
    .sort((a, b) => b.score - a.score)
    .filter((x, i, all) => all.findIndex(y => y.r.title === x.r.title) === i)
    .slice(0, grooves)
    .map(({ r }) => `${r.title}: ${r.guide}`);
  const query = vectorize(text, glossaryIdf);
  const terminology = glossaryIndex
    .map(({ entry, vector }) => ({ entry, score: similarity(query, vector) }))
    .filter(x => x.score > 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, terms)
    .map(({ entry }) => `${entry.term}: ${entry.meaning}`);
  return {
    terminology,
    reference_grooves,
    reference_note: 'Terminology and grooves are retrieved by text similarity and may be irrelevant. The user\'s words take priority.',
  };
}
