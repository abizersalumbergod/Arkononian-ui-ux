# Codebase design

Designing deep modules: a lot of behaviour behind a small interface, placed at a clean seam, testable through that interface. This module gives the shared vocabulary, the dependency-handling rules, the "design it twice" method for choosing an interface, and the procedure for scanning an existing codebase for deepening opportunities.

**Load when:** designing or restructuring a module's interface, deciding where a seam goes, making code more testable or easier for an agent to navigate, scanning a project that has grown past a handful of components, or when [test-driven-development](test-driven-development.md) or [bug-diagnosis](bug-diagnosis.md) reports that no correct seam exists. **Owns:** the module, interface, depth, seam, adapter, leverage and locality vocabulary; the deletion test; dependency categories; seam discipline; design-it-twice; the architecture scan and its report; entry-point boundary rules for a package layout.
**Related:** [frontend-architecture](frontend-architecture.md), [domain-model](domain-model.md), [test-driven-development](test-driven-development.md), [interview-and-specs](interview-and-specs.md), [repo-guardrails](repo-guardrails.md), [review-and-handoff](review-and-handoff.md), [lean-code](lean-code.md), [quality-gates](quality-gates.md)

## Decision rules

1. **Use the vocabulary exactly** (table below). Do not substitute "component", "service", "API" or "boundary" for the terms; consistent language is the point. Name domain things with the project's glossary terms ([domain-model](domain-model.md)).
2. **Depth is leverage at the interface**, not a ratio of lines. A module is deep when a large amount of behaviour sits behind a small interface and shallow when the interface is nearly as complex as the body.
3. **The deletion test.** Imagine deleting the module. If the complexity vanishes, it was a pass-through; if it reappears across many callers, it was earning its keep. Only a module that concentrates complexity is worth deepening toward.
4. **The interface is the test surface.** Callers and tests cross the same seam. If a test needs to reach past the interface, the module is the wrong shape.
5. **One adapter is a hypothetical seam; two adapters is a real one.** Do not introduce a seam or port unless something actually varies across it (typically production and test). A single-adapter seam is indirection.
6. **Accept dependencies, return results, keep the surface small.** These three habits make most code testable without effort.
7. **Replace, do not layer, tests.** After deepening, tests move to the new interface and the old shallow unit tests are deleted ([test-driven-development](test-driven-development.md), rule 12).
8. **Scope a scan by recent change.** Deepening pays off where code keeps changing. Take the user's named direction, otherwise use the history to find hot spots; widen only if changes are scattered.
9. **Scan first, propose later.** A scan produces candidates with a recommendation strength and no interfaces. Interfaces are designed only after the user picks one.
10. **Refactor only the candidate the user picks**, with the preserved-journey tests green before and after. On an existing project this is offered after the app runs and has grown past a handful of components, never forced ([existing-project](../workflows/existing-project.md)).
11. **Respect recorded decisions.** An existing ADR is not re-litigated by default; surface a candidate that contradicts one only when the friction is real, and mark the conflict ([domain-model](domain-model.md)).
12. **Lean never removes what the gates require**: accessibility, states, fallbacks, validation and critical-journey tests stay ([lean-code](lean-code.md)).

## Specifications

### Vocabulary

| Term | Meaning | Avoid |
|---|---|---|
| Module | Anything with an interface and an implementation, at any scale: a function, a class, a package, a slice across tiers | unit, component, service |
| Interface | Everything a caller must know: the signature, plus invariants, ordering, error modes, required configuration, performance traits | API, signature (too narrow) |
| Implementation | The body of code inside a module | |
| Depth | Behaviour a caller or test can exercise per unit of interface they must learn | |
| Seam | A place where behaviour can change without editing in that place; the location where a module's interface lives | boundary |
| Adapter | A concrete thing that satisfies an interface at a seam; it describes a role, not contents | |
| Leverage | What callers get from depth: more capability per unit of interface | |
| Locality | What maintainers get from depth: change, bugs and verification concentrate in one place | |

A module has one interface; depth is measured against it; a seam is where the interface lives; an adapter sits at a seam. A deep module may have internal seams (private, used by its own tests) as well as its external seam. Do not expose internal seams just because tests use them.

### Dependency categories (decide how a deepened module is tested)

| Category | Example | Rule |
|---|---|---|
| In-process | Pure computation, in-memory state | Merge freely and test through the new interface; no adapter |
| Local-substitutable | A store with a local stand-in (an embedded database, an in-memory file system) | Deepen; run the stand-in in the suite; the seam stays internal |
| Remote but owned | Your own API or microservice | Define a port at the seam; production uses a network adapter, tests use an in-memory one |
| True external | A third-party payment, email or maps service | Inject the dependency as a port; tests use a fake adapter |

### Designing it twice

Your first interface is unlikely to be the best. For a chosen candidate:

1. Frame the problem: constraints any interface must meet, the dependencies and their category, and a rough sketch that makes the constraints concrete (not a proposal).
2. Produce three or more radically different interfaces, each under a different constraint: minimise it (one to three entry points); maximise flexibility; optimise for the most common caller so the default case is trivial; and, where it applies, design around ports and adapters. When the host offers isolated workers with fresh context, run them in parallel; otherwise write each design in full before reading the others.
3. For each design give: the interface (types, methods, parameters, invariants, ordering, error modes), a usage example, what the implementation hides, the dependency strategy, and trade-offs.
4. Compare in prose by depth, locality and seam placement, then recommend one (or a hybrid) and say why. Be opinionated; the reader wants a strong read, not a menu.

### Architecture scan

Look for friction, not rules:

- Understanding one concept needs bouncing between many small modules.
- Shallow modules: the interface is nearly as complex as the body.
- Pure functions extracted only for testability while the real bugs hide in how they are called (no locality).
- Tightly coupled modules that leak across their seams.
- Parts that are untested or hard to test through their current interface.

Apply the deletion test to each suspect. Write each candidate as a card:

| Field | Content |
|---|---|
| Files | The modules involved |
| Problem | The friction, in glossary and vocabulary terms |
| Solution | What would change, in plain words (no interface yet) |
| Benefits | Locality and leverage, and how the tests improve |
| Before and after | A small diagram or file tree showing the shallowness and the deepening |
| Strength | `Strong`, `Worth exploring` or `Speculative` |
| ADR note | Only if it contradicts a recorded decision, and why that is worth reopening |

End with a top recommendation and ask which candidate to explore. Write the report as Markdown in the scratch directory, or as one self-contained HTML file with no external scripts or fonts when diagrams help; keep it out of the repository unless the user asks for it there.

After the user picks, interview them through the decision tree ([interview-and-specs](interview-and-specs.md)): constraints, dependencies, the shape behind the seam, which tests survive. Update the glossary as terms resolve, and offer an ADR when the user rejects a candidate for a reason a future explorer would need.

### Entry-point boundaries for a package layout

For a project organised as packages (or feature folders), make each one a deep module by convention and enforce it with a check ([repo-guardrails](repo-guardrails.md)):

- A package's public surface is its root files (its entry points); anything in a subfolder is private. Several small entry points beat one barrel that re-exports a subtree.
- Code outside a package, and other packages, import only entry points. Its own files import each other freely.
- Tests go through entry points too and may use their own fixtures folder, never internals.
- No dependency cycles. Packages are flat: one tier of children under the root.

## Implementation

Before designing, read the glossary and decision records in the area. State the module's interface in the vocabulary, with a usage example and the invariants, before writing code. When a scan is in scope, collect history hot spots first (recent commit paths), then explore only those areas, and record the candidate cards in the scratch report. For a candidate the user approves, write the new interface and tests first ([test-driven-development](test-driven-development.md)), migrate callers in small steps, then delete the old shallow tests and modules.

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| A seam was added "for flexibility" with one adapter | Remove it; inline until a second adapter is justified |
| Deepening spreads a leaky abstraction (callers still need internals) | The interface is missing an invariant or error mode; widen the interface description, not the surface |
| The scan finds nothing in a small project | Say so and stop; a one-component fix needs no architecture work |
| The user rejects a candidate | Offer an ADR only if the reason is durable; skip ephemeral reasons |
| A candidate contradicts a recorded decision | Mark the conflict; reopen only when the friction is real |
| No isolated workers are available for design-it-twice | Write the designs sequentially, each complete before the next, then compare |

## Verification

- Every design note uses the vocabulary and the project's glossary terms.
- Each proposed seam has two adapters or a stated reason it will.
- A scan report lists candidates with strength and a top recommendation, and proposes no interface before the user picks.
- After a refactor, the preserved-journey tests pass and the old shallow tests are gone.

## Sources

- Adapted and extended from the MIT-licensed `codebase-design`, `improve-codebase-architecture` and `setup-ts-deep-modules` skills by Matt Pocock: the vocabulary, the deletion test, dependency categories, seam discipline, design-it-twice (after John Ousterhout), the scan and report structure, and the entry-point boundary rules. Rewritten for this package with the gate and approval mapping, the host-neutral worker wording and the report format changed. The seam concept is Michael Feathers'.
