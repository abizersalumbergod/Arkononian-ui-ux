# Security hardening

The application-security programme for sites and apps that have accounts, a database, an API, uploads, payments or an admin area: a threat model, authentication and authorisation, the attack classes and their fixes, transport and infrastructure settings, secrets and supply chain, files and data, AI features, and the record-fix-retest loop. [security-and-privacy](security-and-privacy.md) is the baseline every build already follows; this module is the deeper layer for T1 and above ([production-readiness](production-readiness.md)).

**Load when:** a build or audit has login, sessions, roles, a database, an API, uploads, payments, an admin area or a third-party integration; the user mentions security, pentest, OWASP, vulnerability, XSS, SQL injection, CSRF, SSRF, IDOR, JWT, MFA, a leaked key, a vulnerable dependency, or asks to review vibe-coded or AI-generated code. **Owns:** the threat model, authentication reference values, the authorisation test matrix, the attack-class table, transport and header settings, cloud and network exposure, secrets and dependency handling, file and data security, AI-feature security, and the remediation loop.
**Related:** [production-readiness](production-readiness.md), [security-and-privacy](security-and-privacy.md), [api-protection](api-protection.md), [database-integrity](database-integrity.md), [devsecops-and-deployment](devsecops-and-deployment.md), [observability-and-alerting](observability-and-alerting.md), [load-and-qa-testing](load-and-qa-testing.md), [privacy-and-compliance](privacy-and-compliance.md), [frontend-architecture](frontend-architecture.md), [quality-gates](quality-gates.md), [bug-diagnosis](bug-diagnosis.md), [test-driven-development](test-driven-development.md)

## Decision rules

1. **Authorised targets only.** Probe localhost, the user's own staging or preview host, or a host the user named as theirs ([production-readiness](production-readiness.md) rule 7). Never test a third-party system, and never run exploit payloads that destroy or exfiltrate real data.
2. **Threat-model first, then spend effort where the impact is.** Name the assets (money, personal data, credentials, admin power, tenant boundaries), the actors (anonymous visitor, user, other tenant, insider, bot, a compromised dependency), the entry points and the trust boundaries (§1). Test the highest-impact paths first.
3. **Standards are checklists, not goals.** Use the current OWASP Top 10, API Security Top 10, ASVS and CWE Top 25 as coverage lists. ASVS depth by tier: T1 the level-1 items that apply; T2 level 1 plus level-2 items for authentication, sessions, access control, payments and file handling; T3 level 2, with level 3 for the highest-risk parts. Say which edition was used.
4. **The server decides.** Identity, role, ownership, price, quantity, quotas, feature flags and state transitions are checked on the server on every request. Client checks are user experience only.
5. **Deny by default.** A new route, table, bucket or action is closed until a policy opens it. Allow-list fields, origins, redirect targets, file types and outbound hosts; never block-list.
6. **Prefer a managed identity provider** (Supabase Auth, Auth.js, Clerk, Auth0, Firebase Auth, WorkOS, Cognito) over hand-rolled authentication, and a vetted library over hand-rolled cryptography. If authentication is hand-rolled, §2 sets the minimum values.
7. **Authorisation is per record, not per route.** Having a valid session is not permission to read id 42. Check ownership or membership against the specific record, in the data-access layer, for reads, writes, lists, exports, files and cached values.
8. **Injection is prevented by construction:** parameterised queries or ORM binding, no shell strings, no `eval`, contextual output encoding, allow-list HTML sanitising, strict schemas that reject unknown keys.
9. **Treat all input and all output of other systems as untrusted:** request bodies, headers, query strings, cookies, uploaded files, webhook payloads, database content written by users, third-party API responses and model output.
10. **Secrets never travel to a browser or a log,** and a secret that was exposed is considered compromised until it is rotated. Rotation is the user's action (or approved by them): removing the string from the repository does not revoke it.
11. **Verify what you install.** Every new package is checked for exact name, publisher, age and repository before it is added; models invent package names and attackers register them.
12. **Security events are recorded** (failed and unusual logins, privilege changes, access-denied spikes, webhook signature failures) without recording secrets ([observability-and-alerting](observability-and-alerting.md)).
13. **Every fix has a regression test** that fails on the old code and passes on the new, and the original probe is re-run. A warning is never silenced, a severity never lowered and a check never disabled to look clean.
14. **Fix the root cause with the smallest reliable change.** Preserve behaviour and design. Do not rewrite a module to fix one handler.
15. **AI features get their own review** (§8): model output is untrusted input, secrets stay out of prompts, tools are least-privilege, spend is capped.

## Specifications

### 1. Threat model (one page, written before testing)

| Question | Answer format | Example |
|---|---|---|
| What are we protecting? | Assets ranked by impact | Card tokens and orders; customer emails; admin console; each customer's private files |
| Who attacks it? | Actors and capability | Anonymous scraper; logged-in customer probing other ids; a competitor tenant; a malicious dependency |
| Where can they reach it? | Entry points | `/api/*`, Server Actions, webhooks, upload, magic-link email, public storage bucket, admin subdomain |
| Where does trust change? | Boundaries | Browser to server; server to database; server to payment provider; tenant A to tenant B; user to admin |
| What goes wrong? | Abuse cases, each tied to a test | Read another user's order by id; replay a webhook; upload a script as an image; brute-force a code |

### 2. Authentication reference values

Minimums at the time of writing, from the OWASP cheat sheets; re-check when a standard changes.

| Item | Value |
|---|---|
| Password hash | Argon2id with at least 19 MiB memory, 2 iterations, parallelism 1 (or scrypt N=2^17, r=8, p=1; bcrypt cost 10 or more with its 72-byte input limit; PBKDF2-HMAC-SHA256 at 600,000 iterations where FIPS demands it); unique salt per password; optional server-side pepper in a secret store |
| Password rules | Length first (8 minimum with MFA, 15 without), allow long passphrases and paste, check against a breached-password list, no composition rules, no forced periodic change |
| Session cookie | `__Host-` name prefix, `Secure`, `HttpOnly`, `SameSite=Lax` (or `Strict`), `Path=/`, no `Domain`; random 128-bit-plus id from the CSPRNG; rotate on login and on privilege change; idle timeout and an absolute timeout; revoke on logout and password change |
| Access token (JWT) | Algorithm allow-list (reject `none` and algorithm switching), verify `iss`, `aud`, `exp`, `nbf`, `kid` rotation, lifetime of minutes, never in `localStorage` |
| Refresh token | Opaque, stored hashed, rotates on every use; reuse of an old token revokes the whole family; bound to device where possible |
| Reset and verification tokens | At least 128 random bits, stored hashed, single use, 15-60 minute expiry, identical response whether the account exists, rate-limited, existing sessions revoked after a reset; the link host comes from configuration, never the `Host` header |
| Throttles | Per account and per IP on login, reset, signup and code entry, with progressive delay rather than permanent lock-out; uniform error text and similar timing |
| MFA | Passkeys (WebAuthn) or TOTP; required for admin and money-moving roles from T2; hashed recovery codes; SMS only as a last resort |

### 3. Authorisation test matrix

Build the matrix from the endpoint inventory ([api-protection](api-protection.md)): rows are resources and actions, columns are the actors below. Each cell is an automated test with the expected status. Expect 401 for no session, 403 for a known resource the actor may not use, and 404 when revealing existence would leak data.

| Actor | Must be able to | Must not be able to |
|---|---|---|
| Anonymous | Public pages and public reads | Anything with a session, any write, any other user's data |
| User A | Their own records and files | User B's records by id, by list, by export, by file URL, by cached response |
| Tenant A member | Tenant A rows | Tenant B rows through any join, search, count, aggregate or webhook |
| Low role (viewer) | Read | Write, delete, invite, export, change billing |
| Admin of tenant A | Manage tenant A | Platform-level actions, tenant B |
| Disabled or deleted user, expired or revoked token | Nothing | Continue using an old session or token |

Also test: function-level access (a low role calling an admin route directly, BFLA), property-level access (writing `role` or `isAdmin` in a body, reading `passwordHash` in a response, BOPLA), and workflow abuse (skipping a payment step, reusing a coupon, replaying a one-time link).

### 4. Attack classes: what to look for, what fixes it

| Class | Looks like in code | Fix | Test |
|---|---|---|---|
| Cross-site scripting | `dangerouslySetInnerHTML`, `innerHTML`, unescaped template output, `javascript:` URLs, reflected params | Render as text, allow-list sanitiser at the call site, URL scheme allow-list, CSP ([security-and-privacy](security-and-privacy.md)) | Payloads in every field; assert the page treats them as text |
| SQL injection | String-built queries (a template literal with `${...}` inside a query call), raw `ORDER BY` from input | Parameters or ORM binding; allow-list sort columns | `' OR 1=1--` style input returns validation error or no extra rows |
| NoSQL injection | Request body object passed straight into a filter (`{"$ne": null}`) | Validate types with a strict schema; cast to string or number | Operator objects in login and filters are rejected |
| CSRF | Cookie-authenticated POST with no origin check | `SameSite=Lax`, verify `Origin` or a CSRF token on state-changing requests, no state change on GET | Cross-origin form post is refused |
| SSRF | Server fetches a user-supplied URL (image import, webhook test, link preview) | Allow-list hosts; resolve DNS and reject private, loopback, link-local and metadata addresses; no automatic redirects; connect to the checked IP | Requests to `http://127.0.0.1`, `http://169.254.169.254` and a redirecting URL are refused |
| Command injection | `exec`, `execSync`, `spawn` with `shell: true` and user text | `execFile` with an argument array; allow-listed values; avoid shelling out | Metacharacters (`;`, `&&`, backticks) stay literal |
| Path traversal and zip slip | File name or path from input joined to a base path; archive extraction | Resolve the final path and require it to start with the base directory; store by generated id; reject `..`, absolute paths and null bytes | `../../etc/passwd`, encoded variants, archive entries with `..` |
| Deserialization | `pickle.loads`, native Java serialization, `node-serialize`, unsafe YAML load on untrusted data | Use JSON with a schema | Crafted payload is rejected before parsing |
| Template injection | User text compiled as a template | Pass data as variables, never as template source | `{{7*7}}` renders literally |
| Open redirect | `redirect(searchParams.get('next'))` | Allow-list of relative paths or hosts | `next=https://evil.test` is refused |
| Mass assignment | `Model.create(req.body)`, `{...body}` into an update | Pick fields from a schema; never accept `role`, `id`, `tenantId`, `price` from the client | Extra fields are rejected or ignored |
| IDOR and BOLA | `findById(params.id)` with no owner condition | Owner or tenant in the query (`where id = $1 and owner_id = $2`) or row-level security | User A requests user B's id: 404 or 403 |
| Race conditions | Check-then-write on balance, stock, coupon, invite or username | One atomic statement, unique constraint, row lock, or idempotency key ([database-integrity](database-integrity.md)) | 20 parallel requests end with exactly one success |
| Prototype pollution | Deep merge of user objects, `obj[key] = value` with user keys | Reject `__proto__`, `constructor`, `prototype`; use `Map` or `Object.create(null)`; strict schema | `{"__proto__": {"admin": true}}` has no effect |
| ReDoS | Nested quantifiers on user input | Simpler patterns, input length caps, a linear-time regex engine | A 50,000-character adversarial string returns quickly |
| Clickjacking | Page can be framed | CSP `frame-ancestors 'none'` (plus `X-Frame-Options: DENY` for old browsers) | Framing from another origin fails |
| CORS misconfiguration | `*`, reflected `Origin`, `credentials: true` with a loose list | Explicit origin allow-list, `Vary: Origin` | Foreign `Origin` gets no `Access-Control-Allow-Origin` |
| Host header injection | Reset or invite links built from `Host` | Build links from configured base URL | Forged `Host` does not change the emailed link |
| Request smuggling | Front end and back end disagree on message length | Same HTTP stack end to end, reject ambiguous requests, keep proxies patched | Provider or scanner check; mark NOT_TESTED if the proxy is the host's |
| Dangling DNS and subdomain takeover | CNAME to a deleted service | Remove stale records; inventory DNS | DNS review |
| Email header injection | User text in `To`, `Subject` or headers | Reject newlines; use the mail library's structured fields | `\r\nBcc:` in a field is rejected |
| XML external entities | XML parsing of uploads or webhooks | Disable DTD and external entities | Entity payload returns an error |

### 5. Transport, headers, network and cloud exposure

| Item | Setting |
|---|---|
| TLS | TLS 1.2 minimum, 1.3 preferred; automatic certificate renewal; HTTP redirects to HTTPS; no mixed content |
| HSTS | `Strict-Transport-Security: max-age=31536000; includeSubDomains` once every subdomain is HTTPS; add `preload` only as a deliberate, hard-to-reverse choice |
| Content type | `X-Content-Type-Options: nosniff` |
| Referrer | `Referrer-Policy: strict-origin-when-cross-origin` (stricter if URLs carry tokens) |
| Permissions | `Permissions-Policy` denying features the site does not use (camera, microphone, geolocation, payment unless used) |
| Framing | CSP `frame-ancestors` |
| Isolation | `Cross-Origin-Opener-Policy: same-origin` where no popup flow needs the opener (OAuth popups do); COEP only when cross-origin isolation is required |
| CSP | Owned by [security-and-privacy](security-and-privacy.md) §2; report-only first on an existing site |
| Cookies | See §2; never `SameSite=None` without a stated cross-site need |
| CORS | Explicit allow-list; no wildcard on authenticated routes; preflight caching `Access-Control-Max-Age` modest |
| Network | Database and cache on private networking or IP allow-lists, never open to the internet; admin tools behind SSO and IP or VPN restrictions; default credentials removed; debug and metrics endpoints not public; directory listing off |
| Cloud metadata | Require IMDSv2 on AWS; deny application egress to `169.254.169.254` and its equivalents; least-privilege roles instead of long-lived keys on the instance |
| Errors | Generic error pages; stack traces only in server logs |

### 6. Secrets, dependencies and supply chain

- **Find:** scan the working tree and the full history (`gitleaks`, `trufflehog`); add the scanner to CI and, if the user wants, a pre-commit hook ([repo-guardrails](repo-guardrails.md)). Run `node scripts/baseline-check.mjs` for the web-specific cases. Report file, line and pattern, never the value.
- **Contain:** `.env*` in `.gitignore`, a committed `.env.example` of placeholders, secrets only in the host's secret store, separate values per environment, least-privilege scopes, spend caps on metered keys.
- **Rotate:** when a secret is exposed (committed, logged, shipped to a browser, pasted into a chat), tell the user which one by name and where, ask them to revoke and reissue it at the provider, deploy the new value, and then remove the old one from code and history if the user approves a history rewrite. Do the provider steps only with their approval.
- **Dependencies:** commit the lockfile; install with `npm ci` (or the package manager's frozen equivalent); `npm audit --omit=dev --audit-level=high` and `osv-scanner` in CI; `npm audit signatures` where the registry supports it; automated update pull requests reviewed, not auto-merged; pin GitHub Actions to commit SHAs.
- **Before adding a package:** exact name spelled from the registry page (not from memory or a chat), publisher and repository match the project's own docs, age and download history are plausible, no install scripts you do not understand (try `--ignore-scripts` first), licence compatible, and it is not a look-alike of a popular name. Prefer fewer, well-maintained packages ([frontend-architecture](frontend-architecture.md) dependency policy).
- **Abandoned or malicious:** flag packages with no release for two years plus open advisories, deprecated notices, or maintainer changes right before a suspicious release; replace or vendor with review.
- **SBOM:** generate a CycloneDX or SPDX file in CI (`@cyclonedx/cyclonedx-npm`, `syft`) and attach it to the release; it is evidence, not a fix.

### 7. Files and data

| Concern | Rule |
|---|---|
| Upload checks | Size cap enforced at the edge and the server; extension and MIME allow-list; confirm the file signature (magic bytes) matches; re-encode images (drops polyglots and location metadata); never trust the client MIME type or file name |
| Active content | Treat SVG, HTML, PDF and Office files as active; serve them as downloads with `Content-Disposition: attachment` and `nosniff`, or from a separate cookieless domain |
| Storage | Private bucket by default, generated object keys that include the tenant, short-lived signed URLs issued only after an ownership check, no public listing, no execution permission |
| Scanning | Scan with an antivirus engine (for example ClamAV) when files are shared with other people |
| Encryption | TLS in transit; encryption at rest verified as enabled on the database, object storage and backups; field-level or envelope encryption through the provider's key service for the most sensitive fields; never home-made crypto |
| Minimisation | Collect, store and log only what a feature needs; mask in the UI; pseudonymous ids in logs |
| Deletion and retention | A written retention period per data class, a deletion job that covers the database, object storage, search index, caches and processors, and a check that deletion really removed the data ([privacy-and-compliance](privacy-and-compliance.md)) |
| Downloads | Authorise each download against the record, not the URL |

### 8. AI features (when the site calls a model)

Treat model output as untrusted input: never write it into `innerHTML`, a shell, a query or a file path without the same handling as user text. Keep secrets and other users' data out of prompts and out of the model's tool scope. Give tools the least privilege and require confirmation for any tool that sends, spends or deletes. Rate-limit and cap spend per user and in total (denial of wallet is an attack). Assume retrieved documents and web pages can carry instructions aimed at the model; separate them from instructions and never let them grant permissions. Log prompts and outputs only under the privacy rules. The OWASP Top 10 for LLM applications is the coverage list.

### 9. Severity and remediation record

Use the issue record and severity bands in [production-readiness](production-readiness.md) §5. For each vulnerability: component, CVSS vector where it applies, how it is exploited (the minimal reproduction), business impact, root cause, the fix commit, the regression test name, the re-run result.

## Implementation

**Ownership check in the data layer (TypeScript, any framework)**

```ts
// The query itself carries the owner; a missing row means "not yours" and "does not exist" alike.
export async function getOrderForUser(db: Db, userId: string, orderId: string) {
  const order = await db.orders.findFirst({ where: { id: orderId, ownerId: userId } });
  if (!order) throw new NotFoundError();
  return order;
}
```

**Argon2id hashing (`argon2` package)**

```ts
import argon2 from 'argon2';
const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
const ok = await argon2.verify(hash, candidate);
```

**SSRF-safe fetch sketch (Node 18+)**

```ts
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const PRIVATE = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./, /^::1$/, /^f[cd]/i, /^fe80:/i];
const isPrivate = (ip: string) => PRIVATE.some((re) => re.test(ip));

export async function safeFetch(rawUrl: string, allowedHosts: Set<string>) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) throw new Error('host not allowed');
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
  if (addresses.some((a) => isPrivate(a.address))) throw new Error('private address');
  return fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
}
```

This sketch is a starting point: for a hostile target also pin the connection to the checked address (a custom agent or a dispatcher), because DNS can change between the check and the request.

**Security headers (Next.js `next.config.js`)**

```js
const headers = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];
module.exports = { async headers() { return [{ source: '/:path*', headers }]; } };
```

Add the CSP header from [security-and-privacy](security-and-privacy.md) §2 or §5 (nonce-based). Verify with `curl -sI <url>` on the preview host.

**Scanner commands (local, read-only; check each is installed first)**

```bash
gitleaks detect --redact            # history and tree; newer releases: gitleaks git --redact, gitleaks dir --redact
osv-scanner scan source -r .        # older releases: osv-scanner -r .
npm audit --omit=dev --audit-level=high
npm audit signatures
semgrep scan --config p/owasp-top-ten --metrics=off .
trivy fs --scanners vuln,secret,misconfig .
```

A missing scanner is a NOT_TESTED line with the install command, never a pass. Installing one system-wide needs approval ([SKILL.md §1](../SKILL.md)).

**Remediation loop**

1. Reproduce and record the finding (issue record).
2. Write the failing test (`test-first`, [test-driven-development](test-driven-development.md)).
3. Make the smallest root-cause change.
4. Run the new test, the neighbouring tests, type check and lint.
5. Re-run the original probe or scanner and attach the output.
6. Update the issue status; if the finding stays open, record it as an accepted risk with an owner and a review date.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| Authentication is only in middleware or a layout | Add the check in the data-access layer; middleware bypasses and misconfigured matchers exist, so treat middleware as an early filter, not the control |
| Row-level security is on but a policy is `using (true)` | Rewrite the policy to the owner or tenant condition; test as two users |
| A view or function bypasses row-level security | Make it `security_invoker` (or equivalent) and re-test |
| A secret was committed | Report by name and place; the user revokes and reissues; then remove from code (and history if approved) |
| A scanner floods the report with low-value findings | Triage by reachability and severity; keep the list, fix critical and high first, record accepted ones with reasons |
| A dependency has a vulnerability with no fixed release | Check reachability; upgrade, replace, patch or isolate; record the exception with an owner and review date |
| Hand-rolled authentication is already in place | Do not rewrite; apply §2 values, add the §3 matrix tests, and propose a managed provider as a later change |
| The host fronts TLS and headers | Set headers in the framework config or the host's header file and verify with `curl -sI` on the deployed preview |
| Third-party scripts cannot satisfy the CSP | Remove the script, self-host it, or use nonces or hashes; never add `unsafe-eval` |
| No staging environment exists | Test on localhost with seeded fake data; mark production-only checks NOT_TESTED |

## Verification

- A threat model exists and each abuse case maps to a test or a recorded risk.
- The §3 matrix is automated and green, with the negative cases (other user, other tenant, low role, revoked token).
- The §4 classes were each checked or marked NOT_APPLICABLE with the reason (for example no XML parsing).
- `curl -sI` on the preview host shows the §5 headers; cookies carry the §2 attributes.
- Secret scan of tree and history ran; the built output was searched for key patterns; no value appears in any report.
- Dependency audit and signature check ran with their output recorded; every new package was verified by name and publisher.
- Every fixed vulnerability has a regression test that fails on the old code, and its re-run result is recorded.
- Open findings are in the register with severity, owner and review date; none was downgraded or suppressed to pass.

## Sources

- Paraphrased, no text copied: OWASP Top 10, OWASP API Security Top 10 (2023), OWASP ASVS, OWASP cheat sheets (password storage, session management, JWT, CSRF, SSRF, file upload, secrets management, deserialization, injection prevention), OWASP Top 10 for LLM applications, CWE Top 25, the FIRST CVSS specification, and the npm and Node security documentation. The ASVS levels and password values are current as of this build; re-check the editions when auditing.
- Structure and rules follow the user's production-readiness brief (phase 1 security audit and remediation).
