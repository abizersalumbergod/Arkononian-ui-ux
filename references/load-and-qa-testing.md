# Load and QA testing

Proving that a site or app works, keeps working after changes, and survives its expected peak: the test strategy by tier, functional, integration, regression, compatibility and accessibility testing, security tests as ordinary tests, how to judge tests written by AI, and load testing (design, safe targets, capacity arithmetic, k6 patterns, failure injection, recording results). Every number in a report comes from a run that happened.

**Load when:** a test plan, regression run, pre-launch QA, load or stress test, capacity statement, k6, JMeter, Playwright or "will it hold" question comes up; a release readiness row needs test evidence; generated tests need review; a T2 or T3 build reaches Stage 10. **Owns:** the tier test strategy, critical-journey tests, integration-test rules, the regression discipline, the check on AI-written tests, compatibility matrix, the load-test types and design rules, capacity arithmetic, result-recording format, failure-injection menu and the safe-target rules.
**Related:** [production-readiness](production-readiness.md), [quality-gates](quality-gates.md), [test-driven-development](test-driven-development.md), [visual-testing](visual-testing.md), [accessibility](accessibility.md), [responsive-design](responsive-design.md), [backend-performance](backend-performance.md), [scalability-and-reliability](scalability-and-reliability.md), [security-hardening](security-hardening.md), [api-protection](api-protection.md), [observability-and-alerting](observability-and-alerting.md), [devsecops-and-deployment](devsecops-and-deployment.md), [bug-diagnosis](bug-diagnosis.md)

## Decision rules

1. **Weight the pyramid by risk.** Many fast unit tests for logic; integration tests against a real database and queue for constraints, transactions, row-level security and authentication; a few end-to-end journeys for the flows that make or lose money; contract tests or sandboxes for external APIs.
2. **Name the critical journeys at Stage 2** (sign up and first action, browse to checkout, contact form to delivered email, login to the main task) and give each an automated end-to-end test. A failing critical journey blocks the release (Gate B).
3. **Security checks are tests.** The authorisation matrix, validation rejects, rate limits, webhook signatures, CSRF and header checks run in CI, not once by hand ([security-hardening](security-hardening.md), [api-protection](api-protection.md)).
4. **Every fixed bug gets a test that failed first.** Run the whole suite before and after a change and report counts (passed, failed, skipped), never "tests pass" without numbers.
5. **AI-written tests are drafts until proven.** Break the code on purpose (remove the ownership check, flip a comparison, return an empty list) and confirm a test fails. Delete tests that assert nothing, that mock the unit under test, or that snapshot output nobody reads. Check that tests would fail on the bug they claim to guard.
6. **State what is supported, then test that.** Browsers (Chromium, Firefox and WebKit through Playwright), widths (375, 768, 1280, 1920 and 320 reflow, [quality-gates](quality-gates.md) Gate F), a real or emulated phone, dark mode, reduced motion, zoom, keyboard-only use. Declare the supported range in `browserslist` or the README.
7. **Accessibility testing is part of QA:** automated axe scans, keyboard and focus passes, names and roles, contrast ([accessibility](accessibility.md), Gate D). Automated tools find only part of the issues; say what was and was not checked.
8. **A load test answers a stated question** with a target: "Checkout holds 40 requests per second with p95 under 800 ms and under 1 percent errors, for 10 minutes." State where the expected traffic number came from (analytics, an estimate with its formula, a launch plan).
9. **Use a safe target.** Load runs against localhost or a staging environment that mirrors production's topology and data shape. Production only with the user's approval naming the window and limits. Never aim load at a third-party system: stub it or use its sandbox within its terms. Serverless hosts bill per invocation and plans have limits, so estimate the cost and ask before a run that can spend money.
10. **Test data is fake and realistic in volume.** Seeded users and rows at production scale, payment providers in test mode, a mail sink instead of real email, cleanup afterwards, no personal data.
11. **Model real behaviour.** Mix reads and writes, include think time and logged-in sessions, ramp up before holding, use an arrival-rate model (users arrive regardless of how slow the system is) rather than a closed loop that hides overload, hold at steady state long enough to mean something (at least ten minutes) and soak longer for leaks (one to four hours) at T2 and above.
12. **Record each run completely** (§4) and keep the raw summary file. Repeat three times and report the range, not the best run.
13. **Find the bottleneck, then fix the biggest one.** Correlate latency with CPU, memory, event-loop delay, database time, pool waits and upstream calls; change one thing; re-run ([backend-performance](backend-performance.md)).
14. **Inject failures under load** (§6) at T2 and above: the point is how the system and its alerts behave, and how fast it recovers.
15. **Report capacity as a conditional statement:** "Sustained X requests per second at p95 Y ms on environment Z; errors began at W requests per second; the bottleneck was the database pool." Note when the test environment differs from production.
16. **No run, no number.** A test that did not execute is NOT_TESTED; a missing tool is BLOCKED with the install command; never fill a table with estimates labelled as results.

## Specifications

### 1. Test strategy by tier

| Tier | Required | Add |
|---|---|---|
| T0 | Build and link check, Gates D, E, F, C; one smoke journey (home loads, key link works) | Compatibility screenshots at the width matrix |
| T1 | T0 plus form journey end to end with a mail sink, validation and rate-limit tests, header test | Webhook tests, spam-control test |
| T2 | T1 plus integration tests on a real database, authorisation matrix, critical journeys in a real browser, regression suite in CI, load at expected peak, restore drill | Mutation sanity check on generated tests |
| T3 | T2 plus tenant-isolation tests per resource, load at twice peak, spike and soak, failure injection, rollback rehearsal | Contract tests for each external API |

### 2. Load-test types

| Type | Question | Shape | Typical length |
|---|---|---|---|
| Smoke | Does the script and the target work at all? | 1 to 2 virtual users | 1 minute |
| Load | Does it meet objectives at expected peak? | Ramp to peak, hold | 10 to 30 minutes |
| Stress | Where does it break, and how? | Ramp past peak until errors or latency break the objective | Until failure |
| Spike | Does it survive a sudden surge and recover? | Jump to a multiple of peak, then back | 5 to 10 minutes |
| Soak | Does it leak or degrade over time? | Hold at normal load | 1 to 4 hours |
| Breakpoint | What is the real capacity? | Keep raising the arrival rate | Until thresholds fail |

### 3. Capacity arithmetic

- Concurrency equals throughput times latency (Little's law): 40 requests per second at 0.5 s latency means about 20 requests in flight. Size pools and instance counts from that, then verify.
- Expected peak requests per second is roughly `daily requests x peak-hour share / 3600`; the busiest hour often carries ten to twenty percent of a day's traffic. Replace the share with analytics when available, and label an estimate as an estimate.
- One user is not one request: count the requests per page view (HTML, API calls, assets not served by a CDN).
- Test at expected peak (T2) and at twice peak (T3), plus a spike of several times for flash-sale or launch traffic.

### 4. Result record

One row per run; keep the raw output file.

| Field | Example |
|---|---|
| Run id, date, commit | `L-004`, 2026-11-12, `3f2a9c1` |
| Environment | Staging, 2 vCPU x 2 instances, Postgres 4 GB, region, data volume |
| Scenario and shape | Browse plus checkout, arrival rate ramp 2 to 20 req/s, hold 10 min |
| Requests per second (achieved) and peak concurrent users | 19.8 req/s, 120 users |
| Latency p50, p95, p99 (ms) | 180, 410, 960 |
| Error percentage and error types | 0.3 percent, 2 timeouts |
| App CPU and memory | 62 percent, 540 MB, flat |
| Database CPU, connections used, slow queries | 48 percent, 38 of 60, none over 200 ms |
| Queue depth and processing time | 0, 1.2 s |
| Threshold result | Pass or fail per threshold |
| Bottleneck and next change | Pool saturation at 25 req/s; raise pool, re-run |
| Repeat runs and range | 3 runs; p95 395 to 430 ms |

### 5. Compatibility matrix

| Dimension | Minimum to test |
|---|---|
| Engines | Chromium, Firefox, WebKit (Playwright) |
| Widths | 375, 768, 1280, 1920, plus 320 reflow |
| Input | Mouse, touch (emulated or device), keyboard only |
| Preferences | Dark mode, reduced motion, forced colours, 200 percent text zoom |
| Network and CPU | A throttled mobile profile for Gate E |
| Real device | At least one real phone for T1 and above when available; otherwise NOT_TESTED |

### 6. Failure-injection menu (staging, under load)

Kill one instance; restart the database or fail over; flush the cache; add latency or errors to a dependency (a proxy or a stub); block the queue consumer; expire a credential; fill a disk to a safe limit; deploy a bad build and roll back. Record the error rate during the fault, the time to detect (alert), and the time to recover.

## Implementation

**k6 load script (arrival-rate model, thresholds, grouped requests)**

```js
import http from 'k6/http';
import { check, group, sleep } from 'k6';

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-arrival-rate',
      startRate: 2, timeUnit: '1s', preAllocatedVUs: 50, maxVUs: 300,
      stages: [
        { target: 20, duration: '2m' },    // ramp to expected peak
        { target: 20, duration: '10m' },   // hold
        { target: 0, duration: '1m' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{group:::home}': ['p(95)<500', 'p(99)<1500'],
    checks: ['rate>0.99'],
  },
};

const BASE = __ENV.BASE_URL;

export default function () {
  group('home', () => {
    const res = http.get(`${BASE}/`);
    check(res, { 'status 200': (r) => r.status === 200 });
  });
  group('product', () => {
    const res = http.get(`${BASE}/api/products?limit=20`);
    check(res, { 'status 200': (r) => r.status === 200, 'has items': (r) => r.json('items').length > 0 });
  });
  sleep(Math.random() * 3);                  // think time
}
```

```bash
k6 run -e BASE_URL=http://localhost:3000 --summary-export=summary-1.json load.js
```

Run it against the authorised target only. k6 is a local tool; installing it system-wide needs approval, and without it use a Node script or `autocannon` for a smoke-level number and label the limits.

**Critical journey (Playwright)**

```ts
import { test, expect } from '@playwright/test';

test('visitor can submit the contact form and sees confirmation', async ({ page }) => {
  await page.goto('/contact');
  await page.getByLabel('Email').fill('visitor@example.test');
  await page.getByLabel('Message').fill('Hello from a test');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Thanks, we will reply soon')).toBeVisible();
});
```

**Authorisation test (any test runner)**

```ts
test('user A cannot read user B\'s order', async () => {
  const res = await fetch(`${BASE}/api/orders/${orderOfB.id}`, { headers: { cookie: sessionOfA } });
  expect([403, 404]).toContain(res.status);
});
test('anonymous request is rejected', async () => {
  const res = await fetch(`${BASE}/api/orders/${orderOfB.id}`);
  expect(res.status).toBe(401);
});
```

**Mutation sanity check for a generated test**

1. Comment out the ownership condition in `getOrderForUser`.
2. Run the suite; the authorisation test above must fail.
3. Restore the line; the suite passes again. If step 2 passed, the test proves nothing: rewrite it.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| No load tool is installed | Mark the load row BLOCKED with the install command; use a Node script or `autocannon` for a labelled smoke figure |
| Staging is smaller than production | Report capacity for the staging size and the scaling assumption, label the production figure as an estimate |
| The load test hits rate limits or a third party | Stub the dependency or use a sandbox; raise limits for the test identity only on the test environment |
| Results vary wildly between runs | Check for noisy neighbours, cold caches, background jobs; repeat, report the range |
| The generator is the bottleneck | Run it from a bigger machine or distribute it; confirm the generator's CPU stays low |
| Tests flake | Fix the cause (waits on conditions, isolated data); quarantine with a ticket, never retry until green and call it fixed |
| The suite is too slow to run in CI | Split by tier (fast on every push, full on merge), parallelise, keep security tests in the fast set |
| The user wants a number now | Give the measured smoke result with its limits, state NOT_TESTED for the rest |
| Real device unavailable | Emulation plus NOT_TESTED for the real-device row |

## Verification

- Critical journeys, authorisation tests and validation tests run in CI, with counts before and after any change.
- Generated tests passed the mutation sanity check, or are marked unproven.
- The compatibility matrix was run for the claimed support range, or the gaps are NOT_TESTED.
- Each load run has a §4 record and a kept raw summary, with the environment and the bottleneck; capacity is stated conditionally.
- Failure injection ran at T2 and above, with detection and recovery times, or the rows are NOT_TESTED with the reason.
- No load ran against production or a third-party system without the explicit approval described in rule 9.

## Sources

- Paraphrased, no text copied: k6 documentation (executors, thresholds, groups), the test-pyramid idea, Little's law, Playwright documentation, the discussion of coordinated omission in latency measurement, and chaos-engineering practice. Peak-hour share and run lengths are rules of thumb to be replaced with the project's own data.
- Structure and rules follow phase 9 of the user's production-readiness brief.
