# Bipium agent instructions

## Mandatory: this is an AI app; interpretation belongs to Jev

NEVER add hardcoded interpretation or intent-driven behavior without the user's explicit approval for that exact behavior. This applies to new features, fixes, emergency work, fallbacks, and optimizations. Being useful, passing tests, or resembling an existing exception is NOT approval.

### Required approval process

1. Before implementing an exception, explain the exact proposed hardcoded behavior and ask the user for explicit permission.
2. After approval, record it in the approved-exceptions register below BEFORE implementing it: exact behavior, scope/files, user's approving words, and limitations.
3. No matching record means no permission. Do not infer permission from a broad feature request, earlier exceptions, or the existence of old code. Existing unrecorded heuristics must be surfaced and removed or explicitly approved; never silently grandfather them.
4. Expanding an exception requires a new approval and an updated record. Revoked permission must be removed from the active register.

### Interpretation boundary

- Jev interprets language and decides semantic actions and values. Preserve the original transcript and provide choices independently of wording.
- No keyword lists, phrase matching, regex/handwritten grammars, number-word parsers, transcript rewrites, or wording-based overrides that infer, constrain, reject, or redirect user intent without a matching approval record.
- No implicit local fallback when the model is uncertain or unavailable. Report the limitation and ask before proposing any hardcoded interpretation.
- Ordinary validation, transport, state management, execution of model-selected operations, arithmetic, audio signal processing, and grid calculations are implementation mechanics, not permission to infer intent.
- Count-offs go through Jev. Jev selects timing anchors and musical spacing; server code may perform the resulting arithmetic. The former count-off grammar exception was explicitly REVOKED on 2026-09-29. No number/syllable grammar or pre-model count-off bypass is permitted.
- Tests must prove that different wording cannot make code bypass Jev or override its decisions.

### Approved-exceptions register

- **Song-request handling:** User explicitly said “song request is fine” when reviewing existing hardcoded paths. Scope: the existing `server/song-tempo.mjs` candidate preparation, title/artist lookup and matching, plus execution of Jev-selected song lookups in `server/voice.mjs`, as present at commit `2084898`. This is not approval to add new phrase rules, song triggers, or semantic shortcuts.
- **Audio-only instrument/percussion analysis:** User explicitly said “instrument is fine” and previously “ok, no jev then” about arithmetic/audio detection. Scope: the existing PCM onset detection, timing estimation, and tentative accent grouping in `server/percussion.mjs`, as present at commit `2084898`. This does not authorize transcript parsing, instrument-word matching, or new automatic playback decisions.

- **Numeric context guidance (2026-09-29):** User requested that Jev weigh “the last thing said” and “a normal range for that thing,” with context-free plain numbers likely BPM, and explicitly answered “Use only the existing 20–320 supported range.” This is a GENERAL model interpretation policy across all parameters and operations; BPM and eighths were examples, not special-case implementations. Jev must jointly weigh explicit meaning/units, conversational topic and recency, player state, musical plausibility, and correction/addition/continuation intent. Scope: model instructions in `server/change-policy.mjs` may name the existing 20–320 BPM supported range and tell Jev to weigh recent context, semantic units, and plausible values. No new typical-range cutoff (the proposed 40–240 range was NOT approved), per-property heuristic thresholds, bare-number parser, number-word parser, token/suffix matcher, numeric routing branch, or model override is authorized. User further clarified that “340” immediately following “320” probably still means BPM. Supported ranges must not veto semantic interpretation: Jev identifies intent first, then reports unsupported values without substituting or redirecting them. Existing validation and execution limits remain unchanged; no playback-range expansion was authorized. “Eighths” is a semantic subdivision request for Jev to interpret, not permission to add a keyword rule.

**Whole-BPM estimates (2026-09-29):** User explicitly requested “don't sent fractional beats unless specifically requested, especially with count offs / percussion.” Scope: round inferred BPM from count-off timing and audio percussion to the nearest whole BPM in `server/count-off.mjs` and `server/percussion.mjs`, including percussion candidates. This is output precision for timing arithmetic, not language interpretation. Preserve timestamp precision, subdivisions, existing configuration, and explicit API values. Do not add transcript matching to detect requests for fractional precision; any future voice precision choice belongs to Jev.

No other hardcoded interpretation exception is recorded. Do not add one on the user's behalf.

## Delivery

- Do not create pull requests. Push authorized completed work directly to master and deploy.
- Preserve unrelated local changes; use the existing managed worktree.
- Verify changes in both classic and machine themes when UI changes are involved.
- On this machine plain `cat` may be a colorizing wrapper. Use `sed -n` or `/bin/cat` for reads.

## Mandatory: preserve the shared Pixi visualizer

- Classic and machine must use `src/components/DefaultVisualizer.tsx`. Do not copy or fork its rendering, animation, or lifecycle code for a theme. Theme differences belong in presentation props.
- Preserve the established Pixi green now-line, timing, and rendering behavior. Do not move the line outside Pixi or redesign this visualizer without the user's explicit approval.
- Keep the Pixi Application/canvas alive across beat, subdivision, swing, pattern, mode, and size updates. Never add a grid-dependent Application key. Resize the existing renderer; apply the latest dimensions after asynchronous initialization.
- Preserve explicit grid and now-line redraws after size/grid updates. These came from earlier physical-device fixes (`b841edc`, `c393021`); changing unrelated voice code must not remove them.
- Run `VisualizerLifecycle.test.tsx` after visualizer or lifecycle edits. Verify both themes. Desktop responsive mode and Chrome device emulation do NOT verify this physical-iPhone regression; never claim physical-device success without testing there.

- Voice mode must not change playback volume or apply a voice gain multiplier. Do not reintroduce automatic ducking/boosting. Microphone capture requests automatic gain control off.

## Jev questions in one request

- Use one Jev request for ordinary settings and general groove creation. The user authorized a second specialized request only when Jev classifies specific drum manipulation (2026-09-29: “ok let’s try this”; no transcript matching). Each question must be answerable from shared request state without reading another question's answer; same-call answers are evaluated independently.
- Independence is about available evidence, not musical isolation. Tempo, meter, subdivisions, swing, and patterns remain connected through the whole musical request. General groove requests may imply multiple coordinated settings; specific edits preserve unmentioned settings.
- Never instruct one question to use another question's "selected" answer. Define any shared musical span or frame in state and have each question judge its own part directly from that evidence.
- Do not add transcript parsing or deterministic intent overrides to reconcile answers. The existing explicit-approval policy still applies.

- Drum specialist scope: reuse the existing lane edit choices and grid arithmetic, send exact current configuration and recent context, and return the same client setConfig API with the chosen mode. Preserve unrelated behavior; no additional language heuristics or capability expansion.
