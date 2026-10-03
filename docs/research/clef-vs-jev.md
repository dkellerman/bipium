# Clef / Clef-flash vs Jev for Bipium voice interpretation

Researched 2026-10-02, one day after Clef launched. All prices and limits are as published on that date.

Labels used below:

- **[vendor]**: claim made only by the company selling the model.
- **[independent]**: measured by a third party (the community Decision Index on Hugging Face).
- **[measured here]**: computed from this repo, offline, with no API calls.

## TL;DR

| Dimension | Jev 1.13 (`jev-1.13.0`) | Clef (27B) | Clef-flash (9B) |
| --- | --- | --- | --- |
| Quality (general) | Decision Index 57.91 [independent] | 61.21, self-reported [vendor] | 57.07, self-reported [vendor] |
| Quality (large option sets) | CLINC150 89.3, BANKING77 79.7, POP909 18.1% [independent] | 97.4 / 94.2 / 15.8% [vendor] | 66.8 / 90.9 / **1.6%** [vendor] |
| Calibration | ECE 0.074, Brier 0.356 [independent] | Not published | Not published |
| Latency | ~263 ms median hosted API across 48 benchmarks [independent]; 524 ms in Cloudflare's own test [vendor] | 209 ms median, on-GPU [vendor] | 39 ms median, on-GPU [vendor] |
| Price, input tokens | $0.042/M; output free | $0.24/M (5.7x Jev) | $0.09/M (2.1x Jev) |
| Est. cost per main request (~9.6K tokens) | ~$0.0004 | ~$0.0023 | ~$0.0009 |
| Max options per choice | 255 | 255 | 255 |
| Questions per request | Not stated as a hard cap | 64 | 64 |
| Context | 64K total; 32K for state + longest question | 64K hosted; 16K default when self-hosted | same as Clef |
| Question independence | Documented: answers do not affect each other | Joint cross-field attention (answers can depend on other questions) | same as Clef |
| Access | `api.typesafe.ai/v1/systemone`, `TYPESAFE_API_KEY` | Workers AI binding, REST `/ai/run`, AI Gateway; not on OpenRouter | same as Clef |

**Recommendation: do not switch yet.** Clef costs more than Jev for our payload. Its quality lead is self-reported and comes mostly from intent-classification benchmarks. On the one music task with a large option set, Clef-flash collapses and Clef trails Jev. The "13x faster" figure compares on-GPU compute with Jev's network round trip. Run the cheap replay evaluation below (under $2 in model spend) before deciding; revisit when the independent board scores Clef.

## 0. How Bipium uses Jev today

- **The README is stale.** It says the Worker calls OpenRouter Decisions with `typesafe/jev-1.13` and `OPENROUTER_API_KEY` ([README.md](../../README.md), "Voice and Jev"). Commit `5902af7` (2026-09-29) replaced `https://openrouter.ai/api/alpha/decisions` with `https://api.typesafe.ai/v1/systemone` and `env.TYPESAFE_API_KEY` ([server/voice.mjs](../../server/voice.mjs), `evaluate`). The OpenRouter path is gone.
- **Request shape [measured here].** I ran `prepare()` / `prepareDrumEdit()` offline under vitest with the default config. Token counts are tiktoken `o200k_base`, a proxy only; Jev's and Qwen's tokenizers will differ by some percent.

| Request | JSON bytes | ~Tokens | Questions | Total options | Largest choice |
| --- | --- | --- | --- | --- | --- |
| Main, minimal ("faster", no history) | 31,361 | ~9.2K | 19 | 826 | `tempo` 229 |
| Main, 6 turns + 4 count-off words | 32,753 | ~9.6K | 19 | 840 | `tempo` 229 |
| Drum edit, 4/4 sixteenths | 22,948 | ~5.4K | 4 | 170 | `hat` 75 |
| Drum edit, 12 beats x 8 subdivisions | 81,806 | ~19.4K | 4 | 804 | `hat` **395** |

About two thirds of the main request is question/criteria text (22 KB), not shared state (10 KB). The other large choices are `loopRepeats` 131, `swing` 108, `volume` 105, `tempoHigh` 81 and `countIntervals` 80.

- **Existing bug, independent of Clef.** Both Jev and Clef cap a choice at 255 options ([Typesafe API reference](https://docs.typesafe.ai/api.md); [Clef input schema](https://developers.cloudflare.com/workers-ai/models/clef/schema-input.json)). On large grids the detailed drum lane choices already exceed that cap. A fully-hit lane gets about 4 options per grid step, so any grid of roughly 64+ steps (e.g. 8 beats x 8 subdivisions) goes over 255; 12x8 reaches 395. This needs fixing whichever model we use.

## 1. Quality vs Jev

### Who ran what

- **Cloudflare's headline "7 of 10" table** covers BFCL, ToolRet, API-Bank, Home appliances, When2Call, BANKING77, CLINC150+OOS, BRIGHT, Amazon ESCI and PhishNChips. Cloudflare ran it and chose the 10 benchmarks [vendor] ([blog](https://blog.cloudflare.com/clef-decision-models/), [changelog](https://developers.cloudflare.com/changelog/post/2026-10-01-clef-workers-ai/)). Most of these are tool-calling and intent-routing tasks.
- **The full panel** is Cloudflare's leaderboard site ([clef-evals](https://clef-evals.workers-ai-mle.workers.dev), data at `/data/leaderboard.json`). It layers Clef onto the community board [Decision Index 0.2.1 by multimodalart](https://huggingface.co/spaces/multimodalart/jev-decision-index), which measures on "1 x NVIDIA RTX PRO 6000". Cloudflare's own page says: "Clef scores and latency are self-reported (missing benchmarks scored 0; latency not measured on the board's hardware)". Clef does not appear in the upstream board's model list or data (`data/index.json`, generated 2026-09-28). **No independent Clef score exists yet.**
- **Chance-corrected index on the 38-benchmark panel:** Clef 61.21 [vendor], Jev 57.91 [independent], Clef-flash 57.07 [vendor] ([leaderboard.json](https://clef-evals.workers-ai-mle.workers.dev/data/leaderboard.json)). Clef-flash ranks below Jev overall.
- **Where Jev leads, even on Cloudflare's numbers:** BBH 92.9 vs 73.7, GPQA 78.3 vs 48.0, MMLU-Pro 82.7 vs 65.9, When2Call 81.0 vs 72.4, HoVer, ANLI and VAST ([leaderboard.json](https://clef-evals.workers-ai-mle.workers.dev/data/leaderboard.json); [HF model card](https://huggingface.co/Cloudflare/clef)).
- **Typesafe's WorkflowEvals.** The datasets are Typesafe's ([HF collection](https://huggingface.co/collections/typesafe/workflowevals-6abaf8dcb1e283d9e3d57b6b)), but Cloudflare ran the Clef numbers: Clef 64.7 / 76.3 / 62.9 / 68.5 vs Jev 61.8 / 76.0 / 61.7 / 71.6 [vendor] ([blog](https://blog.cloudflare.com/clef-decision-models/)). The four-area means are 68.1 (Clef), 66.4 (Clef-flash) and 67.8 (Jev). That Jev mean matches Typesafe's own site ([evals.typesafe.ai](https://evals.typesafe.ai), 67.8%), which does not list Clef. The margin is small.

### Large option-set choice questions (most relevant to us)

These are the closest public analogues to our 80 to 229-option choices:

| Benchmark (options) | Jev [independent] | Clef [vendor] | Clef-flash [vendor] |
| --- | --- | --- | --- |
| BANKING77 (77 intents), macro-F1 | 79.7 | 94.2 | 90.9 |
| API-Bank (53 APIs), acc | 88.2 | 91.9 | 93.1 |
| CLINC150+OOS (151), macro-F1 | 89.3 | 97.4 | **66.8** |
| POP909-CL (129 chords, music), acc | 18.1 | 15.8 | **1.6** (chance 0.8) |

Sources: [leaderboard.json](https://clef-evals.workers-ai-mle.workers.dev/data/leaderboard.json), with benchmark descriptions from the same file; Jev values cross-checked against the [upstream data](https://huggingface.co/spaces/multimodalart/jev-decision-index/resolve/main/data/index.json). The [Clef-flash card](https://huggingface.co/Cloudflare/clef-flash) itself flags the POP909-CL result as a weak spot.

Reading: Clef (27B) looks strong on large intent sets, but those are vendor numbers. **Clef-flash degrades sharply once options pass about 100.** That matters for `tempo` (229), `loopRepeats` (131) and `swing` (108). None of these benchmarks test our specific pattern: numeric option labels (`n:20`..`n:240`) mixed with relative options. Jev's docs warn that Jev is weaker on numbers and counting ([Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md)). Nobody has published comparable data for Clef.

### Confidence and probabilities semantics

- **Jev.** `confidence = (p_max - 1/n) / (1 - 1/n)` for choices; nouls carry no confidence ([Typesafe Confidence](https://docs.typesafe.ai/confidence.md)). On a 3-option question (`loopMode`, `soundPack`, `playSubDivs`), our `> 0.5` gate therefore means p_max > 2/3. On `tempo` it means p_max > ~0.5.
- **Clef.** The output schema has the same fields (`choice`, `probabilities` summing to 1, `confidence`), but only says confidence is "derived from the probabilities" with no formula ([output schema](https://developers.cloudflare.com/workers-ai/models/clef/schema-output.json)). If the formula differs, our 0.5 threshold changes meaning silently. Mitigation: compute confidence ourselves from `probabilities` using Typesafe's formula. That is arithmetic, not interpretation.
- **Calibration.** The independent board measured Jev at ECE 0.074 and Brier 0.356 ([leaderboard.json](https://clef-evals.workers-ai-mle.workers.dev/data/leaderboard.json), Jev row, `source: community`). Clef's ECE and Brier are `null`. Cloudflare says it trained with label-smoothed CE plus a Brier loss and "RLCD" [vendor] ([blog](https://blog.cloudflare.com/clef-decision-models/)), but published no calibration metric.

### Multi-question independence (design risk)

- **Jev documents independence:** "Every answer is independent... You can add or remove questions without changing the others' results" ([Primitives](https://docs.typesafe.ai/primitives.md)). AGENTS.md ("Jev questions in one request") builds on this.
- **Clef does the opposite by design:** "individual field parameters ... cross-attend with other fields and back to the original payload prior to scoring ... joint cross-field attention" ([blog](https://blog.cloudflare.com/clef-decision-models/)). The model card says the head "scores all options of all questions jointly" ([HF card](https://huggingface.co/Cloudflare/clef)).
- **Consequence:** with Clef, a lane answer could differ between the main request (19 questions) and the drum-edit request (4 questions) for the same state. Adding a speculative question could also shift `tempo`. That might help coherence or might cause cross-talk; it is untested. It also weakens the AGENTS.md guarantee that each answer is judged only from shared state.

## 2. Latency

- **Cloudflare's numbers [vendor]:** Clef median 209.3 ms / p95 238.6; Clef-flash 38.8 / 122.4; Jev 524.1 / 536.0 ([changelog](https://developers.cloudflare.com/changelog/post/2026-10-01-clef-workers-ai/)). **The "13x" is Clef-flash** (524.1 / 38.8). Clef alone is 2.5x.
- **This is not apples to apples.** Cloudflare's own leaderboard annotates the Jev figure: "Hosted API, network round-trip from our lab: one sequential HTTPS client ... Not comparable to the on-card single-process figures" ([leaderboard.json](https://clef-evals.workers-ai-mle.workers.dev/data/leaderboard.json)). The Clef cards say their latency was measured on a single H200 ([Clef card](https://huggingface.co/Cloudflare/clef), [Clef-flash card](https://huggingface.co/Cloudflare/clef-flash)). So Clef's numbers exclude the network and Jev's include it.
- **Jev independently measured [independent]:** the upstream board records Jev hosted-API latency per benchmark. The median of its 48 per-benchmark medians is 263 ms (range 231 to 1,841 ms); POP909 is 302 ms ([upstream data](https://huggingface.co/spaces/multimodalart/jev-decision-index/resolve/main/data/index.json)). Against that, Clef-flash compute is about 7x faster and Clef about 1.3x, before adding the Workers AI network hop.
- **For our request shape:** nobody publishes latency for a ~10K-token, 19-question, 840-option request. Request sizes behind the published medians are not given. For prefill-dominated models latency grows with input tokens, so expect our numbers to be higher than any of these medians.
- **Cold start:** not documented for Clef. The Clef resource page's "No cold starts" line is generic Workers marketing ([resource page](https://www.cloudflare.com/resource/clef-rl-interest)). Unknown.
- **Context for Bipium:** the decision call sits behind speech transcription and a 15 s timeout (`AbortSignal.timeout(15000)` in `server/voice.mjs`). A 100 to 300 ms saving may not be user-visible. Measure end to end before paying for it.

## 3. Price

| | Jev | Clef | Clef-flash |
| --- | --- | --- | --- |
| Input | $0.042/M ([Typesafe Models](https://docs.typesafe.ai/models.md)) | $0.24/M ([pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)) | $0.09/M ([pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)) |
| Output | Free | Not listed | Not listed |
| Unit | Per input token, not per question | Per input token (21,818 neurons/M) | Per input token (8,182 neurons/M) |
| Free tier | None stated | 10,000 neurons/day shared, then $0.011/1K neurons on Workers Paid | same |

Per-request estimates [measured here], using ~9.6K tokens for main and ~5.4K for a typical drum edit:

| | Jev | Clef | Clef-flash |
| --- | --- | --- | --- |
| Main only | $0.00040 | $0.0023 | $0.00086 |
| Main + drum edit | $0.00063 | $0.0036 | $0.0013 |
| Per 10,000 main requests | ~$4 | ~$23 | ~$9 |
| Free-tier requests/day | n/a | ~47 | ~127 |

Workers AI pricing source: [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/). OpenRouter does not list Clef. It lists `typesafe/jev-router` with variable (`-1`) pricing ([OpenRouter models API](https://openrouter.ai/api/v1/models)); we no longer use that path.

## 4. API compatibility gaps

Cloudflare: "Clef follows the System One API, so you can switch an existing Jev integration to Clef by changing the endpoint and model" ([changelog](https://developers.cloudflare.com/changelog/post/2026-10-01-clef-workers-ai/)). Checked against both schemas:

- **Same:** `state` (string/object/array), `questions` map, `choice` + `criteria` map with 2 to 255 options, answer fields `choice` / `probabilities` / `confidence`, `usage.input_tokens` ([Clef input schema](https://developers.cloudflare.com/workers-ai/models/clef/schema-input.json); [Typesafe API](https://docs.typesafe.ai/api.md)). Our `validateAnswers()` checks would pass on a well-formed Clef answer.
- **`model` value differs:** `"clef"` or `"clef-flash"` (schema pattern `^\s*(clef|clef-flash)\s*$`), plus the model in the URL path (`/ai/run/@cf/cloudflare/clef`). `jev-1.13.0` would be rejected.
- **REST envelope:** Workers AI REST responses are wrapped in `{ result, success, errors, messages }` ([REST get-started](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)). The binding returns the bare object. Our `evaluate()` reads `result.answers` directly, so the REST path needs one unwrap.
- **Questions per request:** Clef allows at most 64. We send 19, so no issue.
- **Context:** Jev allows 64K total and 32K for state plus the longest question ([Models](https://docs.typesafe.ai/models.md)). Clef hosted allows 65,536 ([model page](https://developers.cloudflare.com/workers-ai/models/clef/)). The self-host default is 16,384 `max_length` ([HF card](https://huggingface.co/Cloudflare/clef)), which our worst-case drum edit (~19K) would exceed. Clef's schema says "Long text state is truncated to fit the model's token limit" (truncated silently, not rejected).
- **Clef extras:** `images` (up to 4) and vision. We don't need them.
- **Jev extras:** versioned IDs and aliases (`jev-latest`, `jev-preview`) for pinning ([Models](https://docs.typesafe.ai/models.md)), published confidence formulas, and the published "jaggedness" guide. Clef's equivalents are not documented.
- **Rate limits:** Jev allows 100K tokens/s and 80 req/s, "adjusting dynamically" ([Models](https://docs.typesafe.ai/models.md)). Clef is listed as "Text Generation", whose default is 300 req/min ([limits](https://developers.cloudflare.com/workers-ai/platform/limits/)). Inferred from the task label; there is no Clef-specific limit.

## 5. Access from Bipium

- **Not on OpenRouter** ([models API](https://openrouter.ai/api/v1/models), searched for `clef`/`cloudflare` on 2026-10-02).
- **Paths:** the Workers AI binding `env.AI.run("@cf/cloudflare/clef", ...)`, REST `POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/cloudflare/clef`, or either through AI Gateway (`cf-aig-gateway-id` header) ([model page](https://developers.cloudflare.com/workers-ai/models/clef/), [AI Gateway Workers AI](https://developers.cloudflare.com/ai-gateway/usage/providers/workersai/)).
- **Credentials:** a Cloudflare account ID plus an API token with `Workers AI - Read` and `Workers AI - Edit` ([REST get-started](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)). Store them as two GPT Sites secrets (e.g. `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_TOKEN`).
- **From the GPT Sites Worker:** REST is a plain `fetch` with a bearer token, the same pattern as today's Typesafe call. The build writes a `wrangler.json` without an `ai` binding (`scripts/build-server.mjs`). Whether GPT Sites runs on a Cloudflare account we control, which a binding would need, is unknown, so plan on REST.

## 6. Split traffic and fine-tuning (lower priority)

- **Splitting.** The evidence argues against putting the main request on Clef-flash, because that request holds the 100+ option questions where flash degrades (see section 1). A flash split only makes sense if the large numeric choices are restructured, e.g. split into digit-group choices. Drum edits have 45 to 75 options per lane at common sizes, so Clef could plausibly handle them. Mixing models would mean two confidence semantics and two independence behaviors.
- **Fine-tuning on Cloudflare.** An "RL fine-tuning service", initially "hands-on ... with our forward-deployed engineer (FDE) team", later self-serve; sign-up is a design-partner form; pricing and timeline are not disclosed [vendor] ([blog](https://blog.cloudflare.com/clef-decision-models/), [resource page](https://www.cloudflare.com/resource/clef-rl-interest)).
- **Self-serve LoRA on Workers AI does not cover Clef.** Supported LoRA bases are listed models, with adapter rank up to 32 ([LoRA docs](https://developers.cloudflare.com/workers-ai/features/fine-tunes/loras/)). Clef itself is a routing head plus rank-256 adapters on a frozen Qwen base ([blog](https://blog.cloudflare.com/clef-decision-models/)).
- **Self-hosting.** Apache-2.0 weights run on vLLM or SGLang ([HF card](https://huggingface.co/Cloudflare/clef)). The model uses custom code (`custom-code` tag), so you would fine-tune the head and adapters yourself on a GPU. That is a large step up in ops for a metronome.
- **Jev fine-tuning:** Jev "is not fine-tuned or LoRA-adapted with customer data"; customization happens through state, instructions and criteria ([Models](https://docs.typesafe.ai/models.md)).

## Recommendation

**Stay on Jev for now.** Clef costs 2.1x to 5.7x more per token. The Clef evidence is all self-reported, and the independent board has not scored it. Clef-flash fails the most relevant analogue (POP909, 129-way music choice) and drops on CLINC150. The latency headline mixes on-GPU compute with a network round trip. Joint cross-field attention also breaks the independence our AGENTS.md design relies on. Clef (27B) is a credible candidate, mainly on intent-like large-choice tasks, so it is worth one cheap measurement.

Do these regardless of model:

1. Fix the >255-option drum-edit lanes (they fail on Jev today).
2. Compute confidence from `probabilities` with the published Typesafe formula instead of trusting the provider's `confidence`, so a model swap cannot silently move the 0.5 gate.
3. Update the README's OpenRouter text.

### Low-cost evaluation plan

1. **Corpus (free).** Build ~150 to 200 request bodies with `prepare()` / `prepareDrumEdit()` offline:
   - the 11 cases in `scripts/check-voice-edits.mjs`;
   - prompts from `src/tests/VoiceServer.test.mjs` and `DrumSpecialist.test.mjs`;
   - real `jevRequest` / `drumEditRequest` objects returned by `/api/voice` in recent sessions;
   - deliberate coverage of exact BPMs (including 241 to 320), relative tempo, swing %, repeats, count-offs with timing words, and multi-lane edits.

   Label the expected final call for at least 60 of them.
2. **Replay (about $1 to $2).** POST each body to Jev (existing key), and to `@cf/cloudflare/clef-flash` and `@cf/cloudflare/clef` over REST with `model` rewritten. 200 requests x ~10K tokens x 3 models is ~$0.08 for Jev, ~$0.48 for Clef and ~$0.18 for Clef-flash, plus a repeat run for variance. Clef at ~209 neurons/request exceeds the 10K free neurons/day after ~47 calls: use Workers Paid or spread the runs over several days.
3. **Diff.** Per question, compare:
   - top choice agreement with Jev;
   - gated selection (>0.5) agreement;
   - confidence from both the provider field and our recomputed formula;
   - the final `assemble()` output (the call that would execute).

   Score against labels where present. Report by question family: tempo/tempoHigh, swing, loopRepeats, count-off, action, lanes.
4. **Behavior probes.**
   - Independence: ask `tempo` alone vs in the full 19 and diff the probabilities.
   - Main vs drum-edit lane answers for the same state.
   - Option order: shuffle `criteria` order (Jev's documented first-option bias).
5. **Latency.** From the deployed Worker, time 3 runs per request per model and report p50/p95 end to end, plus `usage.input_tokens` to compare tokenizer counts.
6. **Decision rule.** Switch (or split) only if a Clef variant matches or beats Jev on labeled final-call accuracy, with no regression on tempo or count-off. Its p50 end-to-end gain must also be one a user would notice, against roughly 2x to 6x higher model cost.

## Open questions

- Clef's confidence formula. Does it equal Typesafe's?
- Independent Clef scores and calibration (ECE/Brier) once the upstream Decision Index adds it.
- Workers AI latency for Clef at about 10K input tokens, cold vs warm, from a non-Cloudflare-account Worker.
- Does GPT Sites run our Worker in a Cloudflare account where an `ai` binding could be added?
- Does Jev reject or truncate over-limit state? Clef truncates silently.
- Exact token counts under each provider's tokenizer (our figures are a tiktoken proxy).
- RL fine-tuning service pricing, availability and minimum data requirements.
