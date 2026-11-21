# Lean code

The smallest change that fully solves the task, and the review, audit and debt-ledger reports that keep a codebase from filling with code nobody needed. Lean means the least new code for the whole problem. It never means skipping callers, tests, accessibility or the states a visitor will meet.

**Load when:** writing, fixing or refactoring code, choosing a dependency, reviewing a diff or auditing a repository, or the user asks for the simplest solution, says YAGNI, or complains about bloat and over-engineering. **Owns:** the smallest-complete-change ladder and its web substitutions, what is never cut, lean levels, the shortcut comment convention and debt ledger, the review and audit report format, and the rule against invented savings numbers.
**Related:** [frontend-architecture](frontend-architecture.md), [test-driven-development](test-driven-development.md), [codebase-design](codebase-design.md), [review-and-handoff](review-and-handoff.md), [performance](performance.md), [accessibility](accessibility.md), [quality-gates](quality-gates.md), [troubleshooting](troubleshooting.md)

## Decision rules

1. **Be lazy about the solution, never about the change.** Finish every part the task needs, including the callers, tests and fixtures the change breaks. The shortest working diff wins only after you know everything it must touch; a one-liner that needs decoding is not short.
2. **Scope before code.** Read the task and the code it touches. List every place the change must reach (callers, tests, fixtures, configuration, exports) and what it could break for users (data it would destroy or expose, callers that stop working). That list is scope. Extra features are not.
3. **Take the first option that fully works:** (1) does it need to exist at all; (2) is it already in this codebase, used the way the surrounding code uses it; (3) does the platform or standard library do it, unless the project has its own (a house component beats a native widget); (4) does an installed dependency do it; (5) can it be one line a reader gets at a glance; (6) otherwise the minimum code that works. Name skipped features in one line.
4. **Never add a dependency for a few lines.** A new dependency must pass the checklist in [frontend-architecture](frontend-architecture.md) and is recorded in the [design decision record](../templates/design-decision-record.md).
5. **No abstraction, wrapper, conversion, option, configuration, boilerplate or "for later" code that nobody asked for.** Keep values in the form the platform gives you, keep the structure the codebase already has, and prefer deleting to adding.
6. **Moved or merged code keeps its error handling and validation.**
7. **Bug fix: grep every caller first, then fix the root cause once** in the shared code, not in one caller.
8. **Between options of equal size, take the one that is correct on edge cases** (empty, zero, last item, rounding, time zones).
9. **Never cut what the gates require:** validation at trust boundaries, error handling that prevents data loss, security, accessibility, loading, empty and error states, a reduced-motion path, asset fallbacks, tests for critical journeys, and anything the user asked for. Where lean advice conflicts with these, [SKILL.md §2](../SKILL.md) levels 1 to 3 win and the conflict goes in the DDR.
10. **Lazy code without its check is unfinished.** New non-trivial logic (a branch, a loop, a parser, money, security, a new script or app) leaves one small test or an assertion-based self-check ([test-driven-development](test-driven-development.md)). Trivial changes need none.
11. **Mark a shortcut that has a known limit** with a comment of the form `shortcut: <the limit>, <when to upgrade>`, so deferrals can be listed and cannot silently become permanent.
12. **Comment only the why the code cannot show**, in one line.
13. **Lean code is not lean design.** Fewer lines never justifies dropping sections, states or content the product needs ([SKILL.md §1](../SKILL.md), rule 7).
14. **End a build reply with one or two lines:** what was skipped or not checked, and any risk the user must know.
15. **Reviews and audits are reports.** One shot, nothing changed, ordered by importance: correct, safe, holds under load, tested, fast, lean. Every finding needs a concrete case ("this input leads to this wrong result"); no case, no finding. No style taste and no "consider".
16. **Never print invented savings.** Code that was never written has no baseline. Report only counted facts: lines and dependencies added or removed in the diff, markers in the ledger.

## Specifications

### Lean levels

| Level | Behaviour |
|---|---|
| Light | Build what was asked; name the smaller option in one line and let the user pick |
| Standard (default) | Rules 1 to 14 |
| Strict | Also question the request: before building, push back once on any part the need does not justify, then follow the user's decision |

A level lasts until the user changes it or says to stop.

### Web substitutions (reach for the left before the right)

| Instead of | Prefer |
|---|---|
| A custom modal, accordion, tooltip or menu script | `dialog`, `details`, the popover attribute, the `inert` attribute, native form controls |
| A JavaScript layout or sticky helper | CSS grid, flexbox, `position: sticky`, container queries, `:has()`, `scroll-snap` |
| A carousel or animation library for one effect | CSS transitions and keyframes, scroll-driven animation where supported, the Web Animations API |
| A utility library for one function | The platform method, or the few lines inline |
| A date or number library for display | `Intl` formatters |
| A JavaScript image resizer or lazy loader | `srcset`, `sizes`, `loading`, `decoding`, `picture` |
| A client state library for a form | Native form state and the `FormData` API |
| A whole icon or font family | The few glyphs used, subset and self-hosted |

Each substitution still needs the fallbacks and accessibility checks of [accessibility](accessibility.md) and [responsive-design](responsive-design.md); "native" is a starting point, not a pass.

### Never cut

| Item | Why |
|---|---|
| Input validation at trust boundaries | Security and data integrity |
| Error handling that prevents data loss | Gate H |
| Accessibility semantics, focus, labels | Gate D |
| Loading, empty, error and offline states | Gate B |
| A reduced-motion path and a no-JavaScript or no-3D fallback | Gates D and E |
| Asset fallbacks and dimensions | Gates E and G |
| A test for each critical journey | Gate B |

### Review and audit report

Use very simple English: short sentences, everyday words, each technical term explained once. The reader may never have seen this code.

Start with what was reviewed (`What this change does:` or `What this repo does:`, two or three sentences) and the load assumed (one person running a script, or many people and processes at once). Then group findings, skipping empty groups:

| Group | Contents | Maps to severity |
|---|---|---|
| Must fix | Bug, security hole, data loss, breaks at the expected load | critical or high |
| Should fix | Risky code without a test, real slowness, duplication, a function that mixes jobs, code that should not exist | medium |
| Nice to have | Small speed-ups, shorter forms | low |

Number findings across the groups so the user can say "fix 2 and 5"; cap an audit at twenty and say how many smaller ones were left out. Each finding has four short parts:

```text
2. Orders land on the wrong day (billing/close_day.js:L40-52)
   - What this is: At midnight this job closes the day and bills all orders of that day.
   - Problem: It takes "today" from the server clock, which runs in UTC. An order placed at 00:30 in Berlin is billed the day before.
   - Fix: Compute the day once in the shop's time zone. One line, nothing else changes.
   - If we skip it: Late orders show the wrong date and someone fixes them by hand.
```

End with `Verdict:` (ship, or what to fix first), `Lean: -N lines, -M dependencies possible.` when lean findings exist, and `Not checked:` listing what was not read or run. Nothing found: say so and one line on what was checked.

What to look for, in order:

| Class | Examples |
|---|---|
| Bug | Wrong result, crash, missed edge case, a caller broken by the change, a fix applied in one caller while the shared function stays broken |
| Risk | Injection, weak randomness, secrets in code, missing checks on user input, swallowed errors, writes in the wrong order |
| Scale | Check-then-write races, the same work in every process, lists that only grow, a query per item, quadratic work on large input |
| Missing test | Risky logic with no test that fails when it breaks (one good test, not coverage) |
| Speed | Big slowdowns are problems; small wins are suggestions |
| Lean | Delete (dead code, unused options), reuse (a helper already exists), platform (the platform already does it), yagni (an interface with one implementation, a pass-through wrapper), merge (near copies that change together), split (one function with several unrelated jobs, split by job and never by line count) |

### Debt ledger

List every `shortcut:` marker so a deferral cannot rot. Search the working tree, skipping ignored and dependency folders:

```bash
git grep --no-index --exclude-standard -nE '(#|//|/[*]) ?shortcut:'
```

One row per marker, grouped by file: `<file>:<line>, <what was simplified>. ceiling: <the limit>. upgrade: <the trigger to revisit>.` Tag any marker that names no upgrade trigger `no-trigger`. End with `<N> markers, <M> with no trigger.` Report only; write the ledger to a file only when asked.

## Implementation

1. Before writing: read the task and the touched code, then list the places the change reaches and the risks (rule 2).
2. Walk the ladder in rule 3 and the web substitutions; stop at the first option that fully works.
3. Write the smallest complete change with its check (rule 10); mark any shortcut (rule 11).
4. Before declaring done, grep callers of everything whose signature, return value or behaviour changed.
5. Reply with the change, then one or two lines on what was skipped and the risk.
6. For a review or audit, read the connected code and not only the diff, trace the main flows end to end, and confirm each finding by re-reading the lines (the caller exists, the value can really be empty, the code is really unused after searching tests, fixtures, configuration and dynamic references).

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| Lean advice says to drop something the brief or a gate requires | Keep it; log the conflict in the DDR |
| A "lean" rewrite loses an edge case | Restore it; correctness first |
| A finding has no concrete case | Drop it |
| A marker names a limit that the expected load already crosses | Promote it to a finding |
| Code looks unused but is referenced dynamically or from configuration | Keep it until the search of the whole tree, including strings, shows nothing |
| The user wants the full-featured version after a strict-level push back | Build what they chose; record the decision |

## Verification

- The diff touches every caller, test and fixture the change affects, and the check for new logic exists and passes.
- No gate item listed under "never cut" was removed.
- Reports contain only findings with a concrete case, grouped and numbered, with `Not checked:` filled in honestly.
- No savings figure appears unless it was counted from the diff or the ledger.

## Sources

- Adapted and extended from the MIT-licensed `ponytail` skill family by Dietrich Gebert (the smallest-complete-change ladder, the shortcut convention, the review, audit and debt reports, the honesty rule on savings). Rewritten for this package: the web substitutions, the gate-driven never-cut list, the severity mapping and the report wording are new, and the published benchmark card was dropped because its figures cannot be reproduced here.
