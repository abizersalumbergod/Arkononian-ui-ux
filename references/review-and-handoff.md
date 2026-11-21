# Review and handoff

How a change is reviewed and passed on: a two-axis review (does it follow the project's standards; does it match what was asked), a pull request body that shows the change and its risk, a handoff note so a fresh session can continue, and a retrospective that improves the environment for the next run.

**Load when:** a diff, branch or pull request needs review (Stage 10), a pull request body or change description is being written, a session ends and the work continues elsewhere, or the user asks what to improve for next time. **Owns:** the Standards and Spec axes, the smell baseline, the pull request body template, the handoff note, and the retrospective categories.
**Related:** [lean-code](lean-code.md), [test-driven-development](test-driven-development.md), [codebase-design](codebase-design.md), [interview-and-specs](interview-and-specs.md), [delivery-orchestration](delivery-orchestration.md), [repo-guardrails](repo-guardrails.md), [agent-writing](agent-writing.md), [visual-critique](visual-critique.md), [quality-gates](quality-gates.md), [terse-mode](terse-mode.md)

## Decision rules

1. **Review along two separate axes.** Standards: does the change follow this repository's documented coding standards? Spec: does it do what the originating issue or spec asked? A change can pass one and fail the other; reporting them apart stops one from masking the other. Do not merge or re-rank findings across axes.
2. **Pin the fixed point.** The user's commit, branch, tag or merge-base; if none is given, ask. Capture the diff once (three-dot form, against the merge-base) and the commit list. Confirm that the reference resolves and the diff is not empty before reviewing; fail there, not halfway through.
3. **Find the spec** in this order: issue references in commit messages, a path the user passed, a spec file in the project's docs or scratch folders that matches the branch or feature. If there is none, ask; if the user says there is none, skip the Spec axis and say so in the report.
4. **Find the standards:** every file that documents how code is written. A coding-standards or contributing file, when present, must be on the list. The smell baseline below always applies as judgement calls, and a documented repository standard overrides it. Skip what tooling already enforces.
5. **Run the axes independently.** With isolated workers, run both in parallel, each with a fresh context; without them, run one axis fully, set its notes aside, then run the other. Standards findings cite the rule (file and rule); Spec findings quote the spec line.
6. **Distinguish hard violations from judgement calls.** A breach of a documented standard can be hard; a baseline smell is always labelled "possible".
7. **Findings are actionable.** Location, problem, concrete fix; one idea per finding. Use the report format of [lean-code](lean-code.md) or the terse format of [terse-mode](terse-mode.md), as the user prefers; map severities to critical, high, medium and low for the quality report.
8. **UI changes get two more checks:** the page against the brief and tokens (no hard-coded values the tokens cover, existing components reused) in the Standards axis, and the gates ([quality-gates](quality-gates.md)) with a visual review ([visual-critique](visual-critique.md)) alongside, not instead.
9. **Refactoring happens here, after green,** never inside the red-green loop ([test-driven-development](test-driven-development.md)); keep the tests passing throughout.
10. **A pull request body leads with the smallest view that makes the point,** shows before and after evidence, and states the merge danger. No preambles, brief prose, the project's glossary words ([domain-model](domain-model.md)). Opening or editing a pull request is an external action: draft the body as text and ask before opening it ([SKILL.md §1](../SKILL.md)).
11. **Evidence is ranked.** Screenshots of a visual change are best; execution evidence (the exact test that failed and now passes, console output) is next; prose alone is the weakest.
12. **A handoff note replaces context, not artifacts.** It summarises the session so a fresh agent can continue, points to specs, tickets, decision records, issues, commits and diffs by path instead of repeating them, redacts secrets and personal data, and names which modules of this package the next session should load. Save it outside the workspace unless the user wants it in the repository.
13. **A retrospective improves the environment, not the code.** Present candidates by severity and propose; do not edit configuration unasked ([repo-guardrails](repo-guardrails.md)).

## Specifications

### Smell baseline (Standards axis; each is a labelled heuristic)

| Smell | What it is | Fix |
|---|---|---|
| Mysterious name | A name that does not say what a function, variable or type does or holds | Rename; if no honest name comes, the design is murky |
| Duplicated code | The same logic shape in more than one hunk or file | Extract the shared shape |
| Feature envy | A method that uses another object's data more than its own | Move it onto that data |
| Data clumps | The same few fields or parameters always travel together | Bundle them into one type |
| Primitive obsession | A primitive or string stands in for a domain concept | Give the concept a small type |
| Repeated switches | The same switch or if-cascade on one type recurs | One map or polymorphism |
| Shotgun surgery | One logical change forces scattered edits across files | Gather what changes together |
| Divergent change | One file is edited for several unrelated reasons | Split by reason to change |
| Speculative generality | Abstraction or parameters for needs the spec lacks | Delete; inline until a need shows |
| Message chains | Long `a.b().c().d()` navigation | Hide the walk behind one method |
| Middle man | A class or function that only delegates | Call the real target |
| Refused bequest | A subclass that ignores most of what it inherits | Prefer composition |

### Why two axes

| Result | Meaning |
|---|---|
| Standards pass, Spec fail | Clean code that does the wrong thing |
| Spec pass, Standards fail | The right behaviour, breaking the project's conventions |

End with a one-line summary: findings per axis and the worst finding within each axis. Do not pick a single winner across axes.

### Pull request body

```md
## Summary

<the smallest view that makes the key point: pseudocode, a call tree, a component tree, a shallow file tree, a sequence diagram, a diff, or the whole block when most of it is new>

## Evidence

- Before: <screenshot, output, or the failing test run>
  After: <screenshot, output, or the passing test run>

## Merge danger

Door: <one-way or two-way>
<optional: what makes it so>

Blast radius: <one word>
<optional: possible consequences, for example layout shift, broken consumers, mobile responsiveness>
```

Pick views that fit: pseudocode for logic; a call tree for runtime flow; a component tree (with state and module boundaries that matter) for UI; a file tree for a broad refactor; a sequence diagram for interaction; a diff when the point is what changes and the surrounding shape exists. Use several only when each earns its place. A two-way door is cheap to roll back; destructive or hard-to-reverse changes are one-way.

### Handoff note

```md
# Handoff: <what the next session is for>

State: what is done, what is in progress, what is blocked (a few lines).
Pointers: specs, tickets, decision records, issues, commits, diffs (paths, never copies).
Decisions and assumptions not recorded elsewhere.
Next steps, in order.
Modules to load: <names from this package>.
Open questions for the user.
```

### Retrospective categories

| Category | Look for | Typical improvement |
|---|---|---|
| Navigation | Time spent finding the right files; hidden dependencies | A one-line pointer in the project's agent instructions |
| Automated checks | A mistake a lint, type or test check could have caught; a check that exists but is unwired; a repository with no guardrail at all | Wire or add the check ([repo-guardrails](repo-guardrails.md)) |
| Coding standards | A mistake the reviewer should have caught | A mechanical violation gets a deterministic check; a judgement call goes in the standards file |
| Agent instructions | A large always-loaded file | Move steering to standards or checks; keep pointers only ([agent-writing](agent-writing.md)) |
| Tool economy | Expensive calls that could be streamlined | Cheaper tooling or narrower queries |
| No-ops | Instructions that change nothing the agent would not do anyway | Delete |
| Information access | A crucial fact the agent could not see | Tee dev-server logs, read-only access to services |

Implementation has the most context pressure (explore, write, debug); review has the least (it receives a diff), so reviewers, not implementers, should impose the coding standards.

## Implementation

1. Pin the fixed point and capture the diff and commit list; find the spec and the standards sources.
2. Run the two axes (rule 5), then a UI pass if the diff touches interface (rule 8).
3. Report under two headings, Standards and Spec, verbatim or lightly cleaned, with the one-line summary.
4. For a pull request, draft the body from the template and wait for approval to open it. For a session end, write the handoff note. For a retrospective, read the session's sources and present the candidates.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| The reference does not resolve or the diff is empty | Stop and ask for the right fixed point |
| No spec exists | Run Standards only and say the Spec axis was skipped |
| The repository documents no standards | Use the smell baseline only, as judgement calls |
| A finding is a style preference | Drop it; tooling or the documented standard decides style |
| The handoff would contain a secret | Redact it; if the secret is needed, name where it is stored |
| The user wants one merged verdict | Give the two summaries and say they are deliberately separate |

## Verification

- The report has a Standards section and a Spec section (or states why Spec was skipped), each finding with a location, problem and fix.
- Baseline smells are labelled as judgement calls and were suppressed where the repository's own standards endorse the pattern.
- A pull request body has summary, evidence and merge danger, and nothing was opened without approval.
- A handoff note contains pointers instead of copies and no secrets.

## Sources

- Adapted and extended from the MIT-licensed `code-review`, `pr`, `handoff`, `claude-handoff` and `retro` skills by Matt Pocock (the two-axis review, the smell baseline after Martin Fowler's catalogue, the three-part pull request body whose shape credits Dex Horthy, the handoff note, and the retrospective categories). Rewritten for this package with UI checks, severity mapping and approval rules added.
