# Bipium agent instructions

## Mandatory: language interpretation belongs to the model

NEVER add hardcoded natural-language interpretation without asking the user first and receiving explicit approval. This is a mandatory architectural constraint, including fixes and emergency work.

- Do not introduce keyword lists, phrase matching, regular expressions, handwritten grammars, number-word parsers, transcript corrections, or special-case substitutions to infer a user's musical command.
- Do not use those techniques to narrow the decisions offered to Jev, override its answers, reject a command, or infer mode, instrument targets, positions, amounts, or exact values.
- Jev interprets the user's language and chooses semantic actions and values. Preserve the original transcript. Provide sufficient choices independently of how the user spells or phrases the request.
- Ordinary code may validate model output and execute selected operations, including arithmetic, audio processing, supported ranges, and minimum subdivision-grid fitting.
- If the model/API cannot express a requested operation reliably, explain the limitation and ask before introducing any hardcoded language workaround. Never silently approximate an exact requested value.
- The user explicitly approved the existing count-off analysis, song-request handling, and instrument/percussion detection. Preserve these exceptions; they do not authorize new command-parsing shortcuts.
- Tests must verify this boundary: changing command wording must not cause local code to select or override the model's command decisions.

## Delivery

- Do not create pull requests. Push authorized completed work directly to master and deploy.
- Preserve unrelated local changes; use the existing managed worktree.
- Verify changes in both classic and machine themes when UI changes are involved.
- On this machine plain `cat` may be a colorizing wrapper. Use `sed -n` or `/bin/cat` for reads.
