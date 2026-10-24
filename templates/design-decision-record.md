# DDR-<number>: <short decision title>

Design decision record. Write one per major choice (direction, preset, stack-level UI library, navigation model, 3D or heavy motion, a deliberate exception to an anti-generic rule). Keep it short and factual; replace every `<...>`. Guidance: [design-intelligence](../references/design-intelligence.md) (direction, references, exceptions) and [product-discovery](../references/product-discovery.md) (goals, constraints, metrics).

| Field | Value |
|---|---|
| Status | proposed | accepted | superseded by DDR-<n> | rejected |
| Date | <YYYY-MM-DD> |
| Decided by | user / Claude (proposal) / both |
| Scope | <pages, components or whole product> |
| Related brief | <path to design brief> |

## Decision

<One sentence stating what was chosen.>

## Problem

<The product goal or audience task this decision serves, and what goes wrong without it. Cite brief sections (journey ids, metrics, constraints).>

## Constraints

| Constraint | Source | Effect on the decision |
|---|---|---|
| <WCAG 2.2 AA, performance budget, existing tokens, stack, quiet constraint, deadline> | brief §9 / user / project | <...> |

## Alternatives considered

| Option | Summary | Pros | Cons | Rejected because |
|---|---|---|---|---|
| A | <...> | <...> | <...> | <chosen> |
| B | <...> | <...> | <...> | <...> |
| C | <...> | <...> | <...> | <...> |

## Choice and rationale

- **Chosen:** <option>
- **Why:** <link to precedence level in SKILL.md §2 that decided it: safety, user instruction, accessibility, product goal, performance, brand, specialist heuristic, novelty>
- **Direction record (if a direction decision):** Design Read, scene sentence, direction, preset, dials V/M/D with reasons, tone word, memorable detail.
- **Reference analysis (if references were used):** principle / incidental / protected-asset rows with adapt / improve / reject verdicts.
- **Exceptions to defaults (if any):** <rule from the anti-generic list> kept because <brand or user reason>.

## Trade-offs

| We gain | We give up | Mitigation |
|---|---|---|
| <...> | <...> | <fallback, reduced-motion path, cheaper tier> |

## Validation

| Check | Gate (A-H) | Method / tool | Status | Evidence |
|---|---|---|---|---|
| <journey J1 passes with this choice> | B | <browser run / test> | PASS / FAIL / BLOCKED / NOT_TESTED / NOT_APPLICABLE | <path or reason> |
| <contrast and focus> | D | <...> | | |
| <LCP / INP / CLS impact> | E | <lab or field, labelled> | | |
| <no overflow at 320-1920 px> | F | <...> | | |

A status other than PASS needs a reason. Do not mark PASS without evidence produced in this session.

## Revisit when

<Signal that would reopen this decision: metric below target, new audience, accessibility complaint, performance regression, brand change.>
