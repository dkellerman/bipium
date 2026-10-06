// Retrieval for Jev: the phrase is embedded and the most similar entries in the vector
// store (embeddings.json: catalog styles, recorded grooves, glossary terms) come back as
// examples for the prompt. Nothing here decides intent; Jev reads the examples and
// chooses. Similar styles are also what the style question offers.
import store from './embeddings.json' with { type: 'json' };
import { dot, embed, unpack } from './embed.mjs';

const items = store.items.map(item => ({ ...item, vector: unpack(item.vector) }));

const nearest = (query, kind, count) =>
  items
    .filter(item => item.kind === kind)
    .map(item => ({ item, score: dot(query, item.vector) }))
    .sort((a, b) => b.score - a.score)
    .filter((x, i, all) => all.findIndex(y => y.item.key === x.item.key) === i)
    .slice(0, count)
    .map(x => x.item);

/**
 * The styles most similar to `text` (for the style question) and the examples Jev reads:
 * similar styles and recorded grooves with their patterns, and similar glossary terms.
 */
export async function retrieve(env, text, signal, { styles = 16, examples = 6, terms = 6 } = {}) {
  const [query] = await embed(env, [text], signal);
  const similarStyles = nearest(query, 'style', styles);
  const grooves = nearest(query, 'groove', 2);
  return {
    styleNames: similarStyles.map(s => s.key),
    context: {
      examples: [...similarStyles.slice(0, examples - grooves.length), ...grooves].map(x => x.text),
      terminology: nearest(query, 'term', terms).map(x => x.text),
      examples_note:
        "Examples and terminology are the entries most similar to the phrase; they may be irrelevant. The user's words take priority.",
    },
  };
}
