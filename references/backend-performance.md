# Backend performance

Server-side speed measured and improved with evidence: how to baseline, what latency objectives to set, how to tune queries and connections, what to take out of the request path, how to find memory and CPU problems, and how to cache safely at every layer. Page-level speed (Core Web Vitals, bundles, media, 3D) stays in [performance](performance.md); both feed Gate E and the same report.

**Load when:** an API or page is slow, latency or timeouts appear under load, a database or connection pool is a suspect, caching, Redis, a CDN or ISR is being added, N+1 queries or memory growth are suspected, serverless functions time out, or the user asks to "make it faster" or "make it scale". **Owns:** the measurement protocol, latency objectives, query and index tuning rules, connection arithmetic, request-path hygiene, memory and CPU checks, payload shaping, and the caching architecture (HTTP, CDN, application, Redis) with its invalidation, stampede and privacy rules.
**Related:** [production-readiness](production-readiness.md), [performance](performance.md), [database-integrity](database-integrity.md), [scalability-and-reliability](scalability-and-reliability.md), [api-protection](api-protection.md), [observability-and-alerting](observability-and-alerting.md), [load-and-qa-testing](load-and-qa-testing.md), [frontend-architecture](frontend-architecture.md), [troubleshooting](troubleshooting.md), [bug-diagnosis](bug-diagnosis.md), [security-and-privacy](security-and-privacy.md)

## Decision rules

1. **Measure, change one thing, measure again.** Record a baseline first, then each change's result, with the environment (machine or host size, region, data volume, concurrency, commit). Use percentiles (p50, p95, p99), never averages alone, and separate cold from warm starts. Never write a number that was not measured.
2. **Set objectives before tuning.** "Fast enough" is a number per endpoint class (§2). Stop when the objective is met; do not optimise past it.
3. **Optimise where the evidence points.** Use a trace, a profile or `EXPLAIN (ANALYZE, BUFFERS)` to find the largest slice of time, fix that, and measure again. No speculative optimisation.
4. **Test with realistic volume.** Ten rows hide every problem. Seed at least the expected production volume (ten times it for growth) and realistic distributions before judging a query or an endpoint.
5. **Queries:** select only needed columns; make filters and sorts use an index; paginate with keyset (cursor) pagination, not deep `OFFSET`; never run an unbounded query; batch instead of looping; remove N+1 with joins, eager loading or batched loaders; keep functions off indexed columns in `WHERE`; use full-text or trigram search instead of leading-wildcard `LIKE`; avoid exact `COUNT(*)` on large tables in hot paths.
6. **Index for measured need.** Each index costs write time and storage. Confirm with `EXPLAIN`; drop indexes that stay unused over a full business cycle.
7. **Connections are a budget.** Pool size times instance count must stay below the database's connection limit with headroom. Serverless and edge functions go through a pooler or an HTTP-based driver. Set acquire, statement and idle-in-transaction timeouts.
8. **Keep slow work out of the request.** Email, PDF and image processing, third-party calls with retries, large exports and AI calls go to a background job ([scalability-and-reliability](scalability-and-reliability.md)). In Node, keep synchronous file, crypto and huge `JSON.parse` work off the event loop; stream large payloads.
9. **Every outbound call has a timeout and a deadline** taken from the request's remaining budget. Run independent calls in parallel with a concurrency cap, coalesce repeated calls, and define the fallback when a dependency is slow.
10. **Look for unbounded growth.** Module-level maps, caches without a size limit, listeners and timers that are never removed, arrays that grow per request. Confirm with a soak test that memory settles (§1), and set container memory and heap limits.
11. **Shape payloads.** Return the fields the caller needs, paginate, compress text responses (brotli or gzip), stream large exports, and use `ETag` or `Last-Modified` where conditional requests save work.
12. **Caching is a correctness feature first.** Cache only what is expensive, read-heavy and tolerant of staleness. For each cache define the key (including tenant, locale, version and auth scope), the TTL, who invalidates it, what happens when it is stale, and what happens when the cache is down.
13. **Add the highest layer that works** (§5): immutable assets at the CDN, public pages at the edge, framework data cache, then a shared cache, then the database. Do not start with Redis for something a CDN header solves.
14. **Never cache private data in a shared cache.** Personalised responses carry `Cache-Control: private` or `no-store` and the right `Vary`; no cache stores secrets or personal data without a stated reason, a short TTL and encryption where the provider supports it; errors are cached briefly or not at all.
15. **Cache failure must not become a database outage.** When the cache is down, fall through to the source with a circuit breaker, request coalescing and a rate limit so the database is not stampeded.
16. **Report both halves together:** baseline and after, mobile and desktop for the page ([performance](performance.md)), p50, p95, p99 and error rate for the API, in one table.

## Specifications

### 1. Measurement protocol

| Record | Why |
|---|---|
| Commit, build mode, runtime and framework versions | Results are only comparable on the same code |
| Host or machine size, region, database size and plan | Latency depends on both |
| Data volume and distribution (rows per table, hot keys) | Query plans change with volume |
| Concurrency and request rate, warm-up excluded | Latency rises with load |
| Cold versus warm (first request after idle, serverless cold start) | Different problems, different fixes |
| p50, p95, p99, max, error rate, requests per second | A mean hides the tail |
| Server CPU, memory, event-loop delay (Node), database connections | Shows the real bottleneck |
| Query count and total database time per request | Finds N+1 |

For a quick local baseline use a load tool such as `autocannon` or k6 ([load-and-qa-testing](load-and-qa-testing.md)), and the framework's or runtime's profiler for the hot path.

### 2. Latency objectives (suggested defaults, replace with the product's own)

| Endpoint class | p95 | p99 | Error rate |
|---|---|---|---|
| Cached or static read | 100 ms | 300 ms | below 0.1% |
| Ordinary read (database) | 300 ms | 1 s | below 0.5% |
| Ordinary write | 800 ms | 2 s | below 0.5% |
| Search and list with filters | 500 ms | 1.5 s | below 0.5% |
| Heavy work (export, report, AI) | answer in under 1 s with a job id; the job finishes in its own objective | | below 1% |

An SLO states the objective, the window (for example 28 days) and the error budget; alert on its burn rate ([observability-and-alerting](observability-and-alerting.md)).

### 3. Query tuning checklist

| Symptom | Check | Fix |
|---|---|---|
| One slow query | `EXPLAIN (ANALYZE, BUFFERS)`: sequential scan on a big table, large sort, row estimate far from actual | Index for the filter and sort; refresh statistics (`ANALYZE`); rewrite the query |
| Many fast queries per request | Query count per request, repeated statement with changing id | Join, eager load, batched `IN (...)` loader; assert a query-count ceiling in a test |
| Slow list endpoint at page 500 | `OFFSET` with a large value | Keyset pagination on an indexed sort key |
| Slow `ORDER BY ... LIMIT` | Sort not backed by an index | Composite index matching the filter columns then the sort column |
| Slow `LIKE '%text%'` | Leading wildcard, no index use | Full-text search or trigram index |
| Slow aggregates on every page view | Heavy `COUNT` or `SUM` in a hot path | Precompute, cache with a TTL, or maintain a counter table |
| Lock waits and timeouts | Long transactions, `idle in transaction` sessions | Shorter transactions, no network calls inside them, `idle_in_transaction_session_timeout` |
| Unused indexes slowing writes | Index scan counts near zero over a full cycle | Drop after review |

Find the worst offenders with the database's statement statistics (`pg_stat_statements` on Postgres) sorted by total time, then work from the top.

### 4. Connection arithmetic

`max connections in use = pool size per instance x instances (plus workers, migrations, admin sessions)`; keep it below the database limit minus a safety margin. Serverless concurrency multiplies instances quickly, so use the provider's pooler (transaction mode) or an HTTP-based driver, keep each function's pool at one or two connections, and remember transaction pooling forbids session-level state (prepared-statement settings, session `SET`, advisory locks held across statements). Set `statement_timeout` and an application-side acquire timeout so exhaustion fails fast instead of queueing forever.

### 5. Caching layers

| Layer | Holds | Control | Invalidate by | Never |
|---|---|---|---|---|
| Browser and CDN, assets | Hashed JS, CSS, fonts, images | `Cache-Control: public, max-age=31536000, immutable` | New file name per build | Un-hashed file names with a long max-age |
| CDN or edge, public pages | Anonymous HTML and public API data | `s-maxage` plus `stale-while-revalidate`; ISR or on-demand revalidation by tag or path | Revalidate on content change | Pages that vary by cookie or user |
| Framework data cache | Fetch results and rendered segments | Framework revalidate settings | Time or tag | Per-user data in a shared segment |
| In-process memory | Tiny hot configuration | LRU with a size limit and a short TTL | TTL | Anything large or per-user; it is per instance |
| Redis or another shared cache | Expensive shared results, rate counters, session data | Cache-aside, versioned namespaced keys, TTL with jitter | TTL, version bump, key or tag delete on write | Primary data, private data without scoping, queue and cache in one eviction policy |
| Database | The source of truth | Indexes, materialised views | Refresh schedule | Treating a materialised view as live |

### 6. HTTP cache header recipes

| Response | Header |
|---|---|
| Hashed static asset | `Cache-Control: public, max-age=31536000, immutable` |
| Public HTML that may be a little stale | `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300` |
| Public API data | `Cache-Control: public, max-age=30, s-maxage=120` and `ETag` |
| Personalised or authenticated response | `Cache-Control: private, no-store` and `Vary: Cookie` or `Authorization` where a shared layer could see it |
| Error response | `Cache-Control: no-store` (or a few seconds for upstream-outage protection) |
| Anything with `Set-Cookie` | Treat as private; CDNs often refuse to cache it |

### 7. Redis cache rules

Cache-aside (read cache, on miss load and store). Key format `v<schema>:<tenant>:<entity>:<id>`; bump the version to invalidate a whole class. TTL with random jitter of ten to twenty percent so keys do not expire together. One in-flight load per key (single-flight) so a popular expired key is rebuilt once. Short negative caching for "not found". Serve stale on upstream error when it is safe. Cap value size. Run the cache with an eviction policy (`allkeys-lru`) and a separate instance or database for queues and locks that need `noeviction`. When Redis is down: circuit breaker, fall through to the database for a bounded request rate, and alert.

## Implementation

**Query inspection (Postgres)**

```sql
explain (analyze, buffers) select id, total_minor from orders where owner_id = $1 order by created_at desc limit 20;
select query, calls, round(total_exec_time::numeric, 1) as total_ms, round(mean_exec_time::numeric, 2) as mean_ms
from pg_stat_statements order by total_exec_time desc limit 10;
```

**A query-count ceiling in a test (catches N+1)**

```ts
test('order list uses at most 3 queries for 50 orders', async () => {
  await seedOrders(50);
  const counter = countQueries(db);          // wraps the client; returns { count }
  await listOrders(userId);
  expect(counter.count).toBeLessThanOrEqual(3);
});
```

**Cache-aside with single-flight and jitter (TypeScript, `ioredis`)**

```ts
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  const hit = await redis.get(key);
  if (hit !== null) return JSON.parse(hit) as T;
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;                                   // coalesce on this instance
  const task = (async () => {
    const value = await load();
    const ttl = Math.round(ttlSec * (0.9 + Math.random() * 0.2)); // 10 percent jitter either way
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
    return value;
  })().finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}
```

Across several instances, add a short lock (`SET lock:<key> 1 NX PX 5000`) or accept a bounded number of duplicate loads; both are fine, an unbounded stampede is not.

**Event-loop delay (Node)**

```ts
import { monitorEventLoopDelay } from 'node:perf_hooks';
const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
setInterval(() => { console.info({ evloopP99ms: h.percentile(99) / 1e6 }); h.reset(); }, 10_000).unref();
```

A p99 above about 100 ms means synchronous work is blocking requests.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| The fix helps locally and not in production | The data volume or host differs: re-measure on the real shape and size, or label the result as local |
| Cache serves another user's data | Key lacked the user or tenant; add it, purge the cache, add a test that two users get different values, treat as a security finding |
| Stale data after a write | Add invalidation on write (key or tag), or shorten the TTL; document the staleness window |
| Cache stampede on expiry | Single-flight, jitter, stale-while-revalidate |
| Redis outage causes database overload | Circuit breaker plus a rate cap on fall-through, serve stale where safe |
| Pool exhausted under serverless load | Use the provider pooler or an HTTP driver, lower per-function pool size, add acquire timeouts |
| Index added and the plan did not change | The planner estimates differently: `ANALYZE`, check the composite column order, check types and casts, then drop the useless index |
| Memory climbs with traffic | Heap snapshot comparison under a soak test; look for unbounded maps, listeners, timers |
| No production access for profiling | Profile staging with the production-sized dataset; mark production numbers NOT_TESTED |
| The target is met but the user wants more | Report the number, the objective and the cost of going further; do not spend complexity without a requirement |

## Verification

- Baseline and after-change numbers exist for each optimised path, with the §1 environment and the data volume, and none was invented.
- p50, p95, p99 and error rate are reported against the §2 objectives; mobile and desktop page results are reported separately ([performance](performance.md)).
- A query-count test guards each list endpoint against N+1.
- Pool arithmetic is written down and below the database limit.
- Every cache entry is listed with key, TTL, invalidation, staleness behaviour and failure behaviour; a test shows two users never share a private cached value.
- A soak or long-run check shows memory and event-loop delay stable, or the check is marked NOT_TESTED.

## Sources

- Paraphrased, no text copied: PostgreSQL documentation (`EXPLAIN`, `pg_stat_statements`, indexes), MDN and RFC 9111 (HTTP caching, `stale-while-revalidate` per RFC 5861), web.dev caching guidance, the Node.js documentation (`perf_hooks`, event loop), Redis documentation (eviction policies, key expiry), and the SRE practice of percentile latency objectives. Objective values are starting defaults.
- Structure and rules follow the performance and caching parts of the user's production-readiness brief (phases 2 and 3).
