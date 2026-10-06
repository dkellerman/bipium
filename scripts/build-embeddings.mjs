// Builds server/voice/embeddings.json, the vector store retrieval searches: an embedding
// for every catalog style (styles.json, basics included), every recorded groove in the
// reference corpus and every glossary entry. Run after build-styles.mjs or a glossary
// change, with OPENROUTER_API_KEY in the environment or .env.local:
//   node scripts/build-embeddings.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { EMBEDDING_MODEL, embed, pack } from '../server/voice/embed.mjs';
import { nameOf } from '../server/voice/grid.mjs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const styles = read('server/voice/styles.json');
const corpus = read('server/reference-index.json');
const glossary = read('server/voice/glossary.json');

const env = { ...process.env };
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
} catch {}
if (!env.OPENROUTER_API_KEY) throw Error('OPENROUTER_API_KEY is not set.');

// Patterns in the slot names the drum questions use ("& of 2"), at sixteenth resolution.
const hits = steps => (steps.length ? steps.map(step => nameOf(step / 4, 4)).join(', ') : 'none');
const patternText = (pattern, beats) =>
  `Pattern over ${beats} beats: kick on ${hits(pattern.kick)}; snare on ${hits(pattern.snare)}; hat on ${hits(pattern.hat)}.`;
const thump = Object.fromEntries(
  corpus.refs.filter(r => r.source === 'Thump').map(r => [r.title, r.guide]),
);

// Each entry has `about`, what's embedded (what it is, without hit lists, which would swamp
// the meaning), and `text`, what Jev reads if it's retrieved (with the pattern).
const items = [
  ...styles.map(s => {
    const about = thump[s.name] ?? `${s.name}.${s.tempo ? ` Around ${s.tempo} bpm.` : ''}`;
    return {
      kind: 'style',
      key: s.name,
      about,
      text: `${about} ${patternText(s.pattern, s.beats)}`,
    };
  }),
  ...corpus.refs
    .filter(r => r.source !== 'Thump')
    .map(r => {
      const about = `${r.title}: ${r.guide.split('. Played')[0]}.`;
      return { kind: 'groove', key: r.title, about, text: `${about} ${patternText(r.pattern, 4)}` };
    }),
  ...glossary.map(g => ({ kind: 'term', key: g.term, text: `${g.term}: ${g.meaning}` })),
];

const vectors = [];
for (let i = 0; i < items.length; i += 128) {
  vectors.push(
    ...(await embed(
      env,
      items.slice(i, i + 128).map(x => x.about ?? x.text),
    )),
  );
  console.log(`Embedded ${Math.min(i + 128, items.length)}/${items.length}`);
}

writeFileSync(
  'server/voice/embeddings.json',
  JSON.stringify({
    model: EMBEDDING_MODEL,
    items: items.map(({ about, ...item }, i) => ({ ...item, vector: pack(vectors[i]) })),
  }) + '\n',
);
console.log(`Wrote ${items.length} embeddings.`);
