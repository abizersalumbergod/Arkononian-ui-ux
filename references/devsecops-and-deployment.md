# DevSecOps and deployment

How a change travels from a commit to production safely: the pipeline stages and what fails each one, secret injection and least-privilege credentials, supply-chain protection for dependencies and CI itself, environment isolation, immutable artifacts, container hardening, rollout strategies, rollback, and the runbook. Deploying is always an approval point in this package; building the pipeline files in the workspace is ordinary work.

**Load when:** CI or CD is being created or changed (GitHub Actions, GitLab CI, Vercel, Netlify, Docker), a deploy is planned, rollbacks or environments are discussed, a build exposes files or secrets, dependency or container scanning is requested, or a release runbook is needed; every T2 and T3 build. **Owns:** the pipeline stage table and its fail conditions, CI hardening rules, secret injection, environment isolation, artifact and container rules, rollout and rollback strategies, deploy-time checks of the built output, the production deployment runbook skeleton.
**Related:** [production-readiness](production-readiness.md), [security-hardening](security-hardening.md), [database-integrity](database-integrity.md), [scalability-and-reliability](scalability-and-reliability.md), [observability-and-alerting](observability-and-alerting.md), [load-and-qa-testing](load-and-qa-testing.md), [repo-guardrails](repo-guardrails.md), [review-and-handoff](review-and-handoff.md), [security-and-privacy](security-and-privacy.md), [frontend-architecture](frontend-architecture.md), [quality-gates](quality-gates.md)

## Decision rules

1. **Nothing deploys while a critical check fails.** The pipeline blocks on failed type checks, tests, secret scans, high or critical dependency findings with a reachable path, failed migrations and failed smoke tests. A bypass is a recorded exception with an owner, never a flag in the pipeline.
2. **Deploying is an approval point.** The agent writes pipeline files and runs checks locally; pushing a deploy, promoting to production, changing hosting settings or secrets in a provider dashboard needs the user's explicit approval naming the target ([SKILL.md §1](../SKILL.md)). Propose a deploy only after the gates in scope have run.
3. **Pipeline as code, reviewed like code.** Workflow files live in the repository, change through reviewed pull requests, and protected branches require passing checks.
4. **Least privilege everywhere.** CI tokens default to read-only (`permissions: contents: read`), widened per job; deploy credentials exist only in the deploy job and the protected environment; prefer short-lived federated credentials (OIDC to the cloud provider) over stored long-lived keys.
5. **Secrets come from the platform's secret store at run time,** never from the repository, build logs, container layers or artifacts. Secrets are not exposed to pull requests from forks. Separate values per environment. Logs mask them, and the pipeline never echoes them.
6. **Protect the supply chain of the pipeline itself:** pin third-party actions and images to a commit SHA or digest, review update pull requests, avoid `pull_request_target` with untrusted code, install with the frozen lockfile (`npm ci`), run the dependency audit and secret scan on every change.
7. **Build once, promote the same artifact.** The artifact deployed to production is the one tested in staging, identified by a commit and a digest; configuration differs per environment, code does not.
8. **Environments are isolated.** Preview and staging use their own databases, keys, storage and third-party sandboxes; they never read production data or send real emails, charges or messages; preview URLs are not indexed (`noindex` plus access control).
9. **Migrations are a pipeline stage, validated first:** applied to a clean database and a restored copy in CI, backward-compatible with the running version, and run before the new code takes traffic ([database-integrity](database-integrity.md)).
10. **Check the built output, not just the source:** no `.env`, `.git`, source maps, test fixtures or debug routes in the deployed files; no secret patterns in the bundle; headers present on the preview.
11. **Roll out gradually and watch.** Rolling, blue-green or canary releases gated by readiness and by error-rate and latency checks with automatic rollback; feature flags for risky changes.
12. **Rollback is a tested capability.** Rehearse it in staging and record the time to recover; keep the previous artifact and a database path that works with it.
13. **Containers are minimal and unprivileged** (§4), scanned, and pinned by digest.
14. **Every release leaves a record:** commit, artifact digest, checks and their results, approver, time, and the rollback target.
15. **Keep the pipeline fast and honest.** Cache dependencies, run independent jobs in parallel, fail early; never mark a check as passing that did not run, and never `continue-on-error` a security stage.

## Specifications

### 1. Pipeline stages

| # | Stage | Typical tools | Fails the build when |
|---|---|---|---|
| 1 | Install | `npm ci` (frozen lockfile) | Lockfile and manifest disagree |
| 2 | Code quality | ESLint, Prettier check | Lint errors |
| 3 | Type check | `tsc --noEmit` | Type errors |
| 4 | Unit tests | Vitest, Jest, pytest | Any failure |
| 5 | Integration tests | Tests against a containerised database and queue | Any failure |
| 6 | Dependency scan | `npm audit --omit=dev --audit-level=high`, `osv-scanner`, Dependabot or Renovate alerts | High or critical finding with a reachable path and no approved exception |
| 7 | Secret scan | `gitleaks`, `trufflehog`, host secret scanning | Any verified secret |
| 8 | Static analysis | Semgrep rules, CodeQL, framework lint rules for security | High or critical finding |
| 9 | Build | Production build; bundle size budget | Build error; budget exceeded without exception |
| 10 | Built-output check | `node scripts/baseline-check.mjs`; grep the output for secret patterns, `.map`, `.env` | Any fail-level finding |
| 11 | Container and IaC scan | `trivy image`, `trivy config` | High or critical finding in a shipped image or config |
| 12 | Migration validation | Apply to empty and restored-copy databases; check compatibility | Migration error, destructive step without the gate |
| 13 | Staging deploy | Deploy the same artifact | Deploy error, readiness never passes |
| 14 | End-to-end and smoke tests | Playwright against staging; health, login, one critical journey | Any failure |
| 15 | Load or regression probe (T2+) | k6 smoke or short load against staging | Threshold breach ([load-and-qa-testing](load-and-qa-testing.md)) |
| 16 | Production deploy | Approval-gated; rolling, blue-green or canary | Not approved; readiness or canary checks fail |
| 17 | Post-deploy verification | Synthetic checks, error-rate and latency watch, alert test | Regression, automatic rollback |

Tier use: T0 needs stages 1-4, 6, 7, 9, 10; T1 adds 14; T2 adds 5, 8, 11, 12, 13, 15, 17; T3 adds a canary at stage 16 and an independent review before first launch.

### 2. CI hardening checklist

| Item | Setting |
|---|---|
| Default token permissions | Read-only; grant `id-token: write` or `contents: write` only on the job that needs it |
| Third-party actions | Pinned to a full commit SHA; updates reviewed |
| Forks | Secrets unavailable to fork pull requests; no `pull_request_target` that checks out and runs untrusted code |
| Environments | Production environment requires a named reviewer and is limited to the main branch |
| Branch protection | Required checks, required review, no force pushes to the default branch |
| Credentials | OIDC federation instead of stored cloud keys where the provider supports it |
| Logs | Secret masking on, no `set -x` around secrets, artifacts exclude `.env` |
| Dependency updates | Dependabot or Renovate pull requests, not auto-merged for major versions |
| Provenance | Build provenance or signed artifacts where the registry supports them |

### 3. Environment matrix

| Environment | Data | Secrets | Integrations | Access | Indexing |
|---|---|---|---|---|---|
| Local | Seeded fake data | Local `.env`, never production | Mocks or sandboxes | Developer | n/a |
| Preview | Disposable fake data | Preview-only values | Sandboxes | Team or token | `noindex` and access control |
| Staging | Anonymised or synthetic copy of the shape | Staging-only values | Sandboxes | Team | `noindex` and access control |
| Production | Real | Production values in the secret store | Live | Least privilege, audited | Public pages only |

### 4. Container rules

Minimal base image pinned by digest; multi-stage build so build tools do not ship; run as a non-root user; read-only root filesystem where the app allows; no secrets in build arguments or layers; only the needed port exposed; `HEALTHCHECK` or platform probes; vulnerability scan on the built image; `.dockerignore` excludes `.env`, `.git` and local artifacts; one process per container with proper signal handling (`SIGTERM` reaches the app, see [scalability-and-reliability](scalability-and-reliability.md)).

### 5. Rollout strategies

| Strategy | Use when | Rollback |
|---|---|---|
| Rolling | Stateless instances, compatible versions | Redeploy the previous artifact |
| Blue-green | A second full environment is affordable, instant switch wanted | Switch traffic back |
| Canary | Higher risk or high traffic; small share first | Route the canary share back to zero automatically on threshold breach |
| Feature flag | Behaviour change independent of deploy | Turn the flag off |
| Managed platform (Vercel, Netlify and similar) | Atomic deploys with instant promotion | Promote the previous deployment |

Automatic rollback triggers: error rate above a threshold for a window, p95 latency above the objective, failed readiness, failed synthetic journey.

### 6. Production deployment runbook (skeleton)

Before: change summary and risk; checks green with links; backup verified for data-changing releases; migration compatibility confirmed; approver named; rollback target and command noted; monitoring watched by a named person; communication sent if user-visible.
During: deploy to staging, smoke test; promote or start the canary; watch the §5 triggers for the observation window.
After: post-deploy checks (health, login, one journey), alert test result, record in the release log.
Rollback: trigger, command, expected recovery time, how to verify, who decides.

## Implementation

**GitHub Actions (hardened skeleton)**

```yaml
name: ci
on:
  pull_request:
  push: { branches: [main] }
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<full-commit-sha>        # pin by SHA; keep a version comment
      - uses: actions/setup-node@<full-commit-sha>
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test
      - run: npm audit --omit=dev --audit-level=high
      - run: npm run build
      - run: node scripts/baseline-check.mjs --project . --tier 2
  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<full-commit-sha>
        with: { fetch-depth: 0 }
      - run: gitleaks detect --redact --no-banner       # install step pinned and verified in the real workflow
  deploy:
    needs: [verify, secrets]
    if: github.ref == 'refs/heads/main'
    environment: production                              # protected: required reviewer
    permissions: { contents: read, id-token: write }
    runs-on: ubuntu-latest
    steps:
      - run: echo "deploy the artifact built above using the provider's OIDC login"
```

Replace the `<full-commit-sha>` markers with real SHAs from each action's release page; the placeholder markers are deliberate because a SHA must be looked up, not recalled. The deploy job is a template: the user approves the real deployment step and the target.

**Checking a deployed preview (authorised host only)**

```bash
for p in /.env /.git/HEAD /server.js.map /api/debug; do printf "%s -> " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "https://preview.example.test$p"; done   # expect 404 or 403
curl -sI https://preview.example.test | grep -iE "strict-transport|content-security|x-content-type|referrer|permissions"
```

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| A scanner is not installed in CI or locally | Mark the stage NOT_TESTED, add the install step in the pipeline file, and ask before a system-wide local install |
| A dependency finding has no fix | Check reachability; upgrade, replace or isolate; record an exception with owner and review date |
| A secret was printed in a log | Treat as exposed: the user rotates it, delete the log run, add masking |
| Preview deployments serve production data | Point previews at a separate database and keys; rotate anything exposed |
| The migration fails on the restored copy | Fix the migration; never test it first on production |
| Rollback needs a destructive down-migration | Redesign as expand and contract so the old code works with the new schema |
| The platform deploys on every push with no gate | Disable auto-production, require a protected branch and a promotion step (the user changes the provider setting) |
| Pipeline is too slow and people skip it | Cache, parallelise, move slow stages to merge-queue, never remove security stages |
| No CI exists | Add the workflow file to the workspace; running it in the provider needs the user's approval and secrets set by them |
| Third-party action cannot be pinned | Replace with a script step or vendor the action after review |

## Verification

- The pipeline file runs stages 1-4, 6, 7, 9 and 10 at minimum, and no security stage uses `continue-on-error`.
- A deliberately failing check (a test, a fake-looking secret on a throwaway branch, a high-severity audit finding) blocks the pipeline; the evidence is recorded.
- Actions and images are pinned; token permissions are read-only by default; production requires a reviewer.
- The built output check passed on the preview host, with the header output saved.
- Migration validation ran on an empty and a restored database.
- A rollback was rehearsed in staging with a recorded time, or the row is NOT_TESTED.
- Every production deploy had the user's approval naming the target.

## Sources

- Paraphrased, no text copied: GitHub Actions security hardening guidance, OpenSSF Scorecard and SLSA concepts, OWASP CI/CD security risks, Docker and CIS container benchmark guidance, Trivy, gitleaks, Semgrep and osv-scanner documentation, and the blue-green, canary and expand-and-contract deployment patterns.
- Structure and rules follow phase 7 of the user's production-readiness brief.
