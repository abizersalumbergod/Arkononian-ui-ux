# Production readiness report

Copy this file into the project (for example `docs/readiness/<date>.md`), fill every row from evidence, and delete sections that do not apply to the tier with the words NOT_APPLICABLE and the reason. T0 and T1 reports are one page: sections 1-4, 6 and 13. Rules: [production-readiness](../references/production-readiness.md). Statuses are PASS, FAIL, NOT_TESTED, BLOCKED or NOT_APPLICABLE; a PASS needs the command and the result. Never paste a secret value; names only.

| Field | Value |
|---|---|
| Project | `<name>` |
| Date and commit | `<YYYY-MM-DD>`, `<short sha>` |
| Tier | `<T0-T3>` and the facts that set it (server code, personal data, accounts, payments, uploads, tenants, traffic) |
| Prepared by | The agent, from evidence listed below |
| Owner and sign-off | `<name of the human owner>`; signed off: yes or no, date, as stated by that person in chat |
| Result | READY, READY WITH ACCEPTED RISKS, NOT READY or NOT ASSESSED |

## 1. Architecture inventory

| Item | Finding | How verified |
|---|---|---|
| Frontend and framework versions | | `package.json`, lockfile |
| Backend or serverless runtime | | |
| Hosting and what the host provides (TLS, CDN, balancing, scaling) | | Host documentation, settings |
| Database, ORM, cache, object storage | | |
| Authentication and authorisation mechanism | | Code read, not assumed |
| Third-party services and processors | | Dependencies, environment variable names, scripts loaded |
| Background jobs, queues, schedulers | | |
| CI and deployment path | | |
| Logging, monitoring, error tracking | | |
| Critical user journeys | | |

## 2. Release readiness checklist

| # | Condition | Status | Evidence (command and result, or link) |
|---|---|---|---|
| 1 | No unresolved critical vulnerability | | |
| 2 | No unresolved high-severity exploitable vulnerability without an approved exception | | |
| 3 | Authentication and authorisation tests pass for every role and resource | | |
| 4 | Critical business journeys pass | | |
| 5 | Database backups exist and a restore was verified | | |
| 6 | Recovery procedures are written | | |
| 7 | Rollback was exercised | | |
| 8 | Monitoring and alerts work (forced failure delivered) | | |
| 9 | Load results meet the agreed capacity target | | |
| 10 | No critical performance regression | | |
| 11 | Production configuration reviewed | | |
| 12 | No secrets exposed | | |
| 13 | Required compliance controls addressed | | |

## 3. Issue register

| ID | Severity | Affected component | Root cause | Business impact | Remediation | Status | Verification evidence |
|---|---|---|---|---|---|---|---|
| PR-001 | | | | | | | |

Severity bands: 9.0-10.0 critical, 7.0-8.9 high, 4.0-6.9 medium, 0.1-3.9 low (CVSS where a score exists); lowering below the band needs a recorded reason. Status: open, fixed, accepted risk, will not fix with reason.

## 4. Baseline checks

| Check | Command | Result |
|---|---|---|
| Baseline scan | `node scripts/baseline-check.mjs --project . --tier <n>` | |
| Dependency audit | `npm audit --omit=dev --audit-level=high` | |
| Secret scan (tree and history) | `gitleaks detect --redact` | |
| Type check, lint, tests (counts) | | passed / failed / skipped, before and after |
| Security headers on the preview host | `curl -sI <url>` | |

## 5. Security summary

| Area | Status | Evidence |
|---|---|---|
| Threat model written | | |
| Authentication values (hashing, sessions, tokens, reset, throttles) | | |
| Authorisation matrix automated | | |
| Attack classes checked (see the table in [security-hardening](../references/security-hardening.md)) | | |
| Transport, headers, CORS, cookies | | |
| Secrets and dependencies, SBOM | | |
| Files and data (uploads, storage, encryption) | | |
| AI features reviewed (if present) | | |

## 6. Performance (baseline and after, measured)

| Metric | Device | Baseline | After | Tool and conditions |
|---|---|---|---|---|
| LCP (lab, field if available) | Mobile | | | |
| INP | Mobile | | | |
| CLS | Mobile | | | |
| LCP, INP, CLS | Desktop | | | |
| API p50, p95, p99, error rate | n/a | | | |
| JavaScript and total transfer size | Mobile | | | |

## 7. Scalability and reliability

| Item | Finding | Status |
|---|---|---|
| What the host provides, and what was added | | |
| Statelessness test (two instances, kill one) | | |
| Health checks and graceful shutdown | | |
| Autoscaling bounds and cost alert | | |
| Queue and retry design, dead-letter alert | | |
| Failure scenarios tested (list each and result) | | |
| RTO and RPO targets, measured values | | |

## 8. Database and backups

| Item | Finding | Status |
|---|---|---|
| Constraints, keys, indexes reviewed | | |
| Row-level security or ownership tests | | |
| Migrations validated on empty and restored copies | | |
| Restore drill: date, target, duration, integrity checks, measured RPO and RTO | | |
| Retention and deletion jobs | | |

## 9. API inventory

Paste or link the endpoint table from [api-protection](../references/api-protection.md) §1 with authentication, authorisation, rate class and tests per row. Count of endpoints: `<n>`; endpoints without tests: `<n>`.

## 10. Deployment and rollback

| Item | Finding | Status |
|---|---|---|
| Pipeline stages and failing-check proof | | |
| Pinned actions, least-privilege tokens, protected production environment | | |
| Built-output check (no `.env`, source maps, debug routes) | | |
| Rollback rehearsal: trigger, command, time to recover | | |
| Production deploy approval (who, which target, when) | | |

## 11. Observability

| Item | Finding | Status |
|---|---|---|
| Structured logs without secrets or unnecessary personal data | | |
| Error tracking with scrubbing | | |
| Uptime check and critical journey check | | |
| Alerts configured and one forced and delivered | | |
| Real-user Web Vitals collected | | |

## 12. Test results

| Suite | Passed | Failed | Skipped | Notes |
|---|---|---|---|---|
| Unit | | | | |
| Integration | | | | |
| End-to-end critical journeys | | | | |
| Accessibility | | | | |
| Compatibility matrix | | | | |

Load runs (one row per run; keep the raw summary files):

| Run | Environment | Scenario | Req/s | p50 / p95 / p99 (ms) | Error % | CPU, memory, DB connections | Result |
|---|---|---|---|---|---|---|---|
| L-001 | | | | | | | |

## 13. Privacy and compliance

Copy the checklist from [privacy-and-compliance](../references/privacy-and-compliance.md) §8 with a status and evidence per row; list the applicable regimes and the assumptions behind them. Legal pages are drafts until the owner approves publication.

## 14. Outstanding risks

| ID | Risk | Owner | Reason accepted | Review date |
|---|---|---|---|---|
| | | | | |

## 15. Runbooks

Links to the production deployment runbook, the disaster recovery and rollback plan, the alert runbooks, and the date of the last drill.

## 16. Sign-off

Written only when the named owner says so: `Signed off by <name> on <date>: <their words>`. Until then the line reads `Not signed off`.
