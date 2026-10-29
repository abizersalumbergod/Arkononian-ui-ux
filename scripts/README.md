# scripts/

Tooling for the `arkononion-ui-ux` skill. Every script is plain Node.js ESM with **zero npm dependencies**. The one exception is the optional Python toolkit in [image-to-3d/](image-to-3d/README.md), which is never needed unless a 3D model is made from an image.

**Supported environments (all scripts):** Node.js 18 or newer on Windows (PowerShell, cmd, Git Bash), macOS and Linux. Verified on Node 24.13 / Windows 11. Run them from any directory. Paths are resolved relative to the current directory unless stated otherwise.

**Shared conventions**

- `-h` / `--help` prints usage and exits 0. Unknown flags are usage errors.
- Output goes to stdout. Diagnostics go to stderr. JSON is UTF-8.
- An `--out` file is never overwritten silently: pass `--force` to replace it (build-docs and visual-check are the exceptions, see below).
- Child processes are spawned with an argument array, never a shell string built from input.
- No script prints environment variable values or secret values (secret matches show the pattern id only), and none reads `~/.claude/settings.json`.
- Exit code `64` always means a usage error (except build-docs, which uses `2`).

Run the test suite (on Node 24 a glob is required, a bare directory argument fails):

```sh
node --test "tests/*.test.mjs"
```

| Script | Purpose | Quality gate |
|---|---|---|
| [environment-audit.mjs](environment-audit.mjs) | Detect runtimes, CLIs, browsers, installed skills and the project stack | Feeds every gate (decides BLOCKED vs testable) |
| [route.mjs](route.mjs) | Route a request to workflows, modules, approvals and warnings | Planning (no gate) |
| [validate-skill.mjs](validate-skill.mjs) | Check skill package integrity | A |
| `build-docs.mjs` | Regenerate derived docs, or check them for staleness | A |
| [asset-validation.mjs](asset-validation.mjs) | Validate an asset manifest against the files | G |
| [build-tokens.mjs](build-tokens.mjs) | Turn a preset into CSS tokens and a Tailwind v4 theme, with a contrast check | C, D |
| [visual-check.mjs](visual-check.mjs) | Headless screenshots and layout/console checks per viewport | B, C, D, F |
| [quality-report.mjs](quality-report.mjs) | Validate a gate A-H quality report, or create a blank one | All (A-H) |
| [image-to-3d/](image-to-3d/README.md) | Optional Python toolkit: Gemini images and video (only with Gemini access), then image to GLB through a Hugging Face Space, Blender cleanup, manifest entries | G (feeds asset-validation) |
| [lib/schema.mjs](lib/schema.mjs) | JSON Schema subset validator | Library |
| [lib/fsutil.mjs](lib/fsutil.mjs) | File system, front matter, link and secret-scan helpers | Library |

---

## environment-audit.mjs

**Purpose.** Records what this machine can really do, with evidence, as JSON that conforms to `schemas/capability-registry.schema.json` (object form: `generatedAt`, `platform`, `entries[]`, `skills`, `project`, `notes`). Read-only and offline.

- **CLIs and runtimes:** node, npm, pnpm, yarn, bun, python, python3, git, gh, ffmpeg, ffprobe, blender, magick, playwright, lighthouse, vercel. Each is located with `where` (Windows, restricted to PATH) or `which` (POSIX), falling back to a PATH scan. Then its version flag runs with a 5 s timeout. Status: found + version = `available-verified`. Found but the version probe failed = `available-untested`. Not found = `unavailable`. Windows `.cmd` shims run through `cmd.exe` with a validated, quoted path and constant flags only.
- **Browsers:** Chrome and Edge at known install paths. On Windows the version comes from the versioned folder next to the executable, so the browser is never launched. Playwright browser downloads come from `%LOCALAPPDATA%/ms-playwright`, `~/Library/Caches/ms-playwright`, `~/.cache/ms-playwright` or `$PLAYWRIGHT_BROWSERS_PATH`. These are `available-untested` until visual-check runs.
- **MCP servers and generators:** always `unknown` until probed with the current host's tool-discovery interface. A script cannot see session tools. Treat generators as paid until verified otherwise.
- **Skills (names only):** `~/.claude/skills`, `~/.agents/skills`, `$CODEX_HOME/skills` (or `~/.codex/skills`), project `.claude/skills` and `.agents/skills`, plus supported Claude plugin caches. Only the presence of `SKILL.md` is checked. No file contents are read.
- **Project profile** (with `--project`): framework + version (from `node_modules`, then the lockfile, then the declared range), router, styling + Tailwind major, UI kits (shadcn via `components.json`, Radix, MUI, ...), animation libraries, 3D libraries, test tools, TypeScript, package manager (`packageManager` field, then the lockfile).
- **Privacy:** paths under the home directory print as `~` (`%LOCALAPPDATA%` on Windows).

```text
node scripts/environment-audit.mjs [--project <dir>] [--out <file> [--force]]
```

| Flag | Meaning |
|---|---|
| `--project <dir>` | Project to profile. Must be an existing directory. |
| `--out <file>` | Write the JSON here and print a one-line summary instead of the JSON. |
| `--force` | Allow `--out` to replace an existing file. |

Exit codes: `0` audit completed · `1` output failed schema validation (internal error) · `2` unexpected error · `64` usage error (bad flag, `--project` not a directory, refusing to overwrite).

```sh
node scripts/environment-audit.mjs --project ../my-app --out audit.json
```

Exports: `audit({project})`, `probeCommand(spec)`, `locateCommand(name)`, `detectBrowsers()`, `detectPlaywrightBrowsers()`, `detectSkills()`, `profileProject(dir)`, `parseVersion(text)`, `redactPaths(text)`, `STATUSES`, `CLI_SPECS`, `EXIT`.
Tests: `tests/capability-detection.test.mjs`.

## route.mjs

**Purpose.** Deterministically routes a request using the weighted patterns in `routing/routes.json` (build spec section 6). It returns the primary and secondary routes, workflows, reference modules, delegate skills ("use if installed"), presets, approval checkpoints (publish/deploy, paid generation, destructive actions, external messages, uploads, spend) and `untrusted-instruction-detected` warnings. Credentials in the input are redacted from the echoed text. Offline.

```text
node scripts/route.mjs [--pretty] [--routes <file>] [--] "request text"
<text> | node scripts/route.mjs [--pretty]
```

| Flag | Meaning |
|---|---|
| `--pretty` | Pretty-print the JSON. |
| `--routes <file>` | Use another routes file (default `routing/routes.json`). |
| `--` | End of options. Use it before text that starts with `-`. |

Exit codes: `0` routed (empty text routes to `new-product`) · `2` routes file unreadable or invalid · `64` usage error.

```sh
node scripts/route.mjs --pretty "build a dark-mode analytics dashboard with charts"
```

Related gate: none directly. It selects the workflow whose exit checks feed the gates. Tests: `tests/routing.test.mjs`.

## validate-skill.mjs

**Purpose (Gate A, skill package integrity).** Read-only checks:

- the required files from build spec section 3 are present
- SKILL.md front matter: `name` is lowercase letters, digits and hyphens, 64 characters at most; `description` is non-empty, 1024 characters at most, no XML tags
- no empty files, and every JSON file parses
- schema conformance for the templates, the capability registry, the presets and `routing/routes.json`
- every relative Markdown link resolves
- every module, workflow and preset in routes.json exists
- every `references/*.md` and `workflows/*.md` file is reachable
- no `TODO`, `TBD` or `lorem ipsum` in shipped prose (inline code and fenced blocks are exempt)
- no secret patterns (`sk-…`, `AKIA…`, `ghp_…`, Bearer hex tokens, private-key headers and others)
- MASTER_INSTRUCTIONS.md mentions every reference and workflow file

`tests/fixtures`, `node_modules` and `.git` are excluded from the scans.

```text
node scripts/validate-skill.mjs [--root <dir>] [--json] [--required-files <a,b,...> | --fixture-mode]
```

| Flag | Meaning |
|---|---|
| `--root <dir>` | Package root (default: the package that contains the script). |
| `--json` | Print the full result as JSON instead of the checklist. |
| `--required-files <list>` | Comma-separated required paths (a trailing `/` marks a directory). Replaces the section-3 list. |
| `--fixture-mode` | Require only `SKILL.md`, `MASTER_INSTRUCTIONS.md` and `routing/routes.json`. For small test packages. |

Exit codes: `0` every check passed (warnings allowed) · `1` at least one check failed · `64` usage error or root not found.

```sh
node scripts/validate-skill.mjs
node scripts/validate-skill.mjs --root tests/fixtures/mini-skill-valid --fixture-mode
```

Exports: `validateSkill(root, options)`, `checkSkillFrontmatter(text)`, `formatChecklist(result)`. Tests: `tests/skill-structure.test.mjs`.

## build-docs.mjs

**Purpose (Gate A, no drift).** Regenerates the derived documents so they never drift from their sources:

- `references/capability-registry.md` from `references/capability-registry.json`
- `MASTER_INSTRUCTIONS.md` from three sources: the SKILL.md body, the `## Decision rules` section of every module, and the `## Steps` section of every workflow

Headings inside fenced code blocks are ignored when the script extracts sections. Relative links are rewritten to resolve from the skill root. When it writes, it overwrites the generated files. That is its job: those files are never edited by hand.

```text
node scripts/build-docs.mjs [--root <skill-dir>] [--only registry|master] [--check]
```

| Flag | Meaning |
|---|---|
| `--root <dir>` | Skill directory (default: the parent of `scripts/`). |
| `--only <name>` | Generate only `registry` or `master`. |
| `--check` | Write nothing. Exit 1 if a generated file is missing or stale. |

Exit codes: `0` written, or up to date with `--check` · `1` stale or missing with `--check`, or a source error · `2` bad arguments.

```sh
node scripts/build-docs.mjs          # after editing capability-registry.json or any Decision rules / Steps
node scripts/build-docs.mjs --check  # in CI or before release
```

Exports: `extractSection(markdown, heading)`, `renderRegistry(root)`, `renderMaster(root)`. Tests: `tests/build-docs.test.mjs`.

## asset-validation.mjs

**Purpose (Gate G, asset integrity).** Validates an asset manifest against `schemas/asset-manifest.schema.json`, then checks every asset:

| Check | What is verified |
|---|---|
| Path | Confined to `--root`. `../` traversal, URLs, outside absolute paths and symlink escapes are rejected. |
| Exists | The file is present. |
| Format | Magic-byte sniff (png, jpeg, gif, webp, avif, svg, mp4/mov/m4a, webm, ogg, mp3, wav, glb, fonts) matches the declared format. |
| Dimensions | Read from the png/jpeg/gif/webp/avif/svg header. |
| Aspect ratio | Within 1% of the declared ratio. |
| Duration | WAV from its header. Other audio and video use ffprobe when installed, otherwise `not-tested`. |
| Byte budget | Manifest `budgets` or the defaults: image 500 KiB, hero/background image 800 KiB, video 6 MiB, audio 1.5 MiB, GLB 5 MiB. |
| Licence | Required. `unknown`-style placeholders fail. |
| Fallback | Required for critical assets. |
| Secrets | None in prompts, generator params or `promptRef` files. |

```text
node scripts/asset-validation.mjs --manifest <file> [--root <dir>] [--summary] [--out <file> [--force]] [--skip-ffprobe]
```

| Flag | Meaning |
|---|---|
| `--manifest <file>` | Asset manifest JSON (required). |
| `--root <dir>` | Project root that asset paths are relative to (default: current directory). |
| `--summary` | Print a text summary instead of the JSON report. |
| `--out <file>` | Write the JSON report here and print the summary. `--force` allows replacing it. |
| `--skip-ffprobe` | Do not run ffprobe. Non-WAV durations become `not-tested`. |

Exit codes: `0` PASS · `1` FAIL (any critical failure, including schema errors) · `2` INCOMPLETE (no failures, but some checks are not-tested) · `3` manifest unreadable or not JSON · `64` usage error.

```sh
node scripts/asset-validation.mjs --manifest public/asset-manifest.json --root . --summary
```

Optional external tool: `ffprobe`. Exports: `validateManifest(manifest, root, options)`, `resolveAssetPath`, `sniffFormat`, `getDimensions`, `wavInfo`, `budgetFor`, `DEFAULT_BUDGETS`. Tests: `tests/asset-validation.test.mjs`.

## build-tokens.mjs

**Purpose (feeds Gates C and D).** Turns a design preset (`presets/*.json`, see `presets/README.md`) into two files:

- `tokens.css`: `:root` custom properties, light colours on `:root` and `[data-theme="light"]`, dark colours on `[data-theme="dark"]` and under `prefers-color-scheme: dark`, and durations collapsed under `prefers-reduced-motion`
- `theme.tailwind.css`: a Tailwind v4 `@theme` block

Every `contrastPairs` entry is measured with the WCAG 2.x formula. If any pair falls below its declared minimum, nothing is written.

```text
node scripts/build-tokens.mjs --preset <file|name> [--out <dir> [--force] | --check] [--json]
```

| Flag | Meaning |
|---|---|
| `--preset <file\|name>` | Preset JSON path, or a bundled preset name (`presets/<name>.json`). |
| `--out <dir>` | Write both stylesheets here. Files are replaced only if build-tokens generated them. `--force` overrides this. |
| `--check` | Validate and measure contrast only. Write nothing. |
| `--json` | Print a JSON summary. |

Without `--out` or `--check`, both stylesheets print to stdout and the summary goes to stderr.

Exit codes: `0` valid and every contrast pair passes · `1` a contrast pair fails or cannot be measured · `3` invalid preset · `64` usage error or refusing to overwrite.

```sh
node scripts/build-tokens.mjs --preset precision-saas --out src/styles
```

Tests: `tests/tokens.test.mjs`.

## visual-check.mjs

**Purpose (feeds Gates B, C, D, F).** Opens a page in headless Chromium through Playwright at each viewport and records:

- a full-page screenshot
- horizontal overflow, and elements wider than the viewport
- console errors and uncaught exceptions
- failed requests and broken images
- the reduced-motion state
- optional axe-core results

Playwright resolves from the project first, then from the global npm root (`npm root -g`). axe-core resolves the same way.

```text
node scripts/visual-check.mjs --url <url|file> [--viewports 375x812,768x1024,1280x800,1920x1080] [--out <dir>] [--reduced-motion] [--axe] [--project <dir>] [--timeout <ms>] [--wait <ms>]
```

| Flag | Meaning |
|---|---|
| `--url <url\|file>` | An `http(s)://` URL, a `file://` URL, or a local HTML file or folder with `index.html`. |
| `--viewports <list>` | Comma-separated `WIDTHxHEIGHT` list. |
| `--out <dir>` | Folder for `<WxH>.png` and `summary.json`. Files with those names are replaced. Default: a new temp folder. |
| `--reduced-motion` | Emulate `prefers-reduced-motion: reduce`. |
| `--axe` | Run axe-core if it resolves. Otherwise axe is reported as NOT_TESTED. |
| `--project <dir>` | Where to resolve playwright and axe-core from first. |
| `--timeout <ms>` / `--wait <ms>` | Navigation timeout (30000 ms) and extra settle time (500 ms). |

Exit codes: `0` no critical issue · `1` critical issue (load failure or HTTP ≥ 400, horizontal scroll, broken images, console errors, failed document/CSS/JS requests, serious or critical axe violations) · `2` the check itself failed · `4` BLOCKED: Playwright not resolvable or no Chromium could launch · `64` usage error.

```sh
node scripts/visual-check.mjs --url http://localhost:3000 --reduced-motion --axe --out .uiux/visual
```

External tool: Playwright with a Chromium download (see environment-audit). Tests: `tests/visual-check.test.mjs` (it skips with a reason when Playwright does not resolve).

## quality-report.mjs

**Purpose (all gates, A-H).** Validates a quality report against `schemas/quality-report.schema.json` and enforces the honesty rules:

- PASS needs at least one evidence item `{check, tool, result}`
- every non-PASS status needs a `reason`
- a gate with an open critical finding counts as FAIL
- the overall result is recomputed, never trusted: FAIL if any gate fails, INCOMPLETE if a required gate is BLOCKED or NOT_TESTED, otherwise PASS

`--init` prints a template in which every gate is NOT_TESTED with a reason.

```text
node scripts/quality-report.mjs --report <file> [--json]
node scripts/quality-report.mjs --init [--project <name>] [--scope <text>] [--out <file> [--force]]
```

| Flag | Meaning |
|---|---|
| `--report <file>` | Report JSON to evaluate. |
| `--json` | Print the evaluation as JSON. |
| `--init` | Create a template report. |
| `--project <name>` / `--scope <text>` | Metadata for `--init`. |
| `--out <file>` / `--force` | Write the `--init` template to a file, and allow replacing it. |

Exit codes: `0` PASS (or `--init` succeeded) · `1` FAIL · `2` INCOMPLETE · `3` invalid report (unreadable, bad JSON, schema or honesty violation) · `64` usage error.

```sh
node scripts/quality-report.mjs --init --project my-app --out quality-report.json
node scripts/quality-report.mjs --report quality-report.json
```

Exports: `evaluateReport`, `createTemplate`, `GATES`, `STATUSES`. Tests: `tests/quality-gates.test.mjs`.

## lib/schema.mjs (library)

A zero-dependency subset of JSON Schema. Supported keywords:

- `type`, including arrays of types
- `properties`, `required`, `additionalProperties`, `items`
- `enum`, `const`, `pattern`
- `minLength`/`maxLength`, `minimum`/`maximum`, `minItems`/`maxItems`, `uniqueItems`
- `anyOf`, `oneOf`, local `$ref` (`#/$defs/...`)
- basic `format`: date, date-time, uri

API: `validate(schema, data) → {valid, errors[]}`, `formatErrors(errors) → string[]` (`"path: message"`), `deepEqual`, `checkFormat`. Not a CLI. Tests: `tests/schema.test.mjs`.

## lib/fsutil.mjs (library)

Shared helpers:

- `PACKAGE_ROOT`, `isMainModule(import.meta.url)` (symlink- and junction-aware)
- file access: `readText`, `readJson`, `exists`, `statOrNull`, `walk`, `writeFileSafe` (refuses to overwrite without `force`)
- paths: `toPosix`, `relPosix`, `isInside`
- Markdown: `parseFrontmatter` (quoted, plain and folded `>-` scalars), `extractLinks` (relative links only; ignores `http(s):`, `mailto:` and `#anchors`), `headingSlugs`
- secrets: `SECRET_PATTERNS`, `scanSecrets(text)` (previews are redacted)

Not a CLI. It is covered indirectly by the validate-skill, asset-validation and schema tests.
