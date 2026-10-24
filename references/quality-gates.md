# Quality gates

Defines gates A-H, what each one accepts, how to run it with the tools that really exist in this session, the severity scale, the status rules and the quality-report format. Use it in stage 10 (Validate and repair) and stage 11 (Deliver) of [SKILL.md](../SKILL.md).

**Load when:** any task that ends in a deliverable, any audit or QA request, before writing the final report. **Owns:** gates A-H and their pass criteria, severity levels, gate statuses (PASS/FAIL/BLOCKED/NOT_TESTED/NOT_APPLICABLE), evidence rules, justified exceptions, the quality-report format and `quality-report.mjs` exit codes.
**Related:** [visual-critique](visual-critique.md), [visual-testing](visual-testing.md), [accessibility](accessibility.md), [performance](performance.md), [responsive-design](responsive-design.md), [asset-generation](asset-generation.md), [security-and-privacy](security-and-privacy.md), [capability-registry](capability-registry.md), [troubleshooting](troubleshooting.md), [acceptance checklist](../templates/acceptance-checklist.md), [report template](../templates/quality-report.json), [report script](../scripts/quality-report.mjs)

## Decision rules

1. Mark a gate PASS only when at least one evidence item `{check, tool, result}` comes from a command or tool that actually ran in this session against the deliverable in scope. Source code that looks correct is not evidence.
2. Give every FAIL, BLOCKED, NOT_TESTED and NOT_APPLICABLE status a specific `reason` naming what is missing and what would unblock it (tool, credential, approval, fix).
3. Never lower a threshold, shrink the viewport matrix, drop a critical journey or disable an axe rule to turn a gate green. Fix the root cause and re-run.
4. If a gate has an open `critical` finding, its status is FAIL, whatever the other evidence says.
5. Use BLOCKED when the check cannot run (tool `unavailable`, `requires-credentials`, `requires-approval`, build broken upstream). Use NOT_TESTED when it could run but was not run. Use NOT_APPLICABLE only when the gate's subject does not exist (no assets, not a skill package) and say why.
6. Keep build, render, interaction, accessibility, performance and responsive evidence in separate evidence items. A green build never implies a rendered, accessible or responsive UI.
7. Record the evaluation mode that actually ran for C, D, F and H: `live-browser`, `screenshots-only` or `code-only`. Never present a code-only review as a browser evaluation.
8. Never report a UI as "accessible" from automated scans alone. Gate D needs an automated scan plus a manual keyboard and focus pass; mark the screen-reader spot check NOT_TESTED if it was not done.
9. Label every performance number `lab` or `field`. Gate E thresholds are field (p75) targets; a lab run can show FAIL risk but cannot prove a field PASS. Say so in the evidence.
10. Before running any check, look up the tool's status in [capability-registry](capability-registry.md) or the `scripts/environment-audit.mjs` output, or probe MCP tools with ToolSearch. Use only `available-verified` tools; otherwise use the fallback in the gate table or mark the gate BLOCKED.
11. Never upload a client or unreleased site to a public report host (for example LHCI `temporary-public-storage`) without explicit user approval. Default to local or filesystem output.
12. Assign severity with the definitions in Specifications. If unsure between two levels, ask "would a user contact support or abandon the task?"; if yes, it is at least `high`. Never mark everything `critical`.
13. Accept an exception only with a recorded justification, scope and owner. A `critical` finding may be `accepted` only with the user's explicit approval quoted in the reason; never accept a critical security, secret-exposure or data-loss finding.
14. Mark a finding `fixed` only after re-running the check that found it; put that re-run in `verification`.
15. Validate the report with `node <skill-dir>/scripts/quality-report.mjs --report <file>` before delivering. Exit 3 means the report itself is invalid: fix the report, never the script.
16. Report the script's recomputed `overall`, never a hand-declared one. INCOMPLETE is an honest result; deliver it with the reasons rather than inventing evidence.
17. Re-run every gate whose inputs changed after a fix (a CSS fix can break F and C; an asset swap can break E and G).

## Specifications

### Gate table (defaults; thresholds are fixed unless a justified exception is recorded)

| Gate | Required when | Pass criteria | Primary checks |
|---|---|---|---|
| A. Skill package integrity | Only when this skill package is changed | `validate-skill.mjs` exit 0 and `node --test tests/` all pass | frontmatter, links, reachability, JSON/schema, secret scan |
| B. Functional correctness | Always for deliverables | 100% of defined critical journeys pass; 0 inert primary CTAs; 0 blocking runtime errors; production build, type check and tests pass | build, typecheck, lint, tests, journey run |
| C. Visual quality | Any UI | 0 unresolved `high` or `critical` visual defects in scope ([visual-critique](visual-critique.md) rubric); no invented numeric beauty score | screenshots per viewport and state, critique log |
| D. Accessibility | Any UI | WCAG 2.2 AA target; 0 open `critical` blockers in tested flows; 0 axe violations of impact serious or critical | axe scan per state, keyboard pass, focus, names, contrast |
| E. Performance | Any UI | LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75 field data (web.dev Core Web Vitals); immersive pages have a device budget and a cheaper fallback ([performance](performance.md)) | Lighthouse/trace (lab), field data if available, bundle and media weight |
| F. Responsive | Any UI | No unintended horizontal overflow, clipped text, overlapping controls or hover-only functions at 375, 768, 1280, 1920 px, plus 320 px reflow (WCAG 2.2 SC 1.4.10, equivalent to 400% zoom at 1280 px) | overflow scan, screenshots, touch/hover review |
| G. Asset integrity | Any shipped media/3D asset | 100% of critical assets resolve, valid format, within budget, licensed, have a fallback | `asset-validation.mjs` on the manifest |
| H. Reliability and security | Always | 0 console errors in tested flows; 0 failed critical requests; 0 exposed secrets; no unescaped user content; destructive actions confirm; listeners, timers, observers, WebGL contexts cleaned up | console/network capture, bundle secret grep, code review of cleanup |

Gate A sub-limits come from the skill validator: `name` lowercase letters, digits and hyphens, at most 64 characters; `description` non-empty, at most 1024 characters (skill-creator quick_validate, synced copy).

### Severity

| Severity | Definition | Gate effect | Typical examples |
|---|---|---|---|
| critical | Task cannot be completed, data loss, security or secret exposure, or a WCAG A/AA failure that blocks a flow | Gate is FAIL while open | unnamed submit button, checkout throws, API key in bundle, keyboard trap |
| high | Significant difficulty, WCAG AA violation with a workaround, broken layout at a matrix viewport | Gate C requires 0 open; fix before release | 1.4.3 contrast failure on body text, CTA wraps under hero image at 375 px |
| medium | Annoying, workaround exists | Record; fix in this pass if cheap | inconsistent spacing between sibling cards, missing empty state on a secondary list |
| low | Polish, no measurable task impact | Record; batch later | 1 px misalignment, hover easing mismatch |

Mapping from the P0-P3 scale used by impeccable's critique and audit commands: P0 = critical, P1 = high, P2 = medium, P3 = low. Many `low` findings are noise; report the systemic pattern once instead of 30 instances.

### Status vocabulary

| Status | Use when | Needs |
|---|---|---|
| PASS | Criteria met and evidenced | ≥ 1 evidence item; no open critical finding |
| FAIL | A check ran and missed the criteria, or an open critical finding exists | reason + findings |
| BLOCKED | The check could not run (tool missing, credentials, approval, upstream build failure) | reason naming the blocker and its unblock step |
| NOT_TESTED | The check could run but did not (time, scope, not yet reached) | reason |
| NOT_APPLICABLE | The gate's subject does not exist in scope | reason |

Overall result (recomputed by the script): FAIL if any gate is FAIL; else INCOMPLETE if any `required: true` gate is BLOCKED or NOT_TESTED; else PASS.

### `quality-report.mjs` exit codes

| Code | Meaning | Next action |
|---|---|---|
| 0 | overall PASS (or `--init` succeeded) | Deliver |
| 1 | overall FAIL | Fix findings, re-run checks, re-validate |
| 2 | overall INCOMPLETE | Run the missing checks or deliver with the reasons stated plainly |
| 3 | invalid report (unreadable, bad JSON, schema or honesty-rule violation) | Fix the report: missing evidence on PASS, missing reason, bad enum |
| 64 | usage error (bad arguments, refusing to overwrite `--out`) | Fix the command; use `--force` only for your own file |

### Evidence item rules

- `check`: one observable claim ("No horizontal overflow at 375x812 on /pricing").
- `tool`: the exact command or tool name run (`node scripts/visual-check.mjs --url … --viewports 375x812`, `mcp__plugin_ecc_chrome-devtools__lighthouse_audit`).
- `result`: numbers, counts, exit code. "Looks good" is not a result.
- `artifact`: relative path to the screenshot, JSON or log when one exists. Read screenshots back after capture; a file that exists proves capture, not correctness.
- One evidence item per stage: build, render, interaction, a11y, perf, responsive. Never merge them.

### Separate verification stages

| Stage | Proves | Does not prove |
|---|---|---|
| Source written | Code exists | It compiles |
| Build/typecheck | It compiles | It renders |
| Render (screenshot, no errors) | It paints at that viewport | It works or is accessible |
| Interaction (journey run) | Flows work | It is accessible or fast |
| Accessibility (axe + manual) | Tested states meet the checked criteria | Untested states, full WCAG coverage |
| Performance (lab or field) | Measured metrics under stated conditions | Other devices or networks |
| Responsive (matrix) | Tested widths | Untested devices, real touch |

### Supplementary evidence (feeds C, B and D; never replaces the gate criteria)

- Edge-case stress (from impeccable harden and the design-handoff skill): 100+ character names, empty and single-character values, emoji, RTL and CJK strings, very large numbers, 1000+ list items, 50+ select options, slow or offline network, forced API errors (400 inline, 401 re-auth, 403 permission, 404 not-found, 429 rate limit, 5xx generic plus support), 10x rapid submit, refresh mid-flow, 200% zoom.
- Content states: default, loading, empty, error, success, overflow (long and short text). Each passes or is NOT_APPLICABLE with a reason (state list owned by [interaction-design](interaction-design.md)).
- Anti-generic lint counts (rules owned by [design-intelligence](design-intelligence.md)): em-dashes in UI microcopy (target 0, report the count), eyebrow labels above headings (at most ceil(sections/3)), `transition-all`, `h-screen` on mobile heroes, arbitrary z-index values, mixed icon sets. Report counts as Gate C evidence; they are signals, not automatic FAILs.
- Optional scored audits (impeccable audit /20, ECC design-system ten dimensions 0-10) may be attached as context, but every score must cite file:line or screenshot evidence. Never use a score as the Gate C verdict.

## Implementation

### Report lifecycle

```bash
# 1. Start a report (all gates NOT_TESTED with reasons)
node <skill-dir>/scripts/quality-report.mjs --init --project my-site --scope "/ and /pricing, prod build" --out qa/quality-report.json
# 2. Run checks, append evidence and findings per gate, set statuses
# 3. Validate; act on the exit code
node <skill-dir>/scripts/quality-report.mjs --report qa/quality-report.json
echo "exit=$?"   # PowerShell: $LASTEXITCODE
```

The shape is in [quality-report.json](../templates/quality-report.json) (an example, `example: true`; never copy its evidence). Track progress with [acceptance-checklist](../templates/acceptance-checklist.md).

### How to execute each gate (check status first; fall back as listed)

| Gate | Preferred tool (if `available-verified`) | Fallback | If no fallback |
|---|---|---|---|
| A | `node scripts/validate-skill.mjs --root <skill-dir>` then `node --test tests/` | none needed (Node only) | BLOCKED: Node missing |
| B | project scripts from `package.json` (`build`, `typecheck` or `tsc --noEmit`, `lint`, `test`); Playwright journey tests if the project has them; built-in browser tools (`mcp__Claude_Browser__*`) to click through journeys | Chrome DevTools MCP click/fill; manual code trace of each handler (label `code-only`) | Journeys NOT_TESTED; build/test evidence still counts for its own item |
| C | `scripts/visual-check.mjs` screenshots, then critique per [visual-critique](visual-critique.md) | browser MCP screenshots (`take_screenshot`, `computer screenshot`) | NOT_TESTED (code-only review recorded as limitation) |
| D | `visual-check.mjs --axe` or `@axe-core/playwright` in project tests; manual keyboard pass in a live browser | Chrome DevTools `lighthouse_audit` accessibility category; static review of names, roles, labels | Automated part BLOCKED; manual part NOT_TESTED |
| E | Lighthouse 13.x CLI or Chrome DevTools `performance_start_trace` / `lighthouse_audit` on the production build; field data (CrUX / RUM) if the site is public and the user approves access | bundle and media weight from build output | NOT_TESTED; never estimate metrics |
| F | `visual-check.mjs --viewports 320x800,375x812,768x1024,1280x800,1920x1080` | browser MCP `resize_window` / `resize_page` plus screenshots and an overflow script | NOT_TESTED |
| G | `node scripts/asset-validation.mjs --manifest <file> --root <dir>` | manual check of path, format, size, licence per asset | BLOCKED for unverifiable fields (for example duration without ffprobe) |
| H | console and network capture from `visual-check.mjs` or browser MCP (`read_console_messages`, `read_network_requests`); grep the built bundle for secret patterns | code review of cleanup paths | NOT_TESTED for runtime parts |

Run order: A (if required) → B build → B tests → render → C/F screenshots → D → E → G → H. Stop at a failing build: later gates become BLOCKED with "build fails" as the reason. Pipe long logs with `set -o pipefail` (bash) so truncation keeps the real exit status (verification-loop, ECC).

### Gate D automated scan (Playwright test, only if the project already uses Playwright)

Versions at research time: axe-core 4.14.0 and @axe-core/playwright 4.14.0, both MPL-2.0. Verify at runtime (`npm view @axe-core/playwright version`). Install only as a dev dependency of the user's project.

```ts
// tests/a11y.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const STATES = [
  { name: "default", setup: async () => {} },
  // add: menu open, modal open, form error, dark theme
];

for (const s of STATES) {
  test(`a11y: ${s.name}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" }); // stable DOM for scanning
    await page.goto("/");
    await s.setup();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .options({ rules: { "target-size": { enabled: true } } }) // 2.5.8 is off by default
      .analyze();
    await testInfo.attach("axe.json", { body: JSON.stringify(results, null, 2), contentType: "application/json" });
    const blocking = results.violations.filter(v => v.impact === "serious" || v.impact === "critical");
    expect(blocking, blocking.map(v => `${v.id}: ${v.nodes.length} nodes`).join("\n")).toEqual([]);
    // results.incomplete needs human review: list it in the report, never drop it.
  });
}
```

Scan after driving the UI into the state under test. Run the same scan at 320 px width. Without Playwright, use `visual-check.mjs --axe` (it injects axe only if resolvable) and record which.

### Gate E lab run (Lighthouse CI, only with approval to add the dependency)

At research time Lighthouse is 13.5.0 (Apache-2.0, Node 22.19+) and @lhci/cli 0.15.1 bundles Lighthouse 12.6.1, so audit IDs differ between them. Verify at runtime (`npm view lighthouse version`, `npm view @lhci/cli version`).

```js
// lighthouserc.cjs
module.exports = {
  ci: {
    collect: { startServerCommand: "npm run start", url: ["http://localhost:3000/"], numberOfRuns: 3 },
    assert: {
      aggregationMethod: "median-run", // the default "optimistic" hides regressions
      assertions: {
        "categories:accessibility": ["error", { minScore: 1 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
      },
    },
    upload: { target: "filesystem", outputDir: "qa/lhci" }, // never public storage without approval
  },
};
```

Use 5 runs for noisy pages (default — adjust per product). Lab INP does not exist; record Total Blocking Time as a lab proxy and label it so.

### Overflow probe (framework-agnostic, any browser tool that can evaluate JS)

```js
(() => {
  const vw = document.documentElement.clientWidth;
  const wide = [...document.querySelectorAll("body *")]
    .filter(el => el.getBoundingClientRect().right > vw + 1)
    .slice(0, 20).map(el => el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""));
  return { vw, scrollWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > vw, wide };
})();
```

### Finding and exception format

```json
{ "id": "F-2", "severity": "high", "location": "/pricing @375x812, plan cards",
  "issue": "Third card clipped by overflow-x hidden", "impact": "Enterprise plan unreadable on phones",
  "cause": "grid-template-columns: repeat(3, 320px)", "fix": "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))",
  "status": "fixed", "verification": "visual-check.mjs 375x812: overflow false, screenshot qa/pricing-375.png read back" }
```

Justified exception: set `status: "accepted"` and put in the gate `reason` (or `limitations`): what is excepted, why (precedence level from SKILL.md §2), scope (pages, viewports), who approved (user, quoted, for critical/high), and when it must be revisited. Example: a WebGL hero exceeding the LCP lab budget on low-end mobile is accepted only if a static-image fallback ships for that tier and is evidenced.

## Failure modes & fallbacks

| Failure | Wrong reaction | Correct reaction |
|---|---|---|
| `quality-report.mjs` exits 3 | Edit the script or delete the gate | Read the listed violations; add evidence or a reason; re-validate |
| Exit 2 INCOMPLETE near the end of the task | Flip statuses to PASS | Run the missing check if possible; otherwise deliver INCOMPLETE with reasons |
| `visual-check.mjs` exits 4 (Playwright not resolvable) | Claim screenshots were taken | Use verified browser MCP tools; else mark C, D (automated), F and H runtime as BLOCKED ([troubleshooting](troubleshooting.md)) |
| Lighthouse scores swing between runs | Report the best run | Use median of ≥ 3 runs, same build, same throttling; report the spread |
| axe reports `incomplete` items | Ignore them | List them as findings for manual review |
| Build fails | Continue with screenshots of the dev server only | Fix the build first; label any dev-server evidence `dev` and keep B FAIL |
| A gate cannot meet its threshold for a sound product reason | Lower the number | Record a justified exception (rule 13) or keep FAIL |
| Dev server, not production build, measured for E | Report it as production | Label `lab, dev build`; it cannot pass E |
| Tool status `unknown` | Assume it works | Probe it once (read-only call, `--version`, ToolSearch); record the result |

## Verification

- This module feeds every gate. Gate statuses are verified only by `node <skill-dir>/scripts/quality-report.mjs --report <file>` (exit codes above) plus the per-gate tools.
- Self-check before delivering: every PASS has evidence from this session; every non-PASS has a reason; evaluation mode is recorded for C, D, F, H; lab and field labels are present for E; no open critical finding sits under a PASS; the final report (SKILL.md §9) quotes the recomputed overall.
- Compare the report against [acceptance-checklist](../templates/acceptance-checklist.md); every unchecked required item maps to a non-PASS status.

## Sources

- SKILL.md §8 of this package (gate defaults) and `schemas/quality-report.schema.json`, `scripts/quality-report.mjs --help` (exit codes 0/1/2/3/64), read 2026-10-24.
- impeccable (installed skill; licence none found locally, ideas paraphrased): P0-P3 severity with the support-ticket tie-break, harden edge-case list, audit scoring bands, production bar from craft.
- ECC skills (MIT): verification-loop (ordered phases, pipefail), browser-qa (automated a11y covers roughly 30-40% of criteria), frontend-design-direction (evidence contract and evidence record checks), design-system (ten-dimension audit), gan-evaluator (report the achieved evaluation mode), eval-harness, react-performance.
- design-taste-frontend (installed skill; licence none found, paraphrased): eyebrow and dash counts as lint signals.
- Anthropic design plugin design-handoff and frontend-design (Anthropic skills): content edge-case list, silent quality floor.
- skill-creator (Anthropic, synced copy): frontmatter limits for Gate A.
- Research findings r01-standards (2026-10): axe-core and @axe-core/playwright 4.14.0 usage and tags, https://playwright.dev/docs/accessibility-testing, https://github.com/dequelabs/axe-core/blob/develop/doc/API.md, https://registry.npmjs.org/axe-core/latest; Lighthouse 13 and LHCI 0.15.1, https://developer.chrome.com/blog/lighthouse-13-0, https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md.
- Core Web Vitals thresholds: https://web.dev/articles/vitals; WCAG 2.2 SC 1.4.10 Reflow and 2.5.8 Target Size: https://www.w3.org/TR/WCAG22/ (standards; not re-fetched in this build, verify if thresholds are disputed).
