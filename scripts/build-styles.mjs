// Builds server/voice/styles.json, the style catalog Jev chooses from.
// Thump (see data/README.md) contributes one entry per named style; it has no plain
// rock/pop/jazz-style basics, so a few common ones are written out below.
// Patterns are sixteenth-note steps over `beats` beats (0 = beat 1).
import { readFileSync, writeFileSync } from 'node:fs';

const eighths = [0, 2, 4, 6, 8, 10, 12, 14];
const basics = [
  { name: 'Basic Backbeat', tempo: 100, pattern: { kick: [0, 8], snare: [4, 12], hat: eighths } },
  { name: 'Rock', tempo: 110, pattern: { kick: [0, 8, 10], snare: [4, 12], hat: eighths } },
  { name: 'Pop', tempo: 110, pattern: { kick: [0, 6, 8], snare: [4, 12], hat: eighths } },
  { name: 'Hip-Hop', tempo: 90, pattern: { kick: [0, 7, 10], snare: [4, 12], hat: eighths } },
  { name: 'Punk', tempo: 180, pattern: { kick: [0, 6, 8], snare: [4, 12], hat: eighths } },
  {
    name: 'House',
    tempo: 124,
    pattern: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
  },
  { name: 'Shuffle', tempo: 100, pattern: { kick: [0, 8], snare: [4, 12], hat: eighths } },
  {
    name: 'Jazz Swing',
    tempo: 140,
    pattern: { kick: [], snare: [], hat: [0, 4, 6, 8, 12, 14] },
  },
  {
    name: 'Bossa Nova',
    tempo: 130,
    pattern: { kick: [0, 6, 8, 14], snare: [0, 6, 12], hat: eighths },
  },
  { name: 'Country', tempo: 120, pattern: { kick: [0, 8], snare: [2, 6, 10, 14], hat: [] } },
  { name: 'Waltz', tempo: 90, beats: 3, pattern: { kick: [0], snare: [4, 8], hat: [0, 4, 8] } },
];

const corpus = JSON.parse(readFileSync('server/reference-index.json', 'utf8'));
const styles = basics.map(style => ({ beats: 4, ...style }));
for (const ref of corpus.refs.filter(r => r.source === 'Thump')) {
  const range = ref.guide.match(/Tempo range: (\d+)\s*-\s*(\d+)/);
  styles.push({
    name: ref.title,
    beats: 4,
    tempo: range ? Math.round((Number(range[1]) + Number(range[2])) / 2) : null,
    pattern: ref.pattern,
  });
}

if (styles.length > 254) throw Error(`${styles.length} styles exceed one Jev choice question.`);
writeFileSync('server/voice/styles.json', JSON.stringify(styles) + '\n');
console.log(`Wrote ${styles.length} styles.`);
