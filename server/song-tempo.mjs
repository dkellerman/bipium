const cache = new Map();
const normalize = s => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export function songCandidates(prompt) {
  const words = prompt.replace(/[.!?]+$/, '').replace(/\s+please$/i, '').trim().split(/\s+/).slice(-24);
  return Object.fromEntries(words.map((_, i) => ['s' + i, words.slice(i).join(' ')]));
}
export async function lookupSongTempo(query, signal) {
  const key = normalize(query);
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return { ...saved.song, cached: true };
  const [title, artist] = query.split(/\s+by\s+/i);
  const fetchJson = async path => {
    const response = await fetch('https://api.reccobeats.com/v1/' + path, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    });
    if (!response.ok) throw Error('Song lookup is unavailable. Kept the current beat.');
    return response.json();
  };
  const found = await fetchJson('track/search?searchText=' + encodeURIComponent(title) + '&size=25');
  const matches = (found.content || []).filter(t =>
    normalize(t.trackTitle || '') === normalize(title) &&
    (!artist || t.artists?.some(a => normalize(a.name) === normalize(artist))),
  ).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  if (!matches.length) throw Error('Couldn’t find that song. Try its title and artist.');
  // Without an artist, accept a clearly dominant recording; do not guess between peers.
  const best = matches[0];
  const other = matches.find(t => normalize(t.artists?.[0]?.name || '') !== normalize(best.artists?.[0]?.name || ''));
  if (!artist && other && (best.popularity || 0) - (other.popularity || 0) < 15)
    throw Error('Several songs match. Say the title and artist.');
  if (!/^[a-f0-9-]{36}$/i.test(best.id)) throw Error('Couldn’t read that song. Kept the current beat.');
  const features = await fetchJson('track/' + best.id + '/audio-features');
  const bpm = Number(features.tempo);
  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 320)
    throw Error('No usable BPM was found for that song. Kept the current beat.');
  const song = { id: best.id, title: best.trackTitle, artist: best.artists.map(a => a.name).join(', '), bpm: Math.round(bpm), source: 'ReccoBeats', url: best.href };
  if (cache.size >= 256) cache.delete(cache.keys().next().value);
  cache.set(key, { song, expires: Date.now() + 3600000 });
  return { ...song, cached: false };
}
