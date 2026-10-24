# ultimate-uiux

A Claude Code skill for UI/UX engineering. It turns a product brief, or an existing frontend, into a design direction, a design system, a working implementation, an asset pipeline and a verified interface, and it reports honestly what was and was not verified.

It covers landing pages, SaaS dashboards and admin panels, e-commerce, portfolios and editorial sites, mobile-first responsive UIs, cinematic/3D/WebGL experiences, design systems, redesigns of existing projects, UI asset production (image, video, audio, 3D) and UI audits.

## How it works

`SKILL.md` is a lightweight orchestrator. For each request Claude:

1. **Routes the request** with `scripts/route.mjs`: task type(s), the workflow, the modules to read, installed skills worth delegating to, actions that need your approval, and warnings about suspicious instructions.
2. **Checks the environment** with `scripts/environment-audit.mjs` (runtimes, CLIs, browsers, installed skills, the project's stack). MCP tools are probed in-session.
3. **Reads only the selected modules** from `references/` and follows the matching `workflows/` file through 11 stages: discover, understand, plan, design, build, assets, motion and 3D, run, inspect visually, validate and repair, deliver.
4. **Verifies the result** against quality gates A–H (functional, visual, WCAG 2.2 AA, Core Web Vitals, responsive, assets, reliability and security). It writes a quality report in which `PASS` requires evidence and anything not run is `NOT_TESTED` or `BLOCKED`.

Modules are never loaded automatically. The router and the tables in `SKILL.md` tell Claude which files to read, so a dashboard task never loads the 3D rules.

### Example: "Build a cinematic 3D landing page for our wireless headphones with a scroll-driven product reveal, then deploy it to Vercel"

The router (real output, abridged) returns:

- primary `immersive-3d`, secondary `landing-page`
- workflows `cinematic-3d.md` and `landing-page.md`
- 18 modules, including three-dimensional-web, shader-and-creative-coding, motion-engineering, asset-generation, landing-page-engineering, performance, accessibility and responsive-design
- delegate skills (if installed) cinematic-noir-studio, frontend-design, emil-design-eng, design-taste-frontend, impeccable, ui-ux-pro-max, transitions-dev
- approvals `publish-deploy`, so Claude must ask before deploying

Claude then writes a motion and interaction plan before any code. It picks the cheapest 3D technology that achieves the effect, from a ladder that runs CSS 3D → model-viewer → OGL → Spline → three.js/R3F, and sets device budgets. Content and calls to action are built first, and the 3D scene is added after with disposal, visibility pausing and a non-3D fallback. It then runs `scripts/visual-check.mjs` across the viewport matrix with and without reduced motion, takes a performance trace if a browser tool is verified, records the gates, and asks before deploying.

## Package layout

| Path | Contents |
|---|---|
| `SKILL.md` | Orchestrator: rules, approval boundaries, precedence, the 11 stages, routing table, gate summary, report format, indexes |
| `MASTER_INSTRUCTIONS.md` | Every rule in one document. **Generated** from SKILL.md, each module's "Decision rules" and each workflow's "Steps" |
| `references/` | 27 specialist modules. Each topic has exactly one owner (see the index in SKILL.md) |
| `workflows/` | 9 procedures: new-product, existing-project, landing-page, dashboard, ecommerce, cinematic-3d, design-system, asset-production, visual-regression |
| `routing/routes.json` | Task types, triggers, modifiers, approval triggers, warning patterns |
| `presets/` | Starting token sets: cinematic-noir, monochrome-editorial, precision-saas, warm-commerce |
| `schemas/` | JSON Schemas: capability registry, asset manifest, quality report, routes, presets |
| `templates/` | Design brief, design decision record, asset manifest, quality report, acceptance checklist |
| `scripts/` | Zero-dependency Node tools (documented in `scripts/README.md`) |
| `tests/` | `node:test` suites and fixtures |
| `evals/` | 16 behaviour scenarios and how to run them |
| `LICENSES_AND_PROVENANCE.md` | Licence policy, audited sources, attribution |

## Supported environments

- **Claude Code** (CLI, desktop app, IDE extensions): full support. Skills are read from `~/.claude/skills/<name>/` (user) or `<project>/.claude/skills/<name>/` (project).
- **Scripts:** Node.js 18 or newer on Windows, macOS or Linux, with no npm installs. Browser checks need Playwright with Chromium, resolved from the project or the global npm root.
- **Other agents** (Cursor, Codex, Gemini and so on): there is no automatic loading. Attach `SKILL.md`, then the modules the router names. The scripts work anywhere Node runs.
- **Claude.ai chat without a filesystem:** the instructions apply, but the scripts cannot run, so routing is manual and checks are reported as NOT TESTED.

## Installation

The skill lives in `C:/Dev/Portfolio/design-skills/ultimate-uiux`. To make Claude Code load it for every project, link it into the user skills folder.

Windows (PowerShell, no admin rights needed):

```powershell
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\ultimate-uiux" -Target "C:\Dev\Portfolio\design-skills\ultimate-uiux"
```

macOS or Linux:

```bash
ln -s /path/to/design-skills/ultimate-uiux ~/.claude/skills/ultimate-uiux
```

Then start a new Claude Code session. The skill appears in the skill list and triggers on UI/UX requests (see the description in `SKILL.md`). Invoke it explicitly by name ("use the ultimate-uiux skill …") if needed.

## Capability detection and prerequisites

Nothing is assumed to exist. `references/capability-registry.json` is a dated snapshot with an evidence string for every status. Re-verify on each machine:

```bash
node scripts/environment-audit.mjs --project <your-project> --out env-audit.json
```

| Capability | Needed for | If missing |
|---|---|---|
| Node.js 18+ | All scripts | Route manually from the SKILL.md tables |
| Playwright + Chromium (`npm i -g playwright && npx playwright install chromium`) | `visual-check.mjs` screenshots, overflow, console, reduced-motion runs | Use a verified browser MCP, or report visual gates NOT TESTED |
| A browser MCP (Chrome DevTools or the built-in browser) | Lighthouse accessibility/SEO, performance traces, interactive checks | Playwright checks only; performance is lab-only or NOT TESTED |
| ffmpeg | Video transcoding, posters, durations | Ship pre-encoded media; durations marked NOT TESTED |
| sharp (project dependency) | Image resizing and encoding | Framework image optimisation, or correctly sized source images |
| axe-core (project dev dependency) | Automated WCAG rules in `visual-check.mjs --axe` | Lighthouse accessibility plus manual checks |

## Optional integrations and credentials

Image, video, audio and 3D generators (for example the Higgsfield or Figma MCP connectors, or APIs such as fal) are optional. The skill:

- probes them read-only (auth state, credits, model list) and never generates anything as a test;
- asks for approval before any generation that costs money or credits, and before sending private files to a third party;
- records each asset's route, generator, prompt reference and licence in an asset manifest, validated with `scripts/asset-validation.mjs`;
- falls back to procedural SVG, Canvas or CSS assets, licensed retrieval or clearly labelled placeholders when a generator is unavailable or not approved.

Credentials are named in reports (environment variable names only) and never written into code, bundles, manifests or logs. Deploying, publishing, sending messages and destructive operations always require explicit approval.

## Framework support

The preferred stack is Next.js (App Router) + React 19 + TypeScript + Tailwind CSS v4 + motion/GSAP + three.js/React Three Fiber. Claude detects the project's stack first and follows its conventions (Vite, Astro, Vue/Nuxt, SvelteKit, plain HTML and others) instead of migrating it. New dependencies need a reason, a compatibility check and a recorded decision. Version-sensitive facts in the modules are dated (October 2026) and marked "verify at runtime".

## Testing

```bash
node --test "tests/*.test.mjs"        # unit and integration tests (Node 24 needs the glob form)
node scripts/validate-skill.mjs        # Gate A: structure, links, schemas, reachability, secrets, placeholders
node scripts/build-docs.mjs --check    # generated docs are up to date
```

- **Unit and integration tests** cover the schema validator, quality-report honesty rules, asset validation (including path-traversal rejection), skill-structure checks, routing (all 16 eval scenarios), capability detection, token building with contrast checks, a live Playwright visual check on fixture pages, and the docs generator.
- **Behaviour evals** (`evals/README.md`) check that an agent following the skill plans correctly, respects approvals, refuses injected instructions and reports honestly. They run through subagents and use model usage.

## Maintenance

- Edit modules, SKILL.md or `capability-registry.json`, then run `node scripts/build-docs.mjs` to regenerate `MASTER_INSTRUCTIONS.md` and `references/capability-registry.md`. Never edit those two by hand.
- When adding a module, add it to the file list in `scripts/validate-skill.mjs` and to routes, SKILL.md and `MODULE_ORDER` in `scripts/build-docs.mjs`, then run the validator.
- When a library releases a major version, update the affected module, re-check versions with `npm view <pkg> version`, and note it in `CHANGELOG.md`.
- When new design skills are installed, audit them, decide incorporate, adapt, reference or reject, and update `references/skill-audit.md`, `references/skill-delegation.md` and `LICENSES_AND_PROVENANCE.md`.
- Re-verify the capability registry on each machine. It is environment-specific.

## Troubleshooting

See `references/troubleshooting.md`. Common cases:

- `visual-check.mjs` exits 4: Playwright cannot be resolved. Install it globally or in the project.
- Node 24 says `Cannot find module 'tests'`: use `node --test "tests/*.test.mjs"`.
- The skill does not trigger: invoke it by name, or check the junction or symlink exists in `~/.claude/skills`.

## Known limitations

- Modules are guidance read by the model, not enforced code. Behaviour depends on Claude following SKILL.md. The evals measure that, but cannot guarantee it.
- MCP tools cannot be detected from a script. They are probed in-session, and availability differs between sessions and machines.
- Automated accessibility checks catch only part of WCAG. Manual keyboard and screen-reader checks are still required for a full pass.
- Performance numbers from local runs are lab data. Core Web Vitals targets apply to field data at the 75th percentile.
- No media generation was exercised while building this skill (no approved credits), so generator routes are documented and capability-gated but untested end to end.
- The audit is a snapshot of the skills installed in October 2026. Re-audit when they change.
