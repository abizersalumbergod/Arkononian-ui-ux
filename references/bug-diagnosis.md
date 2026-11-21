# Bug diagnosis

A disciplined loop for bugs that are not obvious and for performance regressions: build a fast, deterministic pass/fail signal first, reproduce and shrink the failure, rank falsifiable hypotheses, instrument one variable at a time, fix behind a regression test, and clean up. The symptom tables in [troubleshooting](troubleshooting.md) come first for known signatures; this module takes over when they do not match or their fix does not hold.

**Load when:** something is broken, throwing, wrong or slow and the cause is not already named by a table in [troubleshooting](troubleshooting.md); a quality gate fails for an unclear reason; a fix was tried and the symptom came back. **Owns:** the six-phase diagnosis loop, the completion test for a feedback loop, hypothesis format, instrumentation hygiene, the performance branch, redaction while debugging, and the cleanup checklist.
**Related:** [troubleshooting](troubleshooting.md), [test-driven-development](test-driven-development.md), [codebase-design](codebase-design.md), [visual-testing](visual-testing.md), [performance](performance.md), [security-and-privacy](security-and-privacy.md), [quality-gates](quality-gates.md), [review-and-handoff](review-and-handoff.md)

## Decision rules

1. **The feedback loop is the work.** A tight pass/fail signal that goes red on this bug lets you find the cause by bisection, hypothesis or instrumentation. Without one, reading code is guessing. Spend disproportionate effort on the loop before any theory.
2. **No hypothesis before a red-capable command exists.** You can name one command (a test, a script, a request, a browser script) that you have already run once, that drives the real code path, asserts the user's exact symptom, gives the same verdict every run, finishes in seconds and runs without a human. Show its invocation and output.
3. **Reproduce the user's failure, not a neighbour.** Wrong bug means wrong fix. Capture the exact symptom (message, wrong value, timing) so the fix can be checked against it.
4. **Minimise once it is red.** Cut inputs, callers, config, data and steps one at a time, re-running after each cut, until every remaining element is load-bearing. The minimal repro is the future regression test.
5. **Three to five ranked hypotheses, each falsifiable**: "If X is the cause, changing Y makes it disappear and changing Z makes it worse." A hypothesis with no prediction is discarded or sharpened. Show the ranked list to the user when they are present, and proceed with your ranking if they are not.
6. **Change one variable at a time.** Each probe maps to a prediction. Prefer a debugger or REPL inspection to logs, targeted logs to broad ones, and never log everything and grep.
7. **Tag every temporary log** with a unique prefix such as `[DEBUG-a4f2]` so cleanup is one search.
8. **Performance bugs: measure first.** Establish a baseline (timing harness, profiler, query plan, a lab run of the page) before changing anything, then bisect. Label lab numbers as lab ([quality-gates](quality-gates.md), Gate E).
9. **Write the regression test before the fix, only at a correct seam**: one where the test exercises the real bug pattern at its call site. If the only available seam is too shallow, a test there gives false confidence; that absence is itself the finding, recorded and passed to [codebase-design](codebase-design.md).
10. **Redact before showing.** Replace every secret in commands, output and captured artifacts with `<REDACTED>`; drive loops from environment variables; quote only the lines that carry the signal ([SKILL.md §1](../SKILL.md), rule 6). If the redacted output is not enough, say so and ask.
11. **If no loop can be built, stop and say so.** List what was tried and ask for one of: access to the environment that reproduces it, a redacted captured artifact (network export, log, recording with timestamps), or permission for temporary instrumentation. Instrumenting production is a change to production infrastructure and needs approval.
12. **Stop after three failed fixes** on the same symptom ([troubleshooting](troubleshooting.md), rule 13): write down the evidence, mark the gate `FAIL` or `BLOCKED`, and ask or move to an independent task.

## Specifications

### Ways to build a loop, in rough order of preference

| # | Loop | Use it when |
|---|---|---|
| 1 | A failing test at the seam that reaches the bug | A seam exists ([test-driven-development](test-driven-development.md)) |
| 2 | A request script against the running dev server | The bug is in an endpoint or a server render |
| 3 | A command with a fixture input diffed against a known-good output | Build steps, generators, transforms |
| 4 | A headless browser script that drives the UI and asserts on DOM, console and network | The bug is visible only in the page (`scripts/visual-check.mjs` is the starting point) |
| 5 | Replay of a captured request, payload or event log through the code path | A real input triggers it |
| 6 | A throwaway harness exercising one function or a minimal subset | The system is too heavy to boot |
| 7 | A property or fuzz loop with many random inputs | "Sometimes wrong output" |
| 8 | An automated bisection between two known states (commit, dataset, version) | It used to work |
| 9 | A differential run of old against new, or two configs | Behaviour changed between versions |
| 10 | A guided manual loop: numbered steps the user performs, with the output pasted back | A human must click; last resort |

Tighten the loop once it exists: faster (cache setup, narrow scope), sharper (assert the specific symptom, not "did not crash"), more deterministic (pin time, seed randomness, isolate storage, freeze the network). A thirty-second flaky loop is barely better than none; a two-second deterministic one is a superpower.

For intermittent bugs the goal is a higher reproduction rate, not a clean repro: loop the trigger a hundred times, run in parallel, add load, narrow timing windows. A bug that fails half the time is debuggable; one in a hundred is not yet.

### The six phases

| Phase | Done when |
|---|---|
| 1 Build the loop | The red-capable command exists, has run once, and is fast, deterministic and unattended |
| 2 Reproduce and minimise | The loop shows the user's symptom across runs; every remaining element is load-bearing |
| 3 Hypothesise | 3 to 5 ranked, falsifiable hypotheses, shown to the user when present |
| 4 Instrument | Each probe maps to a prediction; one variable at a time; logs tagged |
| 5 Fix and regress | Regression test red before and green after (or the missing seam is documented); the original, un-minimised scenario passes |
| 6 Clean up | The checklist below is complete |

## Implementation

Hypothesis line to write down for each candidate:

```text
H2 (likely): the hero image is lazy-loaded and discovered late.
  If true: setting fetchpriority=high and removing loading=lazy lowers LCP by >300 ms in the same lab run.
  If false: LCP does not move, and the next suspect is H3 (render-blocking font CSS).
```

When the forced red came from mutating code or a fixture, diff against a pristine copy to prove the mutation landed before trusting the red.

Cleanup checklist, all required before declaring done:

- The original reproduction no longer fails (re-run the phase 1 loop).
- The regression test passes, or the absence of a correct seam is documented.
- No tagged debug lines remain (search the prefix).
- Throwaway harnesses are deleted or moved to a clearly marked debug location.
- The hypothesis that turned out right is stated in the commit or change description, so the next person learns from it.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| The loop is red but for a different reason than the user's | Discard it; wrong bug means wrong fix |
| The bug disappears when instrumented (timing, race) | Raise the reproduction rate with stress and timing control, then use non-intrusive probes such as counters and trace events |
| The bug exists only on a device or account you cannot reach | Ask for a redacted capture or a screen recording with timestamps; mark the affected gate `NOT TESTED` with the reason |
| A fix works only in the minimal repro | Re-run the original scenario; the minimisation removed a load-bearing element, so restore it |
| The cause is in a dependency | Pin or upgrade within the project's policy ([frontend-architecture](frontend-architecture.md)); record the version; do not patch `node_modules` |
| You catch yourself theorising before the command exists | Stop; that is the failure this module prevents |

## Verification

- The final report names the loop command, its first red output, and its green output after the fix (redacted).
- The regression test is listed, or the missing seam is named.
- The hypothesis that held and the ones that were falsified are recorded in the finding's `cause` and `verification` fields.
- No secrets appear in anything shown, and no tagged debug lines remain.

## Sources

- Adapted and extended from the MIT-licensed `diagnosing-bugs` skill by Matt Pocock (the loop-first discipline, the red-capable completion test, ranked falsifiable hypotheses, tagged instrumentation, the correct-seam rule). Rewritten for this package: the web-specific loops, the redaction and approval rules, the stop rule and the gate mapping are new.
