# Agent writing

How to write any document an agent reads: a skill, an instructions file such as `AGENTS.md`, a doc reached through a pointer. The packaging differs; the writing does not. The same levers make an agent take the same process every run: where each piece sits, how a pointer is worded, what ends a step, and what to prune.

**Load when:** creating or editing a skill or this package, writing or trimming a project's agent instructions file, writing a brief, hand-off or standards document an agent will consume, or an agent keeps missing a rule that is written down. **Owns:** context pointers, the two loads, the information hierarchy, completion criteria, splitting, leading words, the negation trap, pruning, and the skill-specific choices (invocation, router, split).
**Related:** [review-and-handoff](review-and-handoff.md), [repo-guardrails](repo-guardrails.md), [skill-delegation](skill-delegation.md), [interview-and-specs](interview-and-specs.md), [prose-humanizing](prose-humanizing.md), [quality-gates](quality-gates.md), [craft-library](craft-library.md)

## Decision rules

1. **A pointer's wording decides when material is reached.** A context pointer names out-of-context material and encodes the condition for reaching it (a skill description, a line in an instructions file naming a doc). A must-have target behind a weak pointer is a variance bug: sharpen the wording first, and inline the material only if sharpening fails.
2. **A pointer states what the material is and lists the branches that trigger it.** A branch is a distinct case the document handles. Front-load the leading word, give one trigger per branch (synonyms for one branch are one branch written twice), and cut identity the body already carries.
3. **Spend the two loads on purpose.** Context load is the cost of always-loaded material on the agent's window; cognitive load is the cost on the human, who is the index of what exists. Material reached only through a pointer escapes context load at the price of the pointer's line; material with no pointer rides entirely on cognitive load.
4. **Place each piece on the hierarchy.** Steps (what the agent does, in order) are the primary tier; in-file reference is consulted on demand and may be a legitimately flat set of rules; disclosed reference lives in another file behind a pointer. Inline what every branch needs; push behind a pointer what only some branches reach.
5. **Co-locate.** Keep a concept's definition, rules and caveats under one heading so reading one part brings its neighbours. Scattering one meaning across many places is as costly as duplicating it.
6. **Sprawl is a failure mode.** A document that is simply too long thins attention even when every line is live. Cure it with disclosure and by splitting by branch or sequence, so each path carries only what it needs.
7. **Every step ends on a completion criterion** that is clear (the agent can tell done from not done) and demanding (it forces the digging: "every modified model accounted for" beats "produce a change list"). The strongest criteria are checkable and exhaustive. A vague bound invites premature completion; sharpen it first, and split the sequence across a real context boundary only if the rush persists.
8. **Split only when the cut earns its cost:** by sequence (when later steps tempt the agent to rush the current one) or by invocation (a separate skill needs its own trigger word or must be reachable by other skills).
9. **Use leading words.** A compact concept already in the model's pretraining (lesson, fog of war, tracer bullet, seam) repeated as a token anchors a region of behaviour in few tokens, in the body (execution) and in a pointer (invocation). Reach for an existing word before coining one; a made-up word must be defined.
10. **Prompt the positive.** Steering by prohibition drags the forbidden behaviour into context and makes it more available. State the target behaviour; use a prohibition only as a hard guardrail you cannot phrase positively, and pair it with the positive target.
11. **One source of truth per meaning.** Duplication costs maintenance and tokens and inflates a meaning's prominence. Treat the environment (scripts, configuration files, layout, `--help` output) as a source of truth too: a document that restates it is a cache, justified only when the lookup is expensive. Cache what the agent cannot find by looking: unwritten conventions, the reason behind a choice, a gotcha no file confesses.
12. **Prune for relevance and no-ops.** Remove lines that no longer bear on the task or have gone stale; sediment builds because adding feels safe and removing feels risky. A sentence that does not change behaviour relative to the model's default is a no-op: delete the whole sentence rather than trim words, and settle disagreements by running the document, not by debate. If a word is too weak to beat the default, use a stronger word, not another technique.
13. **An always-loaded instructions file holds navigation pointers, sparingly.** Standards read during review live in a standards file; reference lives in docs reached by pointer; behaviour that a check can enforce belongs in a check ([repo-guardrails](repo-guardrails.md)).

## Specifications

### Skills: invocation choices

| Choice | What it is | Trade | Use when |
|---|---|---|---|
| Model-invoked | Has a description the agent can fire on; other skills can reach it; a person can still type its name | Permanent context load for discoverability | The agent must reach it on its own, or another skill must |
| User-invoked | No agent-visible description; only a person can start it | Zero context load, but cognitive load: the person is the index | It only ever fires by hand |

Shared reference that two user-invoked skills both need lives in neither: with no descriptions, neither can fire the other. Put it in a plain file both can point at. A model-invoked skill that is all reference can be the shared home. Split off a model-invoked skill only when a distinct trigger word you actually use should fire it alone, or another skill must reach it.

When user-invoked skills multiply past what a person can remember, add a **router**: one user-invoked entry that names the others and when to reach for each. It can only hint; it cannot fire them.

### How this package applies the rules

| Rule | In this package |
|---|---|
| Progressive disclosure | `SKILL.md` orchestrates; modules load only when the router or a stage selects them |
| One owner per topic | Each reference module owns one topic; others link to it |
| Completion criteria | Every stage has an exit check; every workflow ends with a "Done when" check |
| Single source of truth | The master document is generated from the modules, never edited by hand |
| Pointer wording | The `description` front matter carries the trigger branches; module "Load when" lines carry the rest |
| Pruning | Gate A validates links and reachability so dead modules and dead links cannot accumulate |

### Review checklist for an agent-facing document

| Check | Question |
|---|---|
| Pointer | Does its wording name the branches that should fire it, front-loaded? |
| Hierarchy | Is each piece at the right tier, with branch-only material behind a pointer? |
| Criteria | Does each step end on a checkable, exhaustive condition? |
| Duplication | Is any meaning stated twice, or restated from the environment? |
| Negation | Is any behaviour steered by a ban instead of a target? |
| No-ops | Does each sentence change behaviour compared with the default? |
| Sediment | Is every line still true and still relevant? |

## Implementation

1. Decide what the document is for and who reads it (agent, human, both); list its branches.
2. Write the steps with their completion criteria; place reference by branch; write the pointer last, from the branches.
3. Run the review checklist; delete no-ops and restatements of the environment.
4. When the document is part of this package, finish with Gate A (`node <skill-dir>/scripts/validate-skill.mjs`) and the tests in `tests/`.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| The agent keeps skipping a rule | Sharpen the pointer wording; if still missed, inline it |
| The always-loaded file keeps growing | Move reference to docs behind a pointer; move enforceable rules to checks |
| A step ends too early | Sharpen the completion criterion; only then hide later steps behind a split |
| Two documents say the same thing | Pick one owner and replace the other with a pointer |
| A prohibition keeps being violated | Rephrase as the positive target |

## Verification

- Each pointer names its trigger branches; each step has a completion criterion that can be checked.
- No meaning is stated in two places, and no line restates the environment without a reason.
- Gate A passes when this package changed.

## Sources

- Adapted and extended from the MIT-licensed `writing-for-agents` skill by Matt Pocock (context pointers, the two loads, the information hierarchy, completion criteria, leading words, the negation trap, pruning, and the skill mechanics). Rewritten for this package with the package-specific mapping and the review checklist added.
