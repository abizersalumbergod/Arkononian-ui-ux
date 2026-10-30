# arkononion-ui-ux

An Agent Skills-compatible UI/UX engineering skill for Claude Code, Codex, and other clients that load a complete skill folder. It turns a product brief, or an existing frontend, into a design direction, a design system, a working implementation, an asset pipeline and a verified interface, and it reports honestly what was and was not verified.

It covers landing pages, SaaS dashboards and admin panels, e-commerce, portfolios and editorial sites, mobile-first responsive UIs, cinematic/3D/WebGL experiences, design systems, redesigns of existing projects, UI asset production (image, video, audio, 3D), demo and marketing videos of a minute or more (planned in numbers and built as HyperFrames source) and UI audits.

## How it works

`SKILL.md` is a lightweight orchestrator. For each request, the agent:

1. **Routes the request** with `scripts/route.mjs`: task type(s), the workflow, the modules to read, installed skills worth delegating to, actions that need your approval, and warnings about suspicious instructions.
2. **Checks the environment** with `scripts/environment-audit.mjs` (runtimes, CLIs, browsers, installed skills, the project's stack). MCP tools are probed in-session.
3. **Reads only the selected modules** from `references/` and follows the matching `workflows/` file through 11 stages: discover, understand, plan, design, build, assets, motion and 3D, run, inspect visually, validate and repair, deliver.
4. **Verifies the result** against quality gates A–H (functional, visual, WCAG 2.2 AA, Core Web Vitals, responsive, assets, reliability and security). It writes a quality report in which `PASS` requires evidence and anything not run is `NOT_TESTED` or `BLOCKED`.

Modules are loaded on demand. The router and tables in `SKILL.md` tell the agent which files to read, so a dashboard task does not need the 3D rules.

### Example: "Build a cinematic 3D landing page for our wireless headphones with a scroll-driven product reveal, then deploy it to Vercel"

The router (real output, abridged) returns:

- primary `immersive-3d`, secondary `landing-page`
- workflows `cinematic-3d.md` and `landing-page.md`
- 18 modules, including three-dimensional-web, shader-and-creative-coding, motion-engineering, asset-generation, landing-page-engineering, performance, accessibility and responsive-design
- delegate skills (if installed) cinematic-noir-studio, frontend-design, emil-design-eng, design-taste-frontend, impeccable, ui-ux-pro-max, transitions-dev
- approvals `publish-deploy`, so the agent must ask before deploying

The agent then writes a motion and interaction plan before any code. It picks the cheapest 3D technology that achieves the effect, from a ladder that runs CSS 3D → model-viewer → OGL → Spline → three.js/R3F, and sets device budgets. Content and calls to action are built first, and the 3D scene is added after with disposal, visibility pausing and a non-3D fallback. It then runs `scripts/visual-check.mjs` across the viewport matrix with and without reduced motion, takes a performance trace if a browser tool is verified, records the gates, and asks before deploying.

## Package layout

| Path | Contents |
|---|---|
| `SKILL.md` | Orchestrator: rules, approval boundaries, precedence, the 11 stages, routing table, gate summary, report format, indexes |
| `MASTER_INSTRUCTIONS.md` | Every rule in one document. **Generated** from SKILL.md, each module's "Decision rules" and each workflow's "Steps" |
| `references/` | 30 specialist modules, two of them optional routes (image-to-3d-pipeline, hyperframes-video) and one map of companion skills (companion-skills). Each topic has exactly one owner (see the index in SKILL.md) |
| `workflows/` | 10 procedures: new-product, existing-project, landing-page, dashboard, ecommerce, cinematic-3d, design-system, asset-production, demo-video, visual-regression |
| `routing/routes.json` | Task types, triggers, modifiers, approval triggers, warning patterns |
| `presets/` | Starting token sets: cinematic-noir, monochrome-editorial, precision-saas, warm-commerce |
| `schemas/` | JSON Schemas: capability registry, asset manifest, quality report, routes, presets, video spec |
| `templates/` | Design brief, design decision record, asset manifest, quality report, acceptance checklist, video spec |
| `scripts/` | Zero-dependency Node tools (documented in `scripts/README.md`), plus the optional Python image-to-3D toolkit in `scripts/image-to-3d/` |
| `tests/` | `node:test` suites and fixtures |
| `evals/` | 17 behaviour scenarios and how to run them |
| `LICENSES_AND_PROVENANCE.md` | Licence policy, audited sources, attribution |

## Supported environments

- **Claude Code:** install as a personal skill under `~/.claude/skills/arkononion-ui-ux/` or commit it to a project under `.claude/skills/arkononion-ui-ux/`.
- **Codex:** install as a personal skill under `~/.agents/skills/arkononion-ui-ux/` or commit it to a project under `.agents/skills/arkononion-ui-ux/`.
- **Other Agent Skills-compatible clients:** use the skill folder location documented by that client. Copy the complete folder so `SKILL.md`, references, workflows, schemas, templates and scripts stay together. Clients vary in which tools they expose and how they invoke skills.
- **Scripts:** Node.js 18 or newer on Windows, macOS or Linux; no npm install is required for the bundled scripts. Browser checks also need Playwright with Chromium, resolved from the project or global npm root.
- **Clients without filesystem or script access:** provide the complete skill folder when supported. If only Markdown can be attached, include `SKILL.md` and the routed modules; run no scripts and report unavailable checks as `NOT_TESTED`.

## Installation

### One command

Install the skill into the AI tools on your machine with the [`skills` CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add abizersalumbergod/Arkononian-ui-ux
```

It detects the agents you have installed (Claude Code, Codex, Cursor and others) and asks where to put the skill. By default it installs into the current project; add `-g` to install for your whole user account, or `-a` to pick specific agents:

```bash
npx skills add abizersalumbergod/Arkononian-ui-ux -g                # available in every project
npx skills add abizersalumbergod/Arkononian-ui-ux -a claude-code    # Claude Code only
```

The repository is spelled `Arkononian-ui-ux`; the skill itself is named `arkononion-ui-ux`. Nothing needs to be uploaded or registered: the command installs straight from this public repository.

### Manual install

The skill folder name must be `arkononion-ui-ux` to match the `name` in `SKILL.md`. Clone the repository directly into the target folder, or rename the downloaded folder before installing it. Replace `<repository-url>` with the URL for your copy of this repository.

### Claude Code, personal install

PowerShell:

```powershell
$repositoryUrl = "https://github.com/OWNER/REPOSITORY.git" # Replace OWNER/REPOSITORY
New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null
git clone $repositoryUrl "$HOME\.claude\skills\arkononion-ui-ux"
```

macOS or Linux:

```bash
repository_url="https://github.com/OWNER/REPOSITORY.git" # Replace OWNER/REPOSITORY
mkdir -p "$HOME/.claude/skills"
git clone "$repository_url" "$HOME/.claude/skills/arkononion-ui-ux"
```

### Codex, personal install

PowerShell:

```powershell
$repositoryUrl = "https://github.com/OWNER/REPOSITORY.git" # Replace OWNER/REPOSITORY
New-Item -ItemType Directory -Force "$HOME\.agents\skills" | Out-Null
git clone $repositoryUrl "$HOME\.agents\skills\arkononion-ui-ux"
```

macOS or Linux:

```bash
repository_url="https://github.com/OWNER/REPOSITORY.git" # Replace OWNER/REPOSITORY
mkdir -p "$HOME/.agents/skills"
git clone "$repository_url" "$HOME/.agents/skills/arkononion-ui-ux"
```

Replace `OWNER/REPOSITORY` with the published repository path.

### From npm

The package `arkononion-ui-ux` contains the skill files only (no tests or eval results). Unpack it straight into the skill folder; this example is for Claude Code, so use `.agents/skills` for Codex.

```bash
npm pack arkononion-ui-ux
mkdir -p "$HOME/.claude/skills/arkononion-ui-ux"
tar -xzf arkononion-ui-ux-*.tgz -C "$HOME/.claude/skills/arkononion-ui-ux" --strip-components=1
```

Installing it globally (`npm install --global arkononion-ui-ux`) also puts the scripts on your PATH as `arkononion-route`, `arkononion-environment-audit`, `arkononion-build-tokens`, `arkononion-visual-check`, `arkononion-asset-validation` and `arkononion-quality-report`.

For a project-scoped install, copy this skill folder to `.claude/skills/arkononion-ui-ux/` for Claude Code or `.agents/skills/arkononion-ui-ux/` for Codex, then commit that folder with the project. For another client, follow its documented skill location.

Start a new agent session if the skill does not appear. Invoke it as `/arkononion-ui-ux` in Claude Code or `$arkononion-ui-ux` in Codex; other clients use their own invocation syntax.

This repository follows the [Agent Skills format](https://agentskills.io/specification). Claude Code and Codex document their skill locations in their [Claude Code skills guide](https://code.claude.com/docs/en/skills) and [Codex skills guide](https://learn.chatgpt.com/docs/build-skills). For broader public distribution through the OpenAI ecosystem, package it as a plugin or hosted skill according to that platform's current requirements.

**License:** MIT ([LICENSE](LICENSE)). Third-party techniques adapted into the modules, and their attribution, are listed in [LICENSES_AND_PROVENANCE.md](LICENSES_AND_PROVENANCE.md).

## Capability detection and prerequisites

Nothing is assumed to exist. `references/capability-registry.json` is a catalog of possible capabilities and fallback guidance; it is not evidence that a tool is installed or available. Verify on each machine and in each agent session:

```bash
node scripts/environment-audit.mjs --project <your-project> --out env-audit.json
```

| Capability | Needed for | If missing |
|---|---|---|
| Node.js 18+ | All scripts | Route manually from the SKILL.md tables |
| Playwright + Chromium (`npm i -g playwright && npx playwright install chromium`) | `visual-check.mjs` screenshots, overflow, console, reduced-motion runs | Use a verified browser MCP, or report visual gates NOT TESTED |
| A browser MCP (Chrome DevTools or the built-in browser) | Lighthouse accessibility/SEO, performance traces, interactive checks | Playwright checks only; performance is lab-only or NOT TESTED |
| ffmpeg | Video transcoding, posters, durations, and rendering HyperFrames films | Ship pre-encoded media; durations marked NOT TESTED; a film's render is BLOCKED until it is installed (ask first) |
| Node.js 22+ (for `npx hyperframes`) | The optional video route: authoring checks (`lint`, `check`, `snapshot`, `preview`) run without FFmpeg | Plan the film and run `scripts/video-check.mjs` (Node 18+); the HyperFrames CLI is blocked |
| sharp (project dependency) | Image resizing and encoding | Framework image optimisation, or correctly sized source images |
| axe-core (project dev dependency) | Automated WCAG rules in `visual-check.mjs --axe` | Lighthouse accessibility plus manual checks |

## Optional integrations and credentials

Image, video, audio and 3D generators (for example the Higgsfield or Figma MCP connectors, or APIs such as fal) are optional. The skill:

- probes them read-only (auth state, credits, model list) and never generates anything as a test;
- asks for approval before any generation that costs money or credits, and before sending private files to a third party;
- records each asset's route, generator, prompt reference and licence in an asset manifest, validated with `scripts/asset-validation.mjs`;
- falls back to procedural SVG, Canvas or CSS assets, licensed retrieval or clearly labelled placeholders when a generator is unavailable or not approved;
- offers an optional, opt-in media route (`references/image-to-3d-pipeline.md`). If you have Gemini API access (a billing-enabled key), Gemini generates reference stills, site images and video first, for static sites too; then a free public Hugging Face Space (TRELLIS) turns a chosen still into a 3D model and headless Blender cleans the GLB up. Every Gemini call is paid and sends your prompt to Google, and the Space upload sends your image to a third party, so each needs your approval. Without Gemini access the normal procedure supplies the image. It needs Python (and Blender for 3D); nothing else in the skill does, and nothing runs unless you ask.

- offers an optional video route (`references/hyperframes-video.md`, `workflows/demo-video.md`) for demo, launch and marketing films of a minute or more. The film is planned in numbers (`templates/video-spec.json`, checked by `scripts/video-check.mjs`), built as HyperFrames source, checked, snapshotted, rendered, and its length measured on the finished file. The HyperFrames CLI runs with telemetry off and `init --skip-skills`, because by default it reports usage and writes its skills into the home folder of every agent tool it finds. Installing FFmpeg or those skills, hosted render, publishing and HeyGen media (avatar, voice, catalogue music) each need your approval.

Credentials are named in reports (environment variable names only) and never written into code, bundles, manifests or logs. Deploying, publishing, sending messages and destructive operations always require explicit approval.

## Framework support

The preferred stack is Next.js (App Router) + React 19 + TypeScript + Tailwind CSS v4 + motion/GSAP + three.js/React Three Fiber. The agent detects the project's stack first and follows its conventions (Vite, Astro, Vue/Nuxt, SvelteKit, plain HTML and others) instead of migrating it. New dependencies need a reason, a compatibility check and a recorded decision. Version-sensitive facts in the modules are dated (October 2026) and marked "verify at runtime".

## Testing

```bash
node --test "tests/*.test.mjs"        # unit and integration tests (Node 24 needs the glob form)
node scripts/validate-skill.mjs        # Gate A: structure, links, schemas, reachability, secrets, placeholders
node scripts/build-docs.mjs --check    # generated docs are up to date
npm run test:py                        # optional image-to-3D toolkit (Python 3.9+; also run by tests/image-to-3d.test.mjs when Python is found)
```

- **Unit and integration tests** cover the schema validator, quality-report honesty rules, asset validation (including path-traversal rejection), skill-structure checks, routing (all 17 eval scenarios), video checks (film plan, HyperFrames project scan, MP4 duration from synthetic files), capability detection, token building with contrast checks, a live Playwright visual check on fixture pages, and the docs generator.
- **Behaviour evals** (`evals/README.md`) check that an agent following the skill plans correctly, respects approvals, refuses injected instructions and reports honestly. They run through subagents and use model usage.

## Maintenance

- Edit modules, SKILL.md or `capability-registry.json`, then run `node scripts/build-docs.mjs` to regenerate `MASTER_INSTRUCTIONS.md` and `references/capability-registry.md`. Never edit those two by hand.
- When adding a module, add it to the file list in `scripts/validate-skill.mjs` and to routes, SKILL.md and `MODULE_ORDER` in `scripts/build-docs.mjs`, then run the validator.
- When a library releases a major version, update the affected module, re-check versions with `npm view <pkg> version`, and note it in `CHANGELOG.md`.
- When new design skills are installed, audit them, decide incorporate, adapt, reference or reject, and update `references/skill-audit.md`, `references/skill-delegation.md` and `LICENSES_AND_PROVENANCE.md`.
- Run the environment audit on each machine. The bundled capability registry does not claim that any optional tool or service is available.

## Troubleshooting

See `references/troubleshooting.md`. Common cases:

- `visual-check.mjs` exits 4: Playwright cannot be resolved. Install it globally or in the project.
- Node 24 says `Cannot find module 'tests'`: use `node --test "tests/*.test.mjs"`.
- The skill does not trigger: use the host's explicit skill invocation or check that the complete skill folder is in the host's documented discovery location.

## Known limitations

- Modules are guidance read by the model, not enforced code. Behavior depends on the agent following `SKILL.md`. The evals measure that, but cannot guarantee it.
- MCP tools cannot be detected from a script. They are probed in-session, and availability differs between sessions and machines.
- Automated accessibility checks catch only part of WCAG. Manual keyboard and screen-reader checks are still required for a full pass.
- Performance numbers from local runs are lab data. Core Web Vitals targets apply to field data at the 75th percentile.
- No film was rendered while building the video route: FFmpeg was absent on the author's machine. `init`, `lint`, `check` and `snapshot` ran on a 75 s, 7-scene HyperFrames composition (2026-10-30, hyperframes 0.8.221); the `render` command, `--skip-skills`, hosted render and HeyGen media are documented but untested.
- No media generation was exercised while building this skill (no approved credits), so generator routes are documented and capability-gated but untested end to end.
- `references/skill-audit.md` records source research from October 2026. Re-check version-sensitive and installed-skill information when using a newer environment.
