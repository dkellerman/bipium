import corpus from './reference-index.json' with { type: 'json' };
const stop = new Set(
  'a an the me my i give make beat groove pattern with and at in for some something please want to of it'.split(
    ' ',
  ),
);
export function retrieve(prompt) {
  const counts = {};
  const add = k => (counts[k] = (counts[k] || 0) + 1);
  for (const word of prompt.toLowerCase().match(/[a-z0-9]+/g) || []) {
    if (stop.has(word)) continue;
    add('w:' + word);
    add('w:' + word);
    const padded = ` ${word} `;
    for (const n of [3, 4])
      for (let i = 0; i <= padded.length - n; i++) add('c:' + padded.slice(i, i + n));
  }
  const vector = Object.entries(counts)
    .filter(([k]) => corpus.idf[k])
    .map(([k, n]) => [k, (1 + Math.log(n)) * corpus.idf[k]]);
  const norm = Math.hypot(...vector.map(([, v]) => v)) || 1;
  const words = (prompt.toLowerCase().match(/[a-z]+/g) || []).map(w =>
    w.length > 4 && w.endsWith('y') ? w.slice(0, -1) : w,
  );
  const ranked = corpus.refs
    .map(r => {
      const similarity = vector.reduce((sum, [k, v]) => sum + (v / norm) * (r.vector[k] || 0), 0);
      const labels = r.title.toLowerCase().match(/[a-z]+/g) || [];
      const boost = labels.filter(w => words.includes(w) && !stop.has(w)).length;
      return { ...r, similarity, rank: similarity + boost };
    })
    .sort((a, b) => b.rank - a.rank);
  const result = [];
  for (const source of ['Thump', 'GMD']) {
    const seen = new Set();
    for (const r of ranked.filter(r => r.source === source)) {
      if (seen.has(r.title)) continue;
      seen.add(r.title);
      const { vector, search, rank, ...reference } = r;
      result.push(reference);
      if (seen.size === 2) break;
    }
  }
  return result;
}
export const corpusCount = corpus.refs.length;
