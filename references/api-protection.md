# API protection

Every endpoint is a public interface, whether it is a REST route, a route handler, a Server Action, a serverless function, a GraphQL field, a webhook or a cron URL. This module is how to inventory them, how to check each one for authentication, authorisation, validation, limits and honest output, and how to design rate limits, error shapes, idempotency, webhook verification, API keys and versioning.

**Load when:** building or auditing route handlers, Server Actions, serverless or edge functions, REST, GraphQL or tRPC endpoints, webhooks, form posts, API keys, rate limiting, CORS or CSRF; the user mentions "API security", "endpoints", "rate limit", "webhook", "idempotent" or "pagination". **Owns:** the endpoint inventory, the per-endpoint checklist, validation and size limits, rate-limit classes, the error shape and status rules, pagination limits, idempotency keys, inbound and outbound webhook rules, API keys, output filtering, CORS and CSRF by endpoint class, GraphQL and RPC limits, versioning and deprecation, removal of obsolete endpoints, and the OWASP API Top 10 mapping.
**Related:** [production-readiness](production-readiness.md), [security-hardening](security-hardening.md), [security-and-privacy](security-and-privacy.md), [database-integrity](database-integrity.md), [backend-performance](backend-performance.md), [scalability-and-reliability](scalability-and-reliability.md), [observability-and-alerting](observability-and-alerting.md), [load-and-qa-testing](load-and-qa-testing.md), [frontend-architecture](frontend-architecture.md), [interaction-design](interaction-design.md), [test-driven-development](test-driven-development.md)

## Decision rules

1. **Inventory before anything else.** Every endpoint is a row in the §1 table: route files, `pages/api`, route handlers, `'use server'` actions, functions folders, cron and webhook URLs, admin and debug routes, GraphQL fields and WebSocket events. An endpoint missing from the inventory is a defect (a shadow endpoint). Generate the list from code, then review it by hand.
2. **Order of checks: limit, authenticate, authorise, validate, act, shape.** Reject oversized or over-rate requests cheaply first, then establish identity, then check permission on the specific record, then validate the input, then do the work, then return only allowed fields.
3. **Validate at the boundary with a strict schema** (Zod, Valibot, TypeBox or JSON Schema): types, ranges, lengths, formats and enums for path, query, headers, cookies and body; reject unknown keys; coerce on purpose, not by accident. Sensitive responses are checked against a response schema in tests.
4. **Bound everything.** Body size, upload size, page size, array length, string length, nesting depth, query complexity, request time and concurrent work per user all have limits ([§3](#3-rate-limit-classes) and the defaults below).
5. **Rate-limit by class,** with counters in a shared store, keyed by account where known and by client address otherwise. Behind a proxy take the client address from the trusted hop only; a spoofable `X-Forwarded-For` defeats the limit.
6. **One error shape, honest status codes, no internals.** Problem details (RFC 9457) with a request id; no stack traces, SQL, file paths or library versions; 401 means "who are you", 403 means "known and not allowed", 404 is used when revealing existence would leak data.
7. **Retries must be safe.** Operations that create money, orders, messages or accounts take an idempotency key ([§5](#5-idempotency-keys)); webhooks and queue handlers are idempotent by design.
8. **Webhooks are authenticated by signature, not by obscurity or IP alone:** raw body, timing-safe comparison, timestamp tolerance, event-id deduplication, fast acknowledgement, work done asynchronously ([§6](#6-webhooks)).
9. **Output goes through an allow-list** (a response shape per endpoint). Never return ORM rows. Password hashes, tokens, secrets, internal ids, other people's contact data and fields the caller may not see never leave the server.
10. **CORS and CSRF follow the endpoint class:** public read-only data may allow any origin without credentials; credentialed endpoints use an explicit origin list; cookie-authenticated state changes need `SameSite` plus an origin check or token ([security-hardening](security-hardening.md) §4).
11. **Private responses are never cacheable by shared caches:** `Cache-Control: private, no-store` (or `private` with a short max-age where safe) and `Vary` on anything that depends on the caller ([backend-performance](backend-performance.md)).
12. **Version deliberately.** Adding optional fields is not breaking; removing, renaming or changing meaning is. Breaking changes get a new version and a deprecation window with `Deprecation` and `Sunset` headers.
13. **Remove an obsolete endpoint only with proof it is unused:** access logs over a full business cycle (at least 30 days), a code search across the web app, mobile apps, jobs and partners, a period returning `410 Gone` with a log line, then deletion. Never delete on a guess.
14. **API keys are credentials:** generated randomly, shown once, stored hashed, identified by a visible prefix, scoped, expiring, individually rate-limited, revocable, with last-used time ([security-hardening](security-hardening.md) §6 for rotation).
15. **Server Actions, tRPC and GraphQL are endpoints too.** Apply the same rules. GraphQL adds depth and cost limits, batching limits, field-level authorisation, no unauthenticated introspection in production unless the schema is public by design, and batched loading to avoid N+1 ([backend-performance](backend-performance.md)). tRPC procedures are protected by default.
16. **Operational endpoints are minimal and private:** a health endpoint returns status only; metrics, debug and environment dumps are not routable from the internet.

## Specifications

### 1. Endpoint inventory

One row per endpoint, kept in the repository (`docs/endpoints.md` or generated from OpenAPI) and updated in the same change as the endpoint.

| Method and path | Caller | AuthN | AuthZ rule | Input schema | Output shape | Rate class | Size limit | Idempotent | Cache | Tests |
|---|---|---|---|---|---|---|---|---|---|---|
| `POST /api/contact` | anonymous | none | none; spam control | `ContactInput` | `{ ok }` | form | 10 KB | n/a | no-store | validation, rate limit |
| `GET /api/orders/:id` | user | session | owner of order | `OrderId` | `OrderView` | authed | none | yes | private | authz matrix |
| `POST /api/orders` | user | session | any user | `CreateOrder` | `OrderView` | authed | 20 KB | key required | no-store | duplicate key |
| `POST /api/webhooks/stripe` | provider | signature | n/a | provider event | `{ received }` | none (signature gate) | 1 MB | event id | no-store | bad signature, replay |
| `GET /api/health` | balancer | none | none | none | `{ status }` | monitor | none | yes | no-store | liveness |

Find them: list route files (`find . -path ./node_modules -prune -o -name 'route.*' -print`, `pages/api`, `functions/`), search for `'use server'`, `export async function (GET|POST|PUT|PATCH|DELETE)`, `app.(get|post|put|patch|delete)`, `router.`, and read `vercel.json` or `netlify.toml` for rewrites and cron entries.

### 2. Per-endpoint checklist

Mark each row PASS, FAIL, NOT_TESTED or NOT_APPLICABLE per endpoint.

1. Authentication required where the data is not public; token or cookie verified every request.
2. Authorisation checked against the specific record, tenant and action ([security-hardening](security-hardening.md) §3).
3. Input validated with a strict schema, including path, query and headers.
4. Request size and upload limits set.
5. Output shaped by an allow-list; sensitive fields absent.
6. Rate limit class applied; `429` with `Retry-After`.
7. Timeout on the handler and on every outbound call it makes.
8. List endpoints paginated with a maximum page size and an allow-list of sort and filter fields.
9. Unsafe retried operations accept an idempotency key.
10. Errors use the common shape; no internals leak.
11. CORS and CSRF match the endpoint class.
12. Cache headers correct for private versus public data.
13. Request id logged; no secrets or personal data in the log line.
14. Webhooks verify signature, timestamp and event id.
15. Negative tests exist: anonymous, other user, other tenant, low role, malformed body, oversized body, burst.
16. Documented owner, and a deprecation plan if it is being replaced.

### 3. Rate-limit classes

Starting values; tune them with real traffic and record the final numbers in the inventory.

| Class | Applies to | Starting limit | Key | On exceed |
|---|---|---|---|---|
| Credential attempts | login, OTP, magic-link request, password check | 5 per 15 minutes per account, 20 per 15 minutes per address | account and address | 429, progressive delay, security event |
| Message sending | password reset, invite, verification email, SMS | 3 per hour per recipient, 10 per hour per address | recipient and address | 429, generic response text |
| Signup | account creation | 5 per hour per address | address | 429 |
| Form | contact, waitlist, comment | 5 per hour per address plus a honeypot field | address | 429 or a silent drop for bots |
| Search and autocomplete | search endpoints | 30 per minute per user or address | user, else address | 429 |
| Authenticated API | ordinary reads and writes | 120 per minute per user | user | 429 |
| Anonymous read | public data | 60 per minute per address | address | 429 |
| Expensive | export, report, AI call, image processing | 5 per minute and a daily cap per user | user | 429, queue instead of inline |
| Upload | file upload | 10 per hour per user, size capped | user | 429 |

Implementation choices: platform firewall or rate rules (Vercel, Cloudflare), a shared counter store (Redis, Postgres, a managed limiter such as `@upstash/ratelimit`, or `rate-limiter-flexible`), never an in-memory counter on a multi-instance deployment (each instance counts alone). A managed limiter or CAPTCHA is a new external service: ask first ([SKILL.md §1](../SKILL.md)).

### 4. Status codes and error shape

| Situation | Status |
|---|---|
| Malformed or invalid input | 400 (or 422 for valid syntax, invalid meaning) |
| No or invalid credentials | 401 |
| Authenticated but not allowed | 403 |
| Not found, or hidden because the caller may not know it exists | 404 |
| Conflict, duplicate, version mismatch, idempotency key reused with a different body | 409 (or 422) |
| Body too large | 413 |
| Rate limited | 429 with `Retry-After` |
| Server fault | 500 with a request id and no detail |
| Dependency down or load shedding | 503 with `Retry-After` |

```json
{
  "type": "https://example.test/problems/validation",
  "title": "Invalid request",
  "status": 400,
  "detail": "email must be a valid address",
  "instance": "/api/contact",
  "requestId": "req_8f3a1c",
  "errors": [{ "field": "email", "message": "invalid format" }]
}
```

### 5. Idempotency keys

For `POST` operations a client may retry (payments, orders, signups): the client sends `Idempotency-Key: <uuid>`; the server stores the key with a hash of the request, the user and the response for 24 hours or more; a repeat with the same key and body returns the stored response without redoing the work; the same key with a different body returns 409 or 422; the unique constraint on (user, key) makes concurrent duplicates safe ([database-integrity](database-integrity.md)).

### 6. Webhooks

**Inbound.** Read the raw request body before any JSON parsing. Compute the HMAC (or use the provider's SDK verifier), compare with a timing-safe function, reject timestamps outside a tolerance (about five minutes), store the event id and ignore repeats, return 2xx quickly and process asynchronously through a queue, keep the secret per endpoint and rotate it by accepting two secrets during the changeover. Log signature failures as security events. Optionally allow-list the provider's published IP ranges as an extra layer, never as the only one.

**Outbound.** Sign payloads with a per-subscriber secret and a timestamp, send an event id, retry with exponential backoff and jitter up to a limit, disable endpoints that fail for days, and never send to private or metadata addresses ([security-hardening](security-hardening.md) SSRF row).

### 7. OWASP API Security Top 10 (2023) mapping

| Risk | Where it is handled |
|---|---|
| API1 Broken object-level authorisation | §2 item 2, [security-hardening](security-hardening.md) §3 |
| API2 Broken authentication | [security-hardening](security-hardening.md) §2, rule 14 |
| API3 Broken object property-level authorisation | Rules 3 and 9, mass-assignment row in [security-hardening](security-hardening.md) |
| API4 Unrestricted resource consumption | Rules 4 and 5, §3, timeouts |
| API5 Broken function-level authorisation | §2 item 2, matrix rows for low roles |
| API6 Unrestricted access to sensitive business flows | Rate classes, idempotency, per-flow limits and bot controls |
| API7 Server-side request forgery | [security-hardening](security-hardening.md) §4, §8 |
| API8 Security misconfiguration | Rules 10, 11 and 16, [security-hardening](security-hardening.md) §5 |
| API9 Improper inventory management | Rules 1, 12 and 13 |
| API10 Unsafe consumption of APIs | Validate and time-limit every upstream response; treat them as untrusted input |

## Implementation

**Route handler skeleton (Next.js App Router, TypeScript)**

```ts
import { z } from 'zod';

const Input = z.strictObject({ email: z.string().email().max(254), message: z.string().min(1).max(2000) });

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const limited = await limiter.check('form', clientAddress(request));      // shared store, see §3
  if (!limited.ok) return problem(429, 'Too many requests', requestId, { 'Retry-After': String(limited.retryAfter) });

  const raw = await request.text();
  if (raw.length > 10_000) return problem(413, 'Body too large', requestId);

  const parsed = Input.safeParse(safeJson(raw));
  if (!parsed.success) return problem(400, 'Invalid request', requestId, {}, parsed.error.issues);

  await sendContact(parsed.data);                                            // header-injection-safe mail call
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
```

`limiter`, `clientAddress`, `problem` and `safeJson` are project helpers: `clientAddress` reads the address from the trusted proxy hop only, `problem` builds the §4 body, `safeJson` returns `undefined` for invalid JSON.

**Webhook verification (generic HMAC provider, Node)**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export async function POST(request: Request) {
  const raw = await request.text();                                          // raw body, before any parsing
  const timestamp = request.headers.get('x-signature-timestamp') ?? '';
  const signature = request.headers.get('x-signature') ?? '';
  const fresh = Math.abs(Date.now() / 1000 - Number(timestamp)) < 300;
  const expected = createHmac('sha256', process.env.WEBHOOK_SECRET!).update(`${timestamp}.${raw}`).digest('hex');
  const ok = fresh && signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!ok) return new Response('invalid signature', { status: 400 });
  // dedupe by event id, enqueue, acknowledge
  return new Response('ok');
}
```

When a provider ships an SDK verifier (for example Stripe's `webhooks.constructEvent`), use it: it handles the scheme details for that provider.

**Idempotency table (Postgres)**

```sql
create table idempotency_keys (
  user_id uuid not null,
  key text not null,
  request_hash text not null,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
```

**Probing an endpoint locally (authorised target only)**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/orders/42                    # expect 401
curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: <user A session>" http://localhost:3000/api/orders/<B's id>   # expect 404 or 403
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" --data-binary @big.json http://localhost:3000/api/contact   # expect 413
```

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| The rate limiter counts per instance | Move counters to a shared store or the platform's rate rules; label the in-memory version dev-only |
| Every request appears to come from the proxy address | Configure the trusted proxy count and read the client address from the right hop |
| Raw body is unavailable for webhook verification | Disable the framework's body parser for that route and read the text body |
| A client breaks after a response change | Treat as breaking: revert, ship the additive form, version the rest |
| Idempotency key reused across users | Scope the key to the user; unique on (user, key) |
| Legacy endpoint cannot be proven unused | Keep it, add logging and `Deprecation` headers, review after a full business cycle |
| Validation rejects real traffic | Log rejected fields with the request id, widen the schema deliberately, never remove validation |
| GraphQL clients need introspection | Allow it in non-production, or authenticate it, and keep depth and cost limits on |
| CAPTCHA or managed limiter needed | It is an external service: name it, the data it sees and the cost, and ask first |

## Verification

- The inventory lists every endpoint the code and the host configuration expose, and a spot check found no endpoint outside it.
- Every row passes the §2 checklist or carries a recorded reason.
- Automated tests cover anonymous, other user, other tenant, low role, malformed, oversized and burst requests per endpoint class.
- Webhook tests cover a bad signature, a stale timestamp and a replayed event id.
- Responses were compared with their schemas; no sensitive field appears in any sample.
- Rate-limit and size-limit behaviour was observed (status codes and `Retry-After`), not assumed.

## Sources

- Paraphrased, no text copied: OWASP API Security Top 10 (2023) and its cheat sheets, RFC 9457 (problem details), the IETF idempotency-key draft and common provider practice, RFC 8594 (Sunset header) and the Deprecation header draft, and the documentation of the Stripe, GitHub and Next.js webhook and route-handler patterns. Rate-limit numbers are starting defaults, not standards.
- Structure and rules follow phase 6 of the user's production-readiness brief.
