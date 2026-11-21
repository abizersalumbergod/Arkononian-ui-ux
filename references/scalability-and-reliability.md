# Scalability and reliability

How a site or app keeps working as traffic grows and when parts fail: choosing what to build given the hosting model, stateless instances, load balancing and health checks, graceful shutdown and draining, autoscaling with cost limits, background jobs and schedulers, fault-tolerance patterns, failover, safe deploys under traffic, and recovery targets. Everything here is conditional on a measured or stated need ([production-readiness](production-readiness.md) rule 3).

**Load when:** the user mentions scaling, load balancing, autoscaling, traffic spikes, queues, workers, retries, circuit breakers, failover, high availability, graceful shutdown, health checks, "what if X goes down" or recovery objectives; a T2 or T3 build is planned; a load test failed; a deploy caused errors under traffic. **Owns:** the hosting-model decision, statelessness rules, load-balancing strategy choice, health-check contract, graceful shutdown and connection draining, autoscaling policy and cost guardrails, background-job and scheduler design, fault-tolerance patterns, the failure-scenario matrix, failover rules, safe-deploy rules and RTO and RPO targets.
**Related:** [production-readiness](production-readiness.md), [backend-performance](backend-performance.md), [database-integrity](database-integrity.md), [api-protection](api-protection.md), [devsecops-and-deployment](devsecops-and-deployment.md), [observability-and-alerting](observability-and-alerting.md), [load-and-qa-testing](load-and-qa-testing.md), [frontend-architecture](frontend-architecture.md), [security-hardening](security-hardening.md), [troubleshooting](troubleshooting.md), [delivery-orchestration](delivery-orchestration.md)

## Decision rules

1. **Start from the hosting model and build only what it does not give you.** Managed serverless, edge and platform hosts already balance requests, terminate TLS, scale and restart instances; your work there is database connections, function timeouts and concurrency, cost caps, cold starts and idempotency. Containers or virtual machines need you to provide balancing, health checks and scaling. A single server starts with vertical scaling, backups and a restore plan. Write down what the host provides (§1).
2. **Instances are disposable and stateless.** No sessions, uploads or counters in memory or on local disk as the source of truth; configuration from the environment; any instance can be killed at any moment without losing user data.
3. **Shared state is external:** sessions (signed cookie, database or Redis), caches, rate-limit counters, locks (with a TTL and a fencing token), WebSocket fan-out (pub/sub), uploaded files (object storage). Scheduled work runs once, not once per instance.
4. **Health checks have a contract (§3).** Liveness answers "is the process responsive" and never checks dependencies (a database blip must not restart every instance). Readiness answers "can this instance serve now" and fails during startup and shutdown. Both are cheap, unauthenticated and return minimal information.
5. **Pick the balancing strategy from the workload (§2),** not by default. Avoid sticky sessions as a crutch; where affinity is truly needed (WebSockets, long polling), keep state recoverable.
6. **Timeouts are layered:** client shorter than load balancer shorter than server shorter than upstream. The server's keep-alive timeout is longer than the balancer's idle timeout, or a race produces intermittent 502 errors.
7. **Shut down gracefully.** On `SIGTERM`: fail readiness, stop accepting new connections, finish in-flight requests within a bound, close pools, flush logs, exit before the platform's kill. The balancer's deregistration (connection draining) delay is at least the longest normal request. Workers finish or requeue the job they hold.
8. **Autoscale on the metric that tracks the bottleneck (§5):** CPU for CPU-bound work, requests per target or latency for I/O-bound work, queue depth and oldest-message age for workers. Scale out quickly, scale in slowly, set a minimum for availability and a maximum for cost, and never scale out against a saturated database: more instances make it worse.
9. **Cost is a constraint.** Set maximum replicas and concurrency, budget alerts and spend caps on metered services. Provisioning paid infrastructure needs the user's approval ([SKILL.md §1](../SKILL.md)).
10. **Move slow or unreliable work to a durable queue (§6).** Handlers are idempotent because delivery is at least once; retries use exponential backoff with jitter and a maximum; failures land in a dead-letter queue that alerts and can be replayed; every job has a timeout and a unique key to prevent duplicates.
11. **Scheduled jobs have exactly one runner,** an overlap guard, a timeout, idempotent effects and an alert when a run is missed or fails.
12. **Assume dependencies fail.** Timeouts on every call; bounded retries only for safe or idempotent operations and only within a retry budget; a circuit breaker per dependency; separate resource pools (bulkheads) for critical and non-critical work; load shedding with `503` and `Retry-After` when saturated; graceful degradation (stale cache, disabled non-critical features, queued writes) instead of an error page.
13. **Failover only when the recovery objective needs it.** Multi-zone databases and health-based failover come before multi-region; multi-region is a stated requirement, not a default. Any failover that has never been exercised is NOT_TESTED.
14. **Deploy safely under traffic:** rolling, blue-green or canary releases gated by readiness, database changes that stay compatible with the previous version ([database-integrity](database-integrity.md) §3), feature flags for risky changes, and a rollback that was practised ([devsecops-and-deployment](devsecops-and-deployment.md)).
15. **Set recovery objectives from business cost** (§8), write them in the disaster-recovery plan, and measure them in drills, not in theory.
16. **Prove it with failure tests:** kill an instance during load, flush the cache, slow a dependency, fail over the database, back up the queue ([load-and-qa-testing](load-and-qa-testing.md)). Record what happened; do not claim resilience that was not exercised.

## Specifications

### 1. Hosting models: what the platform provides

| Model | The platform gives | You still own |
|---|---|---|
| Serverless and edge (Vercel, Netlify, Cloudflare, Lambda) | Request routing, TLS, CDN, automatic scale-out, instance replacement | Database connection limits (use a pooler), function timeout and memory, concurrency and spend caps, cold starts, idempotent handlers, queues for long work |
| PaaS containers (Render, Fly, Railway, App Service, Cloud Run) | Balancer, health-checked rollout, restart, optional autoscale | Probes that mean something, graceful shutdown, min and max instances, external state, migrations |
| Orchestrated containers (Kubernetes, ECS) | Scheduling, rolling updates, probes, horizontal autoscaling when configured | Probes, resource requests and limits, disruption budgets, autoscaler policy, ingress timeouts, cost |
| Single server or virtual machine | Nothing automatic | Process supervision, reverse proxy, backups, restore plan, patching, vertical scaling; add a second instance and a balancer only when needed |

### 2. Balancing strategy by workload

| Workload | Strategy | Note |
|---|---|---|
| Uniform short requests | Round robin | Simple and fair |
| Variable durations (reports, uploads, AI calls) | Least outstanding requests or least connections | Avoids piling slow requests on one instance |
| Mixed instance sizes | Weighted | Weights from measured capacity |
| Cache affinity or per-key state | Consistent hashing | Only where locality pays for itself |
| Many tiny clients behind shared NAT | Not source-IP hash | One address would pin many users |
| WebSockets, server-sent events | Least connections plus pub/sub for fan-out | Draining must close long connections politely |

### 3. Health endpoint contract

| Probe | Question | Checks | Returns | Used for |
|---|---|---|---|---|
| Liveness | Is the process alive and responsive? | The event loop answers; no dependency calls | 200 `{status: "ok"}` | Restart a hung process |
| Readiness | Can it serve traffic now? | Finished starting, not shutting down, essential dependency reachable (cached for a few seconds) | 200, or 503 with no detail | Add to or remove from the balancer |
| Startup | Has a slow boot finished? | Migrations or warm-up complete | 200 when done | Delay liveness until ready |

### 4. Graceful shutdown timeline (typical)

| Step | Time budget |
|---|---|
| Receive `SIGTERM`; readiness starts failing | 0 s |
| Balancer deregistration and connection draining | at least the longest normal request (for example 30 s) |
| Stop accepting new connections; finish in-flight work | up to the drain period |
| Close database pools, queues, flush logs and traces | a few seconds |
| Exit; the platform would send a kill after its grace period | grace period must be longer than all of the above |

### 5. Autoscaling policy template

| Setting | Guidance |
|---|---|
| Metric | CPU target 50 to 70 percent; or requests per instance; or p95 latency; or queue depth per worker and age of the oldest message |
| Minimum | One for hobby sites; two or more across zones when downtime matters |
| Maximum | A cap tied to the budget and to the database's connection and throughput limits |
| Scale-out | Fast (short window), step sized to the metric |
| Scale-in | Slow (stabilisation window of minutes), protection for instances holding jobs |
| Warm-up | Do not count a starting instance's metrics until it is ready |
| Guardrails | Budget alert, a maximum scaling rate, an alert when the maximum is reached |

### 6. Queue design

| Concern | Rule |
|---|---|
| Choice | A durable queue (pg-boss or an outbox table on Postgres for small apps, BullMQ on Redis, SQS, Cloud Tasks, QStash, Inngest, Trigger.dev); the user approves any new paid service |
| Delivery | At least once, so handlers are idempotent; a unique job key or a processed-events table prevents duplicate effects |
| Visibility timeout | Longer than the job's worst-case runtime, extended by heartbeat for long jobs |
| Retries | Exponential backoff with full jitter, a maximum attempt count, no retry for permanent errors |
| Dead letters | A dead-letter queue, an alert on any message in it, and a documented replay procedure |
| Atomic enqueue | Write the database change and the job in one transaction through an outbox table, then relay |
| Limits | Per-queue concurrency, per-tenant fairness, job timeout, payload size cap |
| Workers | Health check, graceful stop that finishes or requeues, resource limits |
| Metrics | Depth, age of the oldest message, processing time, failure rate, dead-letter count |

### 7. Failure-scenario matrix

| Failure | Expected behaviour | Evidence to collect |
|---|---|---|
| An instance crashes or is killed | Balancer stops sending traffic within the health-check interval; in-flight requests are retried or fail cleanly; no data loss | Error rate and latency during a kill under load |
| Database unavailable or failing over | Reads fall back to cache where safe; writes return a clear 503 or queue; recovery without manual steps | Behaviour during a failover or a blocked connection |
| Cache unavailable | Fall through to the source with a breaker and rate cap; no stampede | Database load while the cache is flushed |
| Third-party API slow or down | Timeout, breaker opens, degraded feature or queued work, user sees an honest message | Injected delay or error results |
| Network interruption between tiers | Timeouts fire; retries are bounded; no thread or connection pile-up | Connection and queue counts |
| Queue backlog | Autoscale workers or shed load; oldest-message age alert fires; no loss | Backlog drain time |
| Worker crash mid-job | Job becomes visible again and is retried idempotently | Duplicate-effect check |
| Partial deploy (mixed versions) | Both versions serve safely; compatible schema and API | Canary results, mixed-version test |
| Sudden traffic spike | Load shedding and autoscaling keep critical paths up; non-critical features degrade | Spike test results |

### 8. Recovery objectives and the disaster-recovery plan

Starting suggestions per tier are in [database-integrity](database-integrity.md) §4. A plan contains: scenarios (region outage, database corruption, credential compromise, bad deploy, vendor outage), the owner and contact order, the recovery steps with the commands, where backups and keys live, how to communicate status, how to verify recovery, and the date and result of the last drill. The rollback plan is a section of the same document: the trigger, the command, the expected time and how to confirm health.

## Implementation

**Graceful shutdown and keep-alive (Node HTTP server)**

```ts
const server = app.listen(port);
server.keepAliveTimeout = 65_000;   // longer than a typical 60 s balancer idle timeout
server.headersTimeout = 66_000;

let shuttingDown = false;
export const isReady = () => !shuttingDown && dependenciesOk();   // used by /ready

process.on('SIGTERM', () => {
  shuttingDown = true;                                           // readiness now fails
  setTimeout(() => {
    server.close(async () => {                                   // stops accepting, waits for in-flight
      await Promise.allSettled([db.end(), queue.close(), flushLogs()]);
      process.exit(0);
    });
  }, 5_000).unref();                                             // let the balancer notice first
  setTimeout(() => process.exit(1), 25_000).unref();             // hard stop before the platform kill
});
```

**Probes on a container platform (Kubernetes syntax; other platforms have equivalents)**

```yaml
livenessProbe:  { httpGet: { path: /live,  port: 3000 }, periodSeconds: 10, failureThreshold: 3 }
readinessProbe: { httpGet: { path: /ready, port: 3000 }, periodSeconds: 5,  failureThreshold: 2 }
startupProbe:   { httpGet: { path: /ready, port: 3000 }, periodSeconds: 5,  failureThreshold: 24 }
terminationGracePeriodSeconds: 40
lifecycle: { preStop: { exec: { command: ["sleep", "5"] } } }
```

**Retry with exponential backoff and full jitter**

```ts
export async function retry<T>(fn: () => Promise<T>, { attempts = 4, baseMs = 200, capMs = 5_000 } = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await fn(); }
    catch (err) {
      if (attempt + 1 >= attempts || !isRetryable(err)) throw err;
      const delay = Math.random() * Math.min(capMs, baseMs * 2 ** attempt);   // full jitter
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
```

Only wrap operations that are safe to repeat (reads, or writes with an idempotency key).

**Minimal circuit breaker**

```ts
export class Breaker {
  private failures = 0; private openedAt = 0;
  constructor(private threshold = 5, private cooldownMs = 10_000) {}
  async run<T>(fn: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    const open = this.failures >= this.threshold && Date.now() - this.openedAt < this.cooldownMs;
    if (open) return fallback();
    try { const v = await fn(); this.failures = 0; return v; }
    catch { this.failures++; this.openedAt = Date.now(); return fallback(); }
  }
}
```

After the cooldown one call is let through (half-open); success closes the breaker. A library such as `opossum` adds timeouts, volume thresholds and metrics.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| Intermittent 502s behind a balancer | Raise the server keep-alive above the balancer idle timeout |
| Every instance restarts when the database blips | Liveness checked a dependency; make it process-only |
| Deploys drop requests | Add readiness gating, preStop delay, drain time and graceful shutdown |
| Autoscaling makes things worse | The database is the bottleneck: cap instances, add pooling, fix queries first |
| Scheduled job runs several times | Move to a single runner with a lock, or queue-based scheduling |
| Queue grows without bound | Scale workers on depth and age, add load shedding upstream, fix the slow job |
| Retries amplify an outage | Add a retry budget, jitter and a breaker; retry only idempotent calls |
| The user asks for multi-region by default | State the cost and complexity, ask for the recovery objective, build multi-zone first |
| Cannot test failover in the environment | Mark the row NOT_TESTED, document the procedure and the missing environment |
| Host hides the balancer and the scaler | Test behaviour (timeouts, concurrency, connection counts, cold starts) and report the host's documented limits |

## Verification

- The hosting model and what it provides are written down; nothing was built that the platform already supplies.
- Instances are stateless: a test with two instances shows sessions, uploads and counters survive a kill.
- Liveness and readiness behave per §3, and a shutdown during load drops no request (error count recorded).
- Autoscaling policy has a minimum, a maximum, a cooldown and a cost alert, or scaling is NOT_APPLICABLE with the reason.
- Queue handlers pass a duplicate-delivery test; the dead-letter path alerts and replays.
- Each §7 scenario that applies has a recorded test result or is marked NOT_TESTED with the reason.
- RTO and RPO are written and, for T2 and above, measured in a drill.

## Sources

- Paraphrased, no text copied: the twelve-factor app, cloud-provider guidance on load balancing, health checks and connection draining, Kubernetes documentation on probes and termination, the AWS Builders' Library material on retries with jitter and timeouts, the circuit-breaker and bulkhead patterns, and queue-reliability practice (at-least-once delivery, outbox, dead-letter queues).
- Structure and rules follow phases 3 and 4 of the user's production-readiness brief.
