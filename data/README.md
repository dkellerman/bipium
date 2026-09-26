# Beat reference corpus

Downloaded 2026-09-26 from the two sources used in the Jev research:

- **Thump by Aphelion**: https://aphelion.music/thump — all 237 linked style pages,
  archived in `thump-pages/`. Their notes, tempo ranges, and kick/snare/hat patterns
  produce 237 indexed references. Source authors retain their rights; pages are
  retained as research inputs with per-entry attribution, not republished as UI pages.
- **Groove MIDI Dataset**, Gillick et al., Google Magenta:
  https://magenta.tensorflow.org/datasets/groove
  Complete MIDI-only v1.0.0 archive: 1,150 MIDI performances, downloaded from
  https://storage.googleapis.com/magentadata/datasets/groove/groove-v1.0.0-midionly.zip
  Licensed CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
  Paper: https://arxiv.org/abs/1905.06118

The research extractor indexes the first usable bar of each 4/4 beat performance
that contains kick, snare, and at least two hat/ride events: 436 references. Fills,
other meters, and performances without those lanes remain in the downloaded raw
archive but are not represented as playable references. This is the full research
index, not an index of every bar in the archive.

Adaptations: MIDI timing is quantized to a 16-step grid; velocity and microtiming
are omitted; ride/open/closed hat events map to the single hat lane. References
are fallible examples, not genre rules or constraints on the user's request.

`reference-patterns.sqlite`: 673 rows in `refs`, including source URL, source notes,
search text, complete patterns, and normalized sparse TF-IDF vectors.
`reference-idf.json`: corpus feature weights.
`../server/reference-index.json`: equivalent runtime export, built from the SQLite
rows. Runtime retrieval uses cosine similarity plus explicit title-word matching,
returning two distinct examples per source. No neural embeddings or embedding API.

Refresh in a Python virtual environment with requests, beautifulsoup4, and mido:

```
python scripts/references/build.py
```

This downloads every current Thump page and the full MIDI archive, rebuilds SQLite,
and exports the runtime index. Review counts and source changes before publishing.
