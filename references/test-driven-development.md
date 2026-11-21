# Test-driven development

The red-then-green loop for logic and behaviour in a site or app: where tests go, what a good test is, what to mock, the anti-patterns, and the rules of one cycle. It is how this package builds anything that can silently break (prices, carts, forms, validation, state machines, data transforms, access rules).

**Load when:** building or changing logic that can break, fixing a bug that needs a regression test, adding integration or journey tests, or the user mentions test-first, red-green-refactor or "write tests". **Owns:** seams (where tests go), what a good test is, the anti-patterns, mocking boundaries, UI test selection, and the rules of a test-first cycle.
**Related:** [bug-diagnosis](bug-diagnosis.md), [codebase-design](codebase-design.md), [domain-model](domain-model.md), [prototyping](prototyping.md), [quality-gates](quality-gates.md), [visual-testing](visual-testing.md), [interaction-design](interaction-design.md), [frontend-architecture](frontend-architecture.md), [troubleshooting](troubleshooting.md)

## Decision rules

1. **Test behaviour through public interfaces.** Code may change completely; the tests should not. A test that fails after a refactor with no change in behaviour is the defect, not the refactor.
2. **Agree the seams first.** A seam is the public boundary a test observes without reaching inside. Before writing any test, write down the seams under test with one line each on what the seam catches and what it misses. Prefer existing seams, then the highest seam that works; the ideal number per feature is one. If the user is reachable and the choice is material, confirm; otherwise record the seams as an assumption in the [design decision record](../templates/design-decision-record.md) and go on ([SKILL.md §1](../SKILL.md), rule 8).
3. **Red before green.** Write the failing test, watch it fail for the right reason, then write only enough code to pass it. No speculative features, no code for tests that do not exist yet.
4. **One vertical slice per cycle.** One seam, one test, one minimal implementation, then repeat. Never write all tests first and all code after: bulk tests describe imagined behaviour and lock in a structure before the implementation has taught you anything. Each test is a tracer bullet that responds to the last cycle.
5. **Refactoring is not part of the loop.** It happens after green, in review ([review-and-handoff](review-and-handoff.md)), with the tests kept green.
6. **Expected values come from an independent source**: a literal, a worked example or the spec. Never recompute the expectation the way the code does; such a test passes by construction.
7. **Mock only at system boundaries**: payment, email and other third-party services, the network, the clock, randomness, and sometimes the file system or database. Never mock your own modules or internal collaborators. Replace a mock with a local stand-in (an in-memory fake, a test database) when one exists.
8. **Test by risk.** Critical journeys and complex logic get tests. Do not assert pixel values, class names or generated markup; visual quality belongs to [visual-testing](visual-testing.md) and [visual-critique](visual-critique.md), accessibility to the checks in [accessibility](accessibility.md).
9. **Select the way a user perceives the page**: role, label, visible text, then a test id as the last resort. Drive interactions the way a user does (click, type, tab) and assert on what is visible.
10. **A test that fails after your change means your change broke it** until proven otherwise ([troubleshooting](troubleshooting.md), rule 12). Update an expectation only when the old one is demonstrably wrong, and say so.
11. **Never weaken, skip or delete a test to get green.** Never lower a gate threshold either.
12. **Replace, do not layer.** When a module is deepened ([codebase-design](codebase-design.md)), delete the old unit tests of the shallow parts once tests exist at the new interface.
13. **Use the project's vocabulary** in test names and fixtures, so the suite reads as a specification ([domain-model](domain-model.md)).

## Specifications

### Where a test goes in a web build

| What is under test | Seam | Typical tool (detect, never assume) | Typical risk it catches |
|---|---|---|---|
| Pure logic: price, tax, discount, validation, formatting, date rules | The exported function | The project's runner, or Node's built-in `node --test` when none exists | Wrong totals, off-by-one, locale bugs |
| Stateful UI logic: forms, wizards, filters, carts | The component or store through user events | The project's component test setup | Illegal states reachable, lost input, stale state |
| Server logic and API handlers | A request in, a response out | The framework's request test helper, or a plain fetch against a local server | Auth gaps, bad status codes, contract drift |
| A critical journey (checkout, sign-up, search to result) | The running app in a browser | A browser automation tool (Playwright when present) | Broken wiring between pieces that each pass alone |
| Layout, overflow, console errors, contrast | The rendered page | `scripts/visual-check.mjs`, axe | Defects no unit test sees |

### Good and bad tests

```ts
// Good: observable behaviour, independent expected value
test("a cart with a 10 and a 5 item totals 15", () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});

// Bad: implementation-coupled (asserts the call, not the outcome)
test("checkout calls paymentService.process", async () => {
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});

// Bad: tautological (the expectation restates the code)
test("calculateTotal sums line items", () => {
  const expected = items.reduce((sum, i) => sum + i.price, 0);
  expect(calculateTotal(items)).toBe(expected);
});

// Bad: bypasses the interface to verify
test("createUser saves a row", async () => {
  await createUser({ name: "Alice" });
  expect(await db.query("SELECT * FROM users WHERE name = ?", ["Alice"])).toBeDefined();
});
// Good: verifies through the interface
test("createUser makes the user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  expect((await getUser(user.id)).name).toBe("Alice");
});
```

### Anti-patterns

| Anti-pattern | Tell | Fix |
|---|---|---|
| Implementation-coupled | Mocks internals, tests private methods, asserts call order or counts, breaks on refactor | Test the outcome through the public seam |
| Tautological | Expected value computed with the code's own formula | Use a literal or a worked example from the spec |
| Horizontal slicing | A folder of tests written before any code | One test, one implementation, repeat |
| Snapshot sprawl | Large markup snapshots updated without reading | Assert the few facts that matter; keep snapshots tiny and reviewed |
| Sleep-based waits | `sleep(500)` or timeouts in a UI test | Wait on state (visible, enabled, URL changed) and emulate reduced motion |
| Test-id-only selection | Every query uses a test id | Query by role or label first; it doubles as an accessibility check |
| Mock-heavy setup | More setup than assertion | The module is shallow or has hidden dependencies: see [codebase-design](codebase-design.md) |

### Designing a boundary so it is easy to fake

```ts
// Easy to fake: dependency passed in, one function per external operation
function processPayment(order, paymentClient) { return paymentClient.charge(order.total); }
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  createOrder: (data) => fetch("/orders", { method: "POST", body: data }),
};

// Hard to fake: hidden construction, one generic fetcher that needs branching inside the fake
function processPayment(order) { return new PaymentClient(process.env.KEY).charge(order.total); }
const api = { fetch: (endpoint, options) => fetch(endpoint, options) };
```

Accept dependencies instead of creating them, return results instead of mutating, and keep the surface small: fewer methods mean fewer tests and simpler setup.

## Implementation

One cycle:

1. Detect the test runner and commands from `package.json` and the lockfile; never assume a command. With no runner, use the built-in Node test runner for logic and add the browser tool only for a journey (an ordinary dev dependency, recorded in the DDR).
2. Name the behaviour in the project's words and write one failing test at the agreed seam.
3. Run only that file and read the failure. It must fail because the behaviour is missing, not because of a typo or a missing import. A test that cannot go red is wrong.
4. Write the smallest change that passes. Run that file again.
5. Run the typecheck and the nearby tests, then pick the next slice.
6. When the seams behave as the spec says, run the full suite once and report counts (passed, failed, skipped) before and after ([SKILL.md §9](../SKILL.md)).

For a bug, turn the minimised repro from [bug-diagnosis](bug-diagnosis.md) into the failing test first, then fix.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| No test runner and no network for installs | Write the checks as a Node script with `assert`, keep it in the repo, and record `NOT TESTED` for what it cannot cover |
| No correct seam exists for the behaviour | That is a finding for [codebase-design](codebase-design.md): record it, test at the nearest honest seam, and say what stays unproven |
| The new test passes on its first run | It does not test the new behaviour; break the code on purpose, confirm it goes red, restore it |
| A flaky journey test | Wait on state, mock only the network, run with reduced motion, and quarantine it with a note rather than deleting it |
| The spec is ambiguous | Write the question down, pick the most conservative reading, record the assumption, ask only if the answer changes architecture or safety |
| Coverage pressure to test everything | Choose seams by risk and say what was deliberately left untested |

## Verification

- Each new behaviour has a test that was seen failing first, with the failing output kept in the report.
- Seams are listed with what each catches and misses; no test sits at an unlisted seam.
- No expectation was changed, skipped or removed to turn a test green, unless the old expectation is shown wrong.
- Test counts are reported before and after, with the commands used.

## Sources

- Adapted and extended from the MIT-licensed `tdd` skill by Matt Pocock (seams, vertical slices, tautological and implementation-coupled tests, mocking boundaries, red-before-green). Rewritten for this package: UI seams, selection rules, the gate mapping and the fallbacks are new. The seam concept is Michael Feathers'.
