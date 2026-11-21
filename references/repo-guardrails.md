# Repo guardrails

Turning rules into checks that run without anyone remembering them: a hook that blocks destructive git commands before an agent runs them, commit-time formatting and type and test checks, and import-boundary rules that make a package's entry points the only way in. The default is to build the check instead of writing the rule.

**Load when:** the user wants safety hooks, pre-commit checks or enforced module boundaries, a retrospective finds a mistake an automated check could have caught, or a repository has no guardrail at all. **Owns:** the mechanical-versus-judgement rule, the dangerous-git guard, the pre-commit setup, and the entry-point boundary check with its prove-it-bites test.
**Related:** [codebase-design](codebase-design.md), [review-and-handoff](review-and-handoff.md), [agent-writing](agent-writing.md), [frontend-architecture](frontend-architecture.md), [security-and-privacy](security-and-privacy.md), [quality-gates](quality-gates.md), [delivery-orchestration](delivery-orchestration.md)

## Decision rules

1. **Mechanical rules become checks; judgement calls become documented standards.** A fixed syntactic pattern, a banned interface, an import shape or a file-location rule gets a deterministic check (a custom lint rule, a commit hook or a CI job), whichever is cheapest for the repository. Only cross-file consistency and "matches the surrounding style" belong in a standards file, which the reviewer reads ([review-and-handoff](review-and-handoff.md)).
2. **Read the repository's own check command first** (its scripts and CI workflow). A check that already exists but is unwired or silently broken is the finding; do not reinvent it.
3. **A repository with no guardrail** (no commit hook and no CI job running its lint, type and test commands) is itself a finding.
4. **Installing a hook or changing agent configuration is a configuration change: ask first,** naming the file, the scope (this project or all projects) and what it blocks ([SKILL.md §1](../SKILL.md)). Merge into existing hook lists; never overwrite other settings.
5. **Commit hooks change every contributor's workflow.** Propose before adding them; ordinary development dependencies are fine, but the hook files and the package script that installs them are persistent configuration.
6. **Do not overwrite existing configuration.** If a lint, format or boundary configuration exists, merge the new rules in and say what was added.
7. **Prove the guard bites.** A check that cannot fail is worthless: observe a pass, then a deliberate violation failing, then a pass again. Report that sequence.
8. **Git safety is policy first.** Pushing, hard resets, forced cleans and forced branch deletion stay behind an approval whether or not a hook exists; the hook is a backstop, not the policy.
9. **Commit only if asked.** Setting up hooks never includes committing them unasked; if the user wants a commit, the new hook running on it is a good smoke test.

## Specifications

### What the dangerous-git guard blocks

| Command shape | Why |
|---|---|
| `git push` (every variant, including forced) | Publishes; needs an approval anyway |
| `git reset --hard` | Discards uncommitted work |
| `git clean -f` and `-fd` | Deletes untracked files |
| `git branch -D` | Deletes an unmerged branch |
| `git checkout .` and `git restore .` | Discards working-tree changes |

A portable guard (Node, no `jq`), for hosts whose command hooks send a JSON object on standard input with the command at `tool_input.command` and treat exit code 2 as a block with standard error shown to the agent. Hosts with a different contract need a small adapter:

```js
#!/usr/bin/env node
// block-dangerous-git.mjs
let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let command = "";
  try { command = JSON.parse(raw)?.tool_input?.command ?? ""; } catch { process.exit(0); }
  const dangerous = [
    /\bgit\s+push\b/, /\bgit\s+reset\s+--hard\b/, /\bgit\s+clean\s+-[a-zA-Z]*f/,
    /\bgit\s+branch\s+-D\b/, /\bgit\s+checkout\s+\./, /\bgit\s+restore\s+\./,
  ];
  const hit = dangerous.find((re) => re.test(command));
  if (hit) {
    process.stderr.write(`BLOCKED: '${command}' matches a protected git pattern. Ask the user to run it.\n`);
    process.exit(2);
  }
});
```

Test it: `echo '{"tool_input":{"command":"git push origin main"}}' | node block-dangerous-git.mjs` must exit with code 2 and print BLOCKED; a harmless command such as `git status` must exit 0.

### Pre-commit setup

1. Detect the package manager from the lockfile and use it for every command.
2. Install `husky`, `lint-staged` and `prettier` as development dependencies; run `husky init`, which creates the hook folder and adds a `prepare` script.
3. The hook file runs, in order: staged-file formatting (fast), then the repository's typecheck and test scripts. Omit a line whose script does not exist, and tell the user.
4. Lint-staged configuration: format every staged file and ignore types Prettier cannot parse (`prettier --ignore-unknown --write`).
5. Create a Prettier configuration only when none exists, with the project's own style if it has one; otherwise two-space indent, 80 columns, double quotes, semicolons.
6. Verify: the hook file exists and is executable, the `prepare` script is set, the configuration exists, and running lint-staged works.

### Entry-point boundary check (TypeScript projects organised as packages)

The shape: each package folder under a packages root has entry points as root files; subfolders (conventionally `lib/` for implementation and `tests/` for tests) are private.

| Rule | Meaning |
|---|---|
| Entry-point boundary from outside | Code outside a package, and other packages, import only root files |
| Intra-package freedom | A package's own files import each other freely |
| Tests through entry points | A package's tests may import entry points and their own fixtures, never internals, not even their own |
| Tests folder is private | Only tests import fixtures |
| No cycles | No dependency cycles |

A dependency-cruiser configuration (named `.dependency-cruiser.cjs` so it works in ES-module projects; set only `PACKAGES_ROOT`):

```js
const PACKAGES_ROOT = "src/packages";
const R = PACKAGES_ROOT;
const INTERNALS = `^${R}/[^/]+/[^/]+/`; // anything nested in a package subfolder

module.exports = {
  forbidden: [
    { name: "entrypoint-boundary-from-app", severity: "error",
      from: { pathNot: `^${R}/` }, to: { path: INTERNALS } },
    { name: "entrypoint-boundary-across-packages", severity: "error",
      from: { path: `^${R}/([^/]+)/`, pathNot: `^${R}/[^/]+/tests/` },
      to: { path: INTERNALS, pathNot: `^${R}/$1/` } },
    { name: "tests-through-entrypoints", severity: "error",
      from: { path: `^${R}/([^/]+)/tests/` },
      to: { path: INTERNALS, pathNot: `^${R}/$1/tests/` } },
    { name: "tests-folder-is-private", severity: "error",
      from: { pathNot: `^${R}/[^/]+/tests/` }, to: { path: `^${R}/[^/]+/tests/` } },
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: { extensions: [".ts", ".tsx", ".js", ".jsx", ".json"] },
  },
};
```

Do not flatten the `$1` back-references into per-package rules; they are what lets a package reach its own internals while outsiders cannot. Packages are flat (one tier under the root); a package's internals may nest, but a package may not contain another package. Layering (which package may depend on which) is a separate concern, added as extra rules by the repository.

## Implementation

1. Detect the package manager, the packages root (`src/packages` when `src/` exists, otherwise `packages`) and any existing configuration; confirm anything unusual with the user.
2. Ask the user's approval for the specific change (rule 4 or 5), then install and write the files.
3. Wire the check into the repository's umbrella command (the one that already runs the typecheck, such as a `check` or `ci` script); if none exists, add a script and tell the user to include it in CI.
4. For boundaries, scaffold a small example package that exposes behaviour through a root entry point and hides its implementation in `lib/`, with a test that imports only the entry point, then prove the rules bite (rule 7): run it clean (passes); add a deep import to the test (must fail with `tests-through-entrypoints`); revert (passes again).
5. Document the convention in a short README inside the packages folder (the layout, "import only through entry points", how to run the check, and that barrel files are discouraged: expose several small entry points instead), and add a one-line pointer to it from the project's agent instructions file.
6. For the git guard, ask the scope (this project's settings or the user-wide settings), place the script, merge the hook entry, then run the test in the Specifications section.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| The repository already has a boundary or lint configuration | Merge the rules in; do not overwrite; list what was added |
| The check passes on the deliberate violation | The rules are not wired correctly; fix before finishing |
| The host has no command hooks | Keep the git rules as policy ([SKILL.md §1](../SKILL.md)) and say no hook was installed |
| There is no typecheck or test script | Omit those hook lines and tell the user |
| The user does not want contributors' workflow changed | Provide the check as a script they can run or wire into CI themselves |
| The `jq` tool is missing on Windows | Use the Node guard above |

## Verification

- A pass, a deliberate failure and a pass again were observed for each new check, and reported.
- No existing configuration was overwritten, and the merge is described.
- Nothing was committed, pushed or installed outside the approval given.
- The convention is documented and pointed to from the project's agent instructions.

## Sources

- Adapted and extended from the MIT-licensed `git-guardrails-claude-code`, `setup-pre-commit` and `setup-ts-deep-modules` skills by Matt Pocock, and the mechanical-versus-judgement rule of the `retro` skill. Rewritten for this package: a dependency-free Node guard replaces the shell script that needed `jq`, the approval and merge rules are new, and the boundary configuration is restated compactly with the same five rules.
