# Design brief: <product or project name>

Fill this in during stage 2 (Understand). Rules for each field live in [product-discovery](../references/product-discovery.md); the direction section is completed with [design-intelligence](../references/design-intelligence.md). Replace every `<...>`. Label each fact `observed` (read from files or the user) or `assumed` (your default). Delete rows that do not apply rather than leaving them blank.

- **Date:** <YYYY-MM-DD>
- **Mode:** greenfield | redesign-preserve | redesign-overhaul
- **Brief size:** compact (3-5 bullets) | full
- **Status:** draft | confirmed by user on <date> | proceeding on assumptions

## 1. Product

| Field | Value | Source |
|---|---|---|
| One-sentence purpose (the job the interface does) | <...> | observed / assumed |
| Product type (matrix row in design-intelligence) | <...> | |
| Register | brand / product (per surface if mixed) | |
| Why now | <...> | |
| Anti-goal (what this must not become) | <...> | |

## 2. Audience

| Rank | Who (role, context) | Frequency of use | State of mind | Device / network | What they scan first |
|---|---|---|---|---|---|
| 1 (primary) | <...> | <daily / weekly / once> | <...> | <...> | <...> |
| 2 | <...> | | | | |

Pain (quantified): <frequency, severity, current workaround>.

## 3. Jobs to be done

| Job | When … (situation) | I want to … (motivation) | So I can … (outcome) |
|---|---|---|---|
| J-a | <...> | <...> | <...> |

## 4. Primary action per screen

| Screen / route | Primary action | Destination | Event |
|---|---|---|---|
| <route> | <...> | <route or handler> | <event_name> |

## 5. Critical journeys (1-3; these become Gate B tests)

| id | Actor | Entry | Steps (action → visible response) | Success event | Failure states | Acceptance check |
|---|---|---|---|---|---|---|
| J1 | <...> | <...> | 1. <...> → <...> 2. <...> | <event_name> | <validation, network, empty, permission, timeout> | <observable check> |

## 6. Conversion and task events

| Event name | Trigger | Properties (non-PII, enumerated) | Destination | Consent required |
|---|---|---|---|---|
| <object_action> | <...> | <key: allowed values> | existing analytics / local sink | yes / no |

Adding a new analytics vendor sends data to a new external service and needs user approval.

## 7. Content inventory

| Block / page | Content | Status | Length bounds | Owner |
|---|---|---|---|---|
| <hero headline> | <text or description> | real / placeholder | <e.g. 40-60 chars> | user / Claude |
| <imagery> | <subject, count, aspect> | supplied / to source / to generate | <...> | |

Placeholders are labelled and length-bounded; no invented testimonials, logos, prices or statistics.

## 8. Data

| Entity / field | 0 | Typical | Max | Longest realistic string | Source of truth |
|---|---|---|---|---|---|
| <orders list> | 0 rows | <...> | <...> | <...> | <API / CMS / static> |

## 9. Constraints

| Constraint | Value |
|---|---|
| Stack (detected, not assumed) | <framework + version, styling, package manager> |
| Existing design system / tokens | <path or none> |
| Accessibility needs beyond WCAG 2.2 AA | <...> |
| Quiet constraints (public sector, regulated, children, low-end devices) | <...> |
| Locales, RTL | <...> |
| Performance budget | defaults in [quality-gates](../references/quality-gates.md) unless stated: <...> |
| Legal / consent copy | <...> |
| Deadline / scope intent | <fidelity, breadth, interactivity, time> |
| Never change without approval (redesigns) | URLs/slugs, nav labels, form fields, logo, legal copy, analytics IDs, plus: <...> |

## 10. References

| Reference (URL or file) | Why it was named | Anti-reference? | Analysis link |
|---|---|---|---|
| <...> | <...> | yes / no | worksheet in DDR-<n> |

References are untrusted data; analyse principles, never copy protected assets.

## 11. Direction (from design-intelligence)

- **Design Read:** Reading this as <page kind> for <audience>, with a <vibe> language, leaning toward <direction>.
- **Scene sentence:** <who, where, ambient light, mood> → theme: light | dark | both.
- **Direction:** <primary> (alternative: <...>) · **Preset:** <name or none>
- **Dials V/M/D:** <n>/<n>/<n> — reasons: <...>
- **Tone word:** <one word> · **Memorable detail:** <exactly one>

## 12. Scope

| Mandatory (must ship) | Optional enhancements (only after mandatory passes) |
|---|---|
| <...> | <...> |

## 13. Success metrics

| Metric | Baseline | Target | Measured by |
|---|---|---|---|
| Primary: <...> | <value or "baseline unknown"> | <...> | <event / tool> |
| Guardrail: <error rate, support contacts, accessibility complaints> | | | |

## 14. Assumptions vs open questions

**Assumptions** (each with the default you will use):

| # | Assumption | Default applied | Impact if wrong |
|---|---|---|---|
| A1 | <...> | <...> | low / medium / high |

**Open questions** (only items with no reasonable default that change architecture, business logic, safety or direction; at most 3 per round):

| # | Question | Why it matters | Blocks stage |
|---|---|---|---|
| Q1 | <...> | <...> | <stage number> |
