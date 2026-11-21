# Observability and alerting

Knowing what the system is doing and being told when users are hurt: structured logs without secrets or personal data, metrics that describe rate, errors, duration and saturation, traces across services, error tracking, real-user performance data, uptime checks, security events, objectives and alerts that point at a runbook. The aim is detection and diagnosis before a user has to report a problem.

**Load when:** a T1 or higher build is planned or audited, logging, metrics, tracing, Sentry, OpenTelemetry, Prometheus, Grafana, uptime checks or alerts are discussed, an incident or silent failure needs diagnosis, Gate E field data is wanted, or the user asks "how will we know when it breaks". **Owns:** the log schema and redaction list, metric sets, tracing rules, error-tracking configuration, real-user monitoring, synthetic checks, security-event list, SLOs and burn-rate alerts, the alert catalogue with severities, dashboards, and the privacy limits on all telemetry.
**Related:** [production-readiness](production-readiness.md), [security-hardening](security-hardening.md), [backend-performance](backend-performance.md), [scalability-and-reliability](scalability-and-reliability.md), [devsecops-and-deployment](devsecops-and-deployment.md), [privacy-and-compliance](privacy-and-compliance.md), [load-and-qa-testing](load-and-qa-testing.md), [performance](performance.md), [measurement-and-tracking](measurement-and-tracking.md), [api-protection](api-protection.md), [security-and-privacy](security-and-privacy.md)

## Decision rules

1. **Scale telemetry to the tier.** T0: an uptime check and the host's logs. T1: add error tracking and structured server logs. T2: add metrics, dashboards, alerts with a tested path, and traces for multi-service flows. T3: add objectives with burn-rate alerts and an on-call rota. Do not stand up a monitoring stack for a brochure site.
2. **Prefer the host's and a managed tool's built-ins** (platform logs, Sentry, an uptime service) to self-hosting Prometheus and Grafana, unless the user wants self-hosting or the system already runs it. A new external monitoring service is a third party that receives data: name it and ask first ([SKILL.md §1](../SKILL.md)).
3. **Logs are structured events,** one JSON object per line with a timestamp, level, message, request id, trace id, route, status, duration and a pseudonymous user id. The request id is created at the edge and passed through every call, queue message and log line.
4. **Never log secrets or unnecessary personal data.** Redact by key name and by pattern before the log leaves the process (§1). Do not log request or response bodies by default, authorisation headers, cookies, tokens, passwords, one-time codes, card data, health data or full IP addresses unless a stated purpose and retention exist. Strip control characters from user-controlled strings to prevent log forging.
5. **Measure what users feel.** For services: rate, errors and duration per route (RED) and saturation of resources (CPU, memory, event loop, connections, queue depth) (USE). Report latency as percentiles. Keep metric labels low-cardinality: route templates and status classes, never user ids, URLs with ids, or free text.
6. **Trace across boundaries** with W3C trace context propagated through HTTP and queue messages; sample to control cost (full for errors and slow requests, a percentage for the rest). OpenTelemetry is the default instrumentation standard.
7. **Error tracking scrubs before sending.** Configure the SDK with default personal-data collection off, a scrubbing hook for headers, cookies and bodies, release and environment tags, spike protection, and source maps uploaded to the tracker and not served publicly ([security-and-privacy](security-and-privacy.md) rule 18).
8. **Alert on symptoms users feel, not on every cause.** Page for: the site or a critical journey is down, error rate or latency breaches the objective, the objective's error budget is burning fast. Ticket for: capacity trending toward a limit, certificate expiry, dependency age. Every alert names an owner, a severity and a runbook link, and fires only when someone must act.
9. **An alert that was never fired is not tested.** Force a failure in staging (or a synthetic one) and confirm the notification reaches a real channel and a human; record the evidence.
10. **Measure real users too.** Collect Core Web Vitals field data (LCP, INP, CLS, with attribution) for Gate E ([performance](performance.md)); sample, avoid personal data, and respect consent rules for analytics where they apply ([privacy-and-compliance](privacy-and-compliance.md)).
11. **Watch for abuse and compromise:** failed and anomalous logins, password-reset volume, privilege and role changes, access-denied spikes, webhook signature failures, unusual download or export volume, new API keys. Keep an audit log of administrative actions, append-only and separate from application logs.
12. **Telemetry has retention and access rules.** Define retention per data class, restrict who can read logs and traces, and make deletion requests reach telemetry stores where they hold personal data.
13. **Cost is a design input.** Sample traces, cap log volume and level in production, set retention, and alert on telemetry spend; debug-level logging is off by default.
14. **Health and status are visible:** liveness and readiness ([scalability-and-reliability](scalability-and-reliability.md)), a public status page only if the user wants one, and dashboards for the golden signals plus the business journey.

## Specifications

### 1. Log schema and redaction

```json
{"ts":"2026-11-12T09:15:04.221Z","level":"warn","msg":"payment declined","requestId":"req_8f3a1c","traceId":"4bf92f3577b34da6a3ce929d0e0e4736","route":"POST /api/checkout","status":402,"durationMs":412,"userId":"u_5c21","tenant":"t_9"}
```

Redact keys matching (case-insensitive) `authorization`, `cookie`, `set-cookie`, `password`, `passwd`, `secret`, `token`, `api[-_]?key`, `session`, `otp`, `code`, `card`, `cvv`, `ssn`, `iban`; and values matching known secret patterns (the same patterns as `scripts/lib/fsutil.mjs`). Prefer an allow-list of fields per event over a deny-list of keys where practical.

### 2. Signals

| Signal | Examples | Notes |
|---|---|---|
| Rate | Requests per second per route | Detects traffic drops as well as spikes |
| Errors | 5xx rate, 4xx rate by class, unhandled exceptions, failed jobs | Separate client errors from server errors |
| Duration | p50, p95, p99 per route; database query time; upstream call time | Percentiles, not averages |
| Saturation | CPU, memory, event-loop delay, connection pool use, queue depth and age | Leads capacity alerts |
| Database | Slow queries, lock waits, connections in use, replication lag, disk | Provider dashboards count |
| Cache | Hit ratio, evictions, latency, errors | A falling hit ratio explains a database spike |
| Queue and workers | Depth, oldest-message age, processing time, retries, dead letters | Alert on age, not depth alone |
| Business | Signups, checkouts, payments succeeded and failed | A flat line is an incident even when 5xx is zero |
| Security | See rule 11 | Route to a separate channel |
| Frontend | Web Vitals by page and device, JS error rate | Field data for Gate E |

### 3. Objectives and burn-rate alerts

Define an availability SLO and a latency SLO per critical journey, for example 99.5 percent of checkout requests succeed and 95 percent finish under 800 ms over 28 days. The error budget is the allowed failure. Alert on how fast it is spent: a fast burn (about fourteen times the normal rate over one hour) and a moderate burn (about six times over six hours) page; a slow burn (about the normal rate over three days) opens a ticket. Use multi-window rules so a brief blip does not page.

### 4. Alert catalogue

| Alert | Severity | Condition (starting values) | First action |
|---|---|---|---|
| Site or critical journey down | Page | Synthetic check fails from two locations for 2 minutes | Check deploy, host status, rollback |
| Elevated 5xx | Page | 5xx above 2 percent of requests for 5 minutes | Find the route and the last change |
| Latency | Page or ticket | p95 above the objective for 10 minutes | Dashboards, traces, recent deploy |
| Database connections near limit | Page | In use above 85 percent for 5 minutes | Pool settings, leaked connections, slow queries |
| High CPU or memory | Ticket (page if sustained and rising) | Above 85 percent for 15 minutes | Scale, profile, leak check |
| Queue backlog | Page | Oldest message age above its objective | Workers, poison message, dead letters |
| Dead-letter queue not empty | Ticket | Any message | Inspect and replay |
| Failed deploy | Ticket | Pipeline or readiness failure | Read the log, roll back if live |
| Certificate or domain expiry | Ticket | 21 days before | Renew |
| Suspicious authentication | Security channel | Many failures or a new region for one account, reset floods | Review, throttle, notify the user |
| Webhook signature failures | Security channel | Any sustained rate | Check secret rotation, possible forgery |
| Telemetry or spend anomaly | Ticket | Log volume or cost above the cap | Find the noisy source |

### 5. Dashboards

One overview (traffic, errors, latency percentiles, saturation, queue age, business journey), one per critical dependency (database, cache, queue, payment provider), one for security events, one release view that overlays deploys on the other charts.

## Implementation

**Redacting logger (Node, `pino`)**

```ts
import pino from 'pino';
export const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', '*.password', '*.token', '*.apiKey', '*.otp'], censor: '[redacted]' },
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

**Error tracker scrubbing (Sentry, JavaScript)**

```ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.APP_ENV,
  release: process.env.RELEASE,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.request) { delete event.request.cookies; delete event.request.data; if (event.request.headers) { delete event.request.headers.authorization; delete event.request.headers.cookie; } }
    return event;
  },
});
```

The DSN is a project identifier, not a high-value secret, but keep it in configuration; server-side tokens (auth tokens for source-map upload) stay in CI only.

**Real-user Web Vitals (browser, `web-vitals` library)**

```ts
import { onLCP, onINP, onCLS } from 'web-vitals/attribution';
const send = (m) => navigator.sendBeacon('/api/vitals', JSON.stringify({ name: m.name, value: m.value, id: m.id, page: location.pathname, rating: m.rating }));
onLCP(send); onINP(send); onCLS(send);
```

The `/api/vitals` endpoint is itself an endpoint: rate-limited, size-limited and free of personal data ([api-protection](api-protection.md)).

**Minimal uptime check**

```bash
curl -fsS --max-time 10 https://www.example.test/api/health | grep -q '"status":"ok"' || echo "DOWN"
```

Run it from a scheduler or a monitoring service, from at least two locations, and also check one real journey (a synthetic login or page render), not only the health route.

**Testing an alert (staging)**

1. Deploy a build that returns 500 on a test route, or stop a dependency on staging.
2. Generate traffic until the condition holds for its window.
3. Confirm the notification arrives in the real channel with the runbook link; record the time from fault to alert.
4. Restore and confirm the alert resolves.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| A secret appears in logs | User rotates it; add the key to the redaction list; delete or purge the affected log segment; add a test that logs a fake secret and expects redaction |
| Alert fatigue | Remove alerts nobody acts on, move cause-based alerts to dashboards, keep symptom-based pages |
| Telemetry bill spikes | Lower log level, sample traces, shorten retention, drop high-cardinality labels |
| High-cardinality metrics crash the store | Replace ids with route templates and status classes |
| No place to send alerts | Use the user's existing channel (email, chat) after they approve the integration; until then report alerts as NOT_TESTED |
| Source maps leak through the tracker setup | Upload them to the tracker, remove them from the deployed output, verify with a request for the `.map` URL |
| Consent is required for RUM or analytics | Load it only after consent, or use aggregate, non-identifying measurement; see [privacy-and-compliance](privacy-and-compliance.md) |
| Self-hosted stack is unsupported by the host | Use a managed service (with approval) or the host's built-ins |
| No staging to test alerts | Use a synthetic condition on a non-production route; mark production alert paths NOT_TESTED |

## Verification

- A log sample from the real app shows the §1 fields and no secret or unnecessary personal data; a redaction test exists.
- An uptime check, an error tracker and the chosen alerts exist for the tier, each with an owner and a runbook link.
- At least one alert was forced and delivered to a real channel, with the time recorded.
- Objectives and burn-rate rules exist for T3, or are NOT_APPLICABLE with the reason.
- Field Web Vitals data is collected or Gate E field data is marked NOT_TESTED.
- Retention, access control and the third parties receiving telemetry are written down.

## Sources

- Paraphrased, no text copied: OpenTelemetry and W3C Trace Context specifications, the RED and USE methods, the Google SRE workbook on SLOs and multiwindow burn-rate alerting, Sentry and pino documentation, web-vitals library documentation, and the OWASP logging and security-event guidance.
- Structure and rules follow phase 8 of the user's production-readiness brief.
