# Production readiness

How every site or app this package builds becomes secure, fast, reliable and operable by default, and how an existing one is audited and repaired without a rebuild. The depth of the work scales with a risk tier chosen from facts: a brochure site gets a short baseline, an app with accounts and payments gets the whole programme. This module is the hub; the specialist modules own the detail.

**Load when:** any website or app build, redesign or audit (every site route loads it); the user says production, launch, secure, harden, scale, "pre-production audit", "vibe coded" or "AI-generated code"; or a release is about to be called ready. **Owns:** the risk tiers, the build-time defaults for AI-assisted builds, the phase map from discovery to release gate, the release-readiness checklist and its evidence rules, the authorised-scope and approval rules for security and load work, the issue record and the report skeleton.
**Related:** [security-hardening](security-hardening.md), [api-protection](api-protection.md), [database-integrity](database-integrity.md), [backend-performance](backend-performance.md), [scalability-and-reliability](scalability-and-reliability.md), [devsecops-and-deployment](devsecops-and-deployment.md), [observability-and-alerting](observability-and-alerting.md), [load-and-qa-testing](load-and-qa-testing.md), [privacy-and-compliance](privacy-and-compliance.md), [security-and-privacy](security-and-privacy.md), [performance](performance.md), [quality-gates](quality-gates.md), [frontend-architecture](frontend-architecture.md), [seo-and-discoverability](seo-and-discoverability.md), [craft-library](craft-library.md), [report template](../templates/production-readiness-report.md), [baseline check](../scripts/baseline-check.mjs)

## Decision rules

1. **Every build is production-minded.** The default is never "demo quality, harden later". The baseline for the build's tier is written in at Stage 5 and checked at Stage 10; hardening afterwards costs more and usually gets skipped.
2. **Pick the tier at Stage 2, from facts.** Ask: does it run server code of ours, collect or store personal data, have accounts, take payments, accept uploads, have an admin area, serve several tenants, or expect sustained traffic? Record the tier and the facts in the brief or the [design decision record](../templates/design-decision-record.md). Server code or stored user data means at least T1; accounts, a database, payments or uploads mean at least T2. The user can raise a tier freely; lowering one needs a stated reason in the record.
3. **Scale to the measured need.** Add a load balancer, queue, cache, replica or second region only when a measurement or a stated requirement calls for it. A managed host (Vercel, Netlify, Cloudflare, a PaaS) already provides TLS, a CDN and request distribution: read what the host provides and do not rebuild it. Say plainly when a requirement does not apply to the chosen architecture.
4. **Existing code: audit before modifying.** Read the real implementation, not filenames or framework conventions. Preserve the behaviour, design, business logic, integrations and architecture; make the smallest reliable fix for a verified problem, add a regression test, and re-run the check that found it. Rebuilding is never the fix for an audit finding.
5. **Evidence or it did not happen.** A finding needs a reproduction, a code reference or a tool output. A pass needs the command and its result. Statuses are PASS, FAIL, NOT_TESTED, BLOCKED and NOT_APPLICABLE ([quality-gates](quality-gates.md)); an accepted risk is a justified exception with an owner, a reason and a review date. Never report an unexecuted test as passed and never invent a number.
6. **No cosmetic fixes.** Do not lower a severity, suppress a warning, disable a rule, add `// @ts-ignore`, skip hooks with `--no-verify` or add an allow-list entry to make a report clean. Fix the root cause or record the risk.
7. **Authorised scope only.** Security probing and load generation run against localhost, the user's own staging or preview host, or a target the user named as theirs. Never against third-party systems. Production only with explicit approval naming the target, the method and the time window. Never run a mutating journey (checkout, delete, bulk update) against production.
8. **Approvals follow [SKILL.md §1](../SKILL.md).** Ask first for: deploying; rotating or changing secrets; changing production infrastructure, permissions or account settings; provisioning anything that costs money; destructive or irreversible data operations; installing system-wide tools; sending data to a new service. Reading code, adding tests, validation, headers, CI files and configuration in the workspace, and running local scanners are ordinary work and need no approval. A leaked credential is reported to the user at once: removing it from code does not revoke it.
9. **Secrets stay out of every report.** Names only; previews at most four characters. Scan git history for secrets, but never print what you find ([security-and-privacy](security-and-privacy.md) rule 3).
10. **Protect data first.** No destructive migration, bulk delete or schema change on real data without a verified backup, a compatibility assessment and a recovery path. Restores are tested on a scratch copy, never on production ([database-integrity](database-integrity.md)).
11. **Do not buy a score with quality.** Do not strip 3D, animation, imagery or interaction only to raise a Lighthouse number. Use budgets, lazy loading, adaptive quality and compression ([performance](performance.md)). Baselines come before changes, mobile and desktop are measured separately, results are recorded as measured.
12. **Generated code is a draft.** Verify every package name before installing it, every API a snippet claims exists, every authorisation check it appears to perform, and every test it wrote: a test that still passes when the code is broken proves nothing. See §2.
13. **One owner per topic.** Use the table in §3 to find the module that owns a topic; cite it instead of copying it.
14. **Readiness is a conclusion from evidence.** Use the checklist in §4. The agent prepares the readiness report; "signed off" is written only against a named human owner who said so. Never write an approval on a person's behalf.
15. **Privacy and legal items are engineering guidance, not legal advice.** Recommend review by counsel for policies and consent wording, and never publish policy text without approval.

## Specifications

### 1. Risk tiers

| Tier | Looks like | Always build in | Adds at this tier | Evidence |
|---|---|---|---|---|
| T0 Static | Pages and assets, perhaps analytics; no server code of ours, no form endpoint, no stored personal data | The §2 defaults, host TLS and security headers, CSP, dependency audit, Gates D and E, SEO basics, a privacy notice when analytics or embeds are present | none | Header check, audit output, gate results |
| T1 Site with inputs | Contact, waitlist, newsletter or booking form; CMS; serverless endpoint; third-party scripts | T0 plus [api-protection](api-protection.md) on every endpoint (validation, size limit, rate limit, spam control, header-injection guard), secrets server-side, consent and a data inventory ([privacy-and-compliance](privacy-and-compliance.md)), uptime check and error tracking ([observability-and-alerting](observability-and-alerting.md)) | Webhook and email safety | Endpoint inventory, rate-limit test, consent test |
| T2 App | Accounts, database, payments, uploads, admin area, API, background jobs | T1 plus the full [security-hardening](security-hardening.md), [database-integrity](database-integrity.md), the [devsecops-and-deployment](devsecops-and-deployment.md) pipeline gates, [load-and-qa-testing](load-and-qa-testing.md) at expected peak, a backup with a tested restore, data export and deletion | Authz tests per resource | Threat table, authz tests, CI log, load results, restore record |
| T3 Scaled, multi-tenant or regulated | Several tenants; health, finance or children's data; high traffic; a contractual SLA | T2 plus per-resource tenant-isolation tests, [scalability-and-reliability](scalability-and-reliability.md) autoscaling and failure drills, load at twice the expected peak, SLOs, a disaster-recovery plan with measured RTO and RPO, a recommendation for an independent review | Isolation and drill records | Isolation results, drill records, SLO dashboard |

### 2. Build-time defaults for AI-assisted ("vibe coded") builds

These sixteen defaults apply to every build from the first prompt, at every tier unless marked.

1. **Secrets:** none in client code, public-prefixed variables, repositories or logs; `.env*` git-ignored with a committed `.env.example` of placeholders; service-role and private keys server-side only ([security-hardening](security-hardening.md)).
2. **Authorisation on the server, per record:** every route handler, Server Action, API route and edge function checks who is calling and whether they may touch this record. Hiding a button is not access control (T1+).
3. **Never trust the client for identity, role, price, quantity or ownership.** Derive them from the server session and the database.
4. **Validate every input with a schema** at the boundary, and shape every output through an allow-list ([api-protection](api-protection.md)) (T1+).
5. **Row-level security or equivalent on every table a browser-reachable key can read** (Supabase, Firebase rules, Postgres RLS), with a test that proves a second user cannot read or write the first user's rows (T2+).
6. **Security headers and a CSP** from the first deploy: HSTS, `nosniff`, referrer policy, permissions policy, `frame-ancestors`.
7. **Rate limits on every endpoint that sends mail, checks a password or code, searches, or calls a paid API,** plus a spend cap on every metered third-party service (T1+).
8. **Dependencies:** verify each package name, publisher and age before installing; commit the lockfile; install with the locked command; run an audit in CI.
9. **Bounded everything:** page sizes, body sizes, upload sizes, query limits, timeouts on every outbound call, retries that are limited and jittered.
10. **Database:** constraints, foreign keys and indexes designed with the schema, not after the first slow page ([database-integrity](database-integrity.md)) (T2+).
11. **Errors never leak:** no stack traces, SQL or internal ids to the client; one error shape; server logs carry a request id and no secrets.
12. **No mock data in production paths:** fixtures are labelled and cannot ship; no hard-coded demo users, default admin passwords, test-mode keys or debug routes.
13. **Observability from day one:** error tracking, an uptime check on a health endpoint, structured logs without personal data (T1+).
14. **A health endpoint, graceful shutdown and stateless instances** so the app can run behind any balancer (T2+).
15. **CI runs type check, lint, tests, dependency audit and secret scan before any deploy,** and deploys are rollbackable ([devsecops-and-deployment](devsecops-and-deployment.md)) (T2+).
16. **A privacy notice that matches what the site really does,** consent before non-essential cookies and trackers, and a way to export and delete a person's data when accounts exist ([privacy-and-compliance](privacy-and-compliance.md)).

Common defects in generated code, and where to look:

| Defect | Why it happens | Check | Owner |
|---|---|---|---|
| Secret in a client bundle or `NEXT_PUBLIC_` variable | The model wires the key where the call is | `node scripts/baseline-check.mjs`; grep the built output | [security-hardening](security-hardening.md) |
| Handler with no authorisation, or a check only in middleware or the UI | The happy path was prompted, the attacker's path was not | Call each endpoint as anonymous, as user A against user B's id, as a low role | [api-protection](api-protection.md) |
| Client sends `userId`, `role`, `price` or `isAdmin` and the server believes it | Convenient for the demo | Tamper the request body and replay it | [security-hardening](security-hardening.md) |
| Table readable with the public key | RLS not enabled, or `using (true)` | Query as anonymous and as another user; run the host's advisor | [database-integrity](database-integrity.md) |
| `Access-Control-Allow-Origin: *`, or reflected origin with credentials | Made the console error go away | Request with a foreign `Origin` | [api-protection](api-protection.md) |
| String-built SQL, `exec` with user text, `dangerouslySetInnerHTML` | Fastest snippet | Static scan, then try a payload | [security-hardening](security-hardening.md) |
| Invented or look-alike package name | Models invent plausible names; attackers register them | Check the registry page, publisher, age, downloads, repository | [security-hardening](security-hardening.md) |
| No pagination, N+1 queries, sequential awaits, no timeout | Works with ten rows | Seed realistic volume; count queries per request | [backend-performance](backend-performance.md) |
| Test that always passes | Generated alongside the code it checks | Break the code on purpose; the test must fail | [load-and-qa-testing](load-and-qa-testing.md) |
| Fake loading, hard-coded metrics, placeholder data left in | Placeholder never replaced | Search for fixtures; run with an empty database | [dashboard-engineering](dashboard-engineering.md) |
| Tokens in `localStorage`, long-lived JWT, no logout revocation | Tutorial pattern | Inspect storage and cookie flags | [security-hardening](security-hardening.md) |
| Source maps and `.env` served publicly | Default build or deploy settings | Request `/.env`, `/*.map`, `/.git/HEAD` on the preview host | [devsecops-and-deployment](devsecops-and-deployment.md) |

### 3. Phase map and owners

| Phase | Question it answers | Owning module | Stage in [SKILL.md](../SKILL.md) |
|---|---|---|---|
| 0 Discovery | What actually runs here, and what depends on what? | this module §5, [frontend-architecture](frontend-architecture.md) | 1 |
| 1 Security | Can it be attacked, and how do we prove it cannot? | [security-hardening](security-hardening.md), [security-and-privacy](security-and-privacy.md) | 5, 10 |
| 2 Performance | Is it fast on real devices, and where does time go? | [performance](performance.md), [backend-performance](backend-performance.md) | 5, 10 |
| 3 Scalability | Does it hold under more traffic, and what breaks first? | [scalability-and-reliability](scalability-and-reliability.md), [backend-performance](backend-performance.md) | 3, 10 |
| 4 Reliability | What happens when a part fails? | [scalability-and-reliability](scalability-and-reliability.md) | 5, 10 |
| 5 Data integrity | Can the data be wrong, lost, leaked or raced? | [database-integrity](database-integrity.md) | 3, 5, 10 |
| 6 API quality | Is each endpoint authenticated, authorised, bounded and honest? | [api-protection](api-protection.md) | 5, 10 |
| 7 DevSecOps | Is every release built, checked and reversible? | [devsecops-and-deployment](devsecops-and-deployment.md) | 10, 11 |
| 8 Observability | Will we know when it breaks, before the users tell us? | [observability-and-alerting](observability-and-alerting.md) | 5, 11 |
| 9 QA and load | Does it work, keep working, and survive peak? | [load-and-qa-testing](load-and-qa-testing.md), [visual-testing](visual-testing.md), [accessibility](accessibility.md) | 8-10 |
| 10 Privacy, compliance, SEO | Are we allowed to do this, and can it be found? | [privacy-and-compliance](privacy-and-compliance.md), [seo-and-discoverability](seo-and-discoverability.md) | 2, 10 |
| 11 Release gate | Is the evidence enough to call it ready? | this module §4, [quality-gates](quality-gates.md) | 11 |

### 4. Release-readiness checklist

A release is ready only when each applicable row has its evidence. Rows marked with a tier apply from that tier up; a row that does not apply is NOT_APPLICABLE with the reason.

| # | Condition | Evidence that proves it | From |
|---|---|---|---|
| 1 | No unresolved critical vulnerability | Scanner output plus the issue register, each critical item closed with a re-test | T0 |
| 2 | No unresolved high-severity exploitable vulnerability without an approved risk exception | Register rows; exception with owner and review date | T0 |
| 3 | Authentication and authorisation tests pass for every role and resource type | Test run output; negative cases included (anonymous, other user, other tenant, low role) | T1 |
| 4 | Critical business journeys pass | Journey test output with counts; Gate B | T0 |
| 5 | Database backups exist and a restore was verified | Restore record: scratch target, duration, integrity checks | T2 |
| 6 | Recovery procedures are written | Runbook and disaster-recovery plan in the repository | T2 |
| 7 | Rollback was exercised | Record of a rollback in staging: trigger, time to recover | T2 |
| 8 | Monitoring and alerts work | A forced failure in staging fired the alert to a real channel | T1 |
| 9 | Load results meet the agreed capacity target | k6 or equivalent summary at expected peak (T3: twice peak), environment recorded | T2 |
| 10 | No critical performance regression | Baseline and after numbers, mobile and desktop; Gate E | T0 |
| 11 | Production configuration reviewed | Review note: environment variables by name, headers, CORS, cookies, debug flags, origins | T0 |
| 12 | No secrets exposed | Secret scan of the working tree and history, plus a grep of the built output | T0 |
| 13 | Required compliance controls addressed | Privacy checklist from [privacy-and-compliance](privacy-and-compliance.md) with each row's status | T1 |

Result vocabulary for the readiness report: READY (every applicable row has evidence), READY WITH ACCEPTED RISKS (rows 1-2 have approved exceptions, every other row passes), NOT READY, or NOT ASSESSED (rows are NOT_TESTED or BLOCKED). Never write READY over a NOT_TESTED row.

### 5. Issue record

Every finding, fixed or not, is one record with these fields: **Issue ID** (`PR-001`), **Severity**, **Affected component** (file, route, table, service), **Root cause**, **Business impact**, **Recommended remediation**, **Implementation status** (open, fixed, accepted risk, won't fix with reason), **Verification evidence** (the command and the result, or a link to the test).

Severity uses the CVSS qualitative bands where a score exists: 9.0-10.0 critical, 7.0-8.9 high, 4.0-6.9 medium, 0.1-3.9 low. Raise a severity when the business impact is higher than the score suggests (a medium on the payment path). Lowering below the CVSS band needs a recorded reason, such as unreachable code, and is checked by a second look. Findings without a score (a missing index, a missing alert) take the severity that [quality-gates](quality-gates.md) defines.

## Implementation

**Stage by stage**

1. Stage 1: run the router and the environment audit; list the runtime, framework, host, database, auth provider, payment and mail providers, queues and scheduled jobs from the code and configuration, not from names. Record environment variable names only.
2. Stage 2: set the tier (rule 2) and the facts behind it; note the traffic expectation and what a day of downtime costs; start the data inventory ([privacy-and-compliance](privacy-and-compliance.md)).
3. Stage 3: plan the baseline for the tier; list every endpoint and table that will exist; note what the host provides.
4. Stage 5: build to the §2 defaults; add the tests for authorisation and for the critical journeys as the code is written, not after.
5. Stage 10: run `node scripts/baseline-check.mjs --project <dir> --tier <n>`; run the CI-equivalent locally (type check, lint, tests, audit, secret scan); fix root causes; re-run.
6. Stage 11: write the report from [the template](../templates/production-readiness-report.md), scaled to the tier (one page for T0 and T1), with every status backed by evidence.

**Existing project (Phase 0 recipe).** List the entry points (`app/`, `pages/api`, route files, `server.*`, functions folders, `vercel.json`, `netlify.toml`), the scheduled jobs and workers, the CI files, the Dockerfile and the infrastructure files; build the endpoint inventory table from [api-protection](api-protection.md); list tables from the migrations or the live schema (read-only); list third-party services from the dependencies and the environment variable names. Then run the baseline check and the dependency audit and sort the findings into the issue record. Change nothing until the inventory exists.

**Report lines**

```text
Tier: T2 (accounts, Postgres, Stripe, uploads) | raised from T1 by the user | host: Vercel + Supabase | load target: 40 req/s peak
Issue PR-007 | high | /api/orders/[id] | missing ownership check | fixed in 3f2a9c1 | regression test orders.authz.test.ts: 4 passed
Readiness: READY WITH ACCEPTED RISKS | rows 1-13 evidenced, row 9 at expected peak only (no 2x run: T2) | exception PR-011 owner: <name>, review 2027-01-15
```

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| The tier is argued down to avoid work | Record the facts that set it; if the facts say T2, the tier is T2 |
| A tool (scanner, load tool) is not installed | Mark that check NOT_TESTED, name the tool and the install command, and ask before a system-wide install; use the manual procedure in the owning module meanwhile |
| The host hides infrastructure (serverless) | Verify the host's documented guarantees; test behaviour (timeouts, concurrency, connections) instead of configuring what you cannot see |
| Production access is not available | Audit code and staging; label every production-only item NOT_TESTED with the reason |
| An audit finds hundreds of items | Sort by severity and exploitability; fix critical and high first; keep the rest in the register, never delete rows |
| A fix breaks behaviour | Revert it, write the failing test first, and make the smaller fix |
| Pressure to declare readiness | Print the checklist with its statuses; READY needs evidence in every applicable row |
| Legal question beyond engineering | State what the code does and recommend counsel; do not invent legal conclusions |

## Verification

- The tier and the facts behind it appear in the brief or the decision record and in the final report.
- Every applicable §4 row has evidence or a recorded reason; no row says passed without a command and a result.
- The baseline check ran on the project (or its absence is reported as NOT_TESTED with the reason) and its findings are in the issue register.
- No secret value appears in any report, log excerpt or screenshot.
- No security or load activity touched a system outside the authorised scope.
- Any "signed off" line names a human who gave that approval in chat.

## Sources

- The user's production-readiness master brief (phases 0-11 and execution rules), restructured into this hub and the specialist modules; the rules about evidence, no rebuilds and no fabricated results come from that brief.
- Standards paraphrased, no text copied: OWASP Top 10, OWASP API Security Top 10 (2023), OWASP ASVS, CWE Top 25, FIRST CVSS qualitative bands, web.dev Core Web Vitals, the twelve-factor app, and the SRE practice of SLOs and error budgets. Check the current edition of each standard when an audit cites it.
