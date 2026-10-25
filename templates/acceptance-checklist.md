# Acceptance checklist

Per-project checklist that maps every acceptance item to quality gates A-H. Copy it into the project (for example `qa/acceptance-checklist.md`), fill the header, tick items only when evidence exists from this session, and transfer results into `quality-report.json`. Definitions, thresholds and status rules live in [quality-gates](../references/quality-gates.md); fixes live in [troubleshooting](../references/troubleshooting.md).

## How to fill it

- `[x]` = verified this session, with evidence path or command in the Evidence column.
- `[ ]` = not done. Give the status: `FAIL`, `BLOCKED (reason)`, `NOT_TESTED (reason)` or `N/A (reason)`.
- Never tick an item because the code "should" work. Source written, builds, renders, works, accessible, responsive and performant are separate items.
- Never edit a threshold in this file to make an item pass. Record a justified exception in the Exceptions table instead.
- Evaluation mode for C, D, F, H: `live-browser`, `screenshots-only` or `code-only`.

## Project header

| Field | Value |
|---|---|
| Project | |
| Scope (routes, components) | |
| Build tested (prod / dev, commit or date) | |
| Stack detected (framework, version, styling, package manager) | |
| Critical journeys (list, numbered J1, J2, ...) | |
| Viewport matrix | 320, 375, 768, 1280, 1920 px (default) |
| Browsers / devices actually used | |
| Evaluation mode | |
| Tools verified (`available-verified`) | |
| Tools unavailable or awaiting approval | |
| Date | |

## A. Skill package integrity (only when changing the arkononion-ui-ux skill itself; otherwise N/A)

| # | Item | Status | Evidence |
|---|---|---|---|
| A1 | `node scripts/validate-skill.mjs` exits 0 | [ ] | |
| A2 | `node --test tests/` all pass, skips explained | [ ] | |
| A3 | No secret patterns, no placeholder words in shipped files | [ ] | |

## B. Functional correctness

| # | Item | Status | Evidence |
|---|---|---|---|
| B1 | Install succeeds with the project's package manager (no `--force`) | [ ] | |
| B2 | Production build exits 0 | [ ] | |
| B3 | Type check exits 0 (separate from build if the bundler skips types) | [ ] | |
| B4 | Lint exits 0 or only pre-existing warnings (count recorded) | [ ] | |
| B5 | Tests pass (counts: passed / failed / skipped) | [ ] | |
| B6 | App starts with the project's own run command | [ ] | |
| B7 | Every critical journey J1..Jn completes (100%) | [ ] | |
| B8 | 0 inert primary CTAs (every primary button/link does something real) | [ ] | |
| B9 | Content states covered: default, loading, empty, error, success, long/short text | [ ] | |
| B10 | Forced API errors handled (400, 401, 403, 404, 429, 5xx) where the UI calls APIs | [ ] | |
| B11 | Rapid repeat submit and refresh mid-flow do not corrupt state | [ ] | |

## C. Visual quality

| # | Item | Status | Evidence |
|---|---|---|---|
| C1 | Screenshots captured per viewport and key state, and read back | [ ] | |
| C2 | Critique logged per the visual-critique rubric, with severities | [ ] | |
| C3 | 0 open `high` or `critical` visual findings in scope | [ ] | |
| C4 | Direction matches the brief / DDR (not a default style) | [ ] | |
| C5 | Both themes checked (if dark mode exists) | [ ] | |
| C6 | Anti-generic lint counts recorded (em-dashes, eyebrows, mixed icon sets) | [ ] | |
| C7 | Edge content tested: 100+ char names, emoji, RTL/CJK if localised, large numbers | [ ] | |

## D. Accessibility (WCAG 2.2 AA target)

| # | Item | Status | Evidence |
|---|---|---|---|
| D1 | Automated scan (axe tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, target-size enabled) per state | [ ] | |
| D2 | 0 serious/critical axe violations; `incomplete` items reviewed | [ ] | |
| D3 | Keyboard pass: tab order, visible focus, Enter/Space/Escape, no traps | [ ] | |
| D4 | Landmarks, one `h1`, heading order, accessible names on controls | [ ] | |
| D5 | Text and UI contrast meet AA (4.5:1 body, 3:1 large text and UI components) | [ ] | |
| D6 | Target size at least 24x24 CSS px or spaced (SC 2.5.8) | [ ] | |
| D7 | Reduced motion respected (no essential info lost) | [ ] | |
| D8 | Screen-reader spot check (state which reader, or NOT_TESTED) | [ ] | |
| D9 | 0 open critical accessibility findings | [ ] | |

## E. Performance (label every number lab or field)

| # | Item | Status | Evidence |
|---|---|---|---|
| E1 | Measured on the production build, not the dev server | [ ] | |
| E2 | LCP ≤ 2.5 s (p75 field; lab value labelled) | [ ] | |
| E3 | INP ≤ 200 ms (p75 field; lab proxy TBT labelled) | [ ] | |
| E4 | CLS ≤ 0.1 | [ ] | |
| E5 | Median of at least 3 runs, same conditions; spread reported | [ ] | |
| E6 | LCP image not lazy-loaded; media sized to rendered dimensions | [ ] | |
| E7 | Immersive/3D pages: device budget stated and cheaper fallback evidenced | [ ] | |

## F. Responsive

| # | Item | Status | Evidence |
|---|---|---|---|
| F1 | No unintended horizontal overflow at 375, 768, 1280, 1920 px | [ ] | |
| F2 | 320 px reflow (SC 1.4.10) without loss of content or function | [ ] | |
| F3 | No clipped text, overlapping controls or CTA wrapping into broken shapes | [ ] | |
| F4 | No hover-only functions; touch alternatives exist | [ ] | |
| F5 | Navigation usable at every matrix width | [ ] | |
| F6 | 200% text zoom keeps content readable | [ ] | |

## G. Asset integrity

| # | Item | Status | Evidence |
|---|---|---|---|
| G1 | Asset manifest exists and lists every shipped asset | [ ] | |
| G2 | `node scripts/asset-validation.mjs --manifest <file>` run; exit code recorded | [ ] | |
| G3 | 100% critical assets resolve, valid format, within budget | [ ] | |
| G4 | Every asset has a licence and provenance (route: native, external, procedural, retrieved) | [ ] | |
| G5 | Critical assets have a fallback (poster, static image, no-WebGL view) | [ ] | |
| G6 | No hotlinked placeholder images in the production build | [ ] | |

## H. Reliability and security

| # | Item | Status | Evidence |
|---|---|---|---|
| H1 | 0 console errors in tested flows | [ ] | |
| H2 | 0 failed critical network requests | [ ] | |
| H3 | No secrets in the client bundle, repo diffs, logs, screenshots or reports | [ ] | |
| H4 | User content rendered escaped (no unsafe HTML injection) | [ ] | |
| H5 | Destructive actions require confirmation | [ ] | |
| H6 | Listeners, timers, observers, tweens and WebGL resources cleaned up on unmount | [ ] | |
| H7 | Third-party services and uploads were approved by the user | [ ] | |

## Findings

| ID | Gate | Severity | Location | Issue | Status (open / fixed / accepted) | Verification |
|---|---|---|---|---|---|---|
| | | | | | | |

## Justified exceptions

| Gate / item | What is excepted | Why (SKILL.md §2 precedence level) | Scope | Approved by (quote for critical/high) | Revisit |
|---|---|---|---|---|---|
| | | | | | |

## Sign-off

| Gate | Status (PASS / FAIL / BLOCKED / NOT_TESTED / NOT_APPLICABLE) | Reason if not PASS |
|---|---|---|
| A | | |
| B | | |
| C | | |
| D | | |
| E | | |
| F | | |
| G | | |
| H | | |

Overall from `node <skill-dir>/scripts/quality-report.mjs --report <file>` (exit 0 PASS, 1 FAIL, 2 INCOMPLETE, 3 invalid report): ________
