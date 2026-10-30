# Dashboard workflow

Build a dashboard, SaaS app, admin panel or internal tool. Build the single most important user journey first, end to end, on real data or clearly labelled fixture data, then widen. Data integrity, states and keyboard operability outrank decoration.

**Load when:** route `dashboard-saas` is primary (dashboard, admin panel, analytics, SaaS app, internal tool, back office, CRUD, data table, KPI, reporting, CRM). **Owns:** the stage order for data-dense product UI; IA, table, chart and CRUD patterns live in dashboard-engineering.
**Related:** [SKILL.md](../SKILL.md), [design-system](design-system.md), [existing-project](existing-project.md), [visual-regression](visual-regression.md)

## When to use

- Authenticated or internal product UI where users monitor, compare, edit or act on data.
- Router warning `data-integrity-risk` or modifier `data-visualisation` present: this workflow plus [dashboard-engineering](../references/dashboard-engineering.md) data rules are mandatory.
- Improving an existing dashboard: start with [existing-project](existing-project.md) steps 1-3, then follow steps 4 onward here.

## Inputs

- The users and their top tasks (what decision or action each screen supports).
- Data sources: API, database, CSV, or none yet. Schema or sample payloads; units, time zones, refresh rate, permissions model.
- Auth and roles (who sees and edits what).
- Router output, environment audit JSON. Suggested preset (never forced): `precision-saas` ([presets/README.md](../presets/README.md)).

## Steps

1. **Discover (stage 1).**
   - Run [route.mjs](../scripts/route.mjs) and [environment-audit.mjs](../scripts/environment-audit.mjs) as in SKILL.md §4; read [capability-registry](../references/capability-registry.md) and [quality-gates](../references/quality-gates.md).
   - Inspect existing data clients, auth, table and chart libraries. Reuse them; do not add a second table or chart library.
   - **Exit check:** stack, data access path, run command and verified capabilities named.
2. **Understand (stage 2).**
   - Read [product-discovery](../references/product-discovery.md). For each user type, name the top 1-3 jobs and the screen that serves them. Pick the most important journey (for example "find an overdue invoice and mark it paid").
   - Profile the data: fields, types, units, null rate, ranges, freshness, volume (row counts drive pagination or virtualisation). If no data exists, write fixture data that matches the real schema and mark it `FIXTURE` in code and UI.
   - **Exit check:** the priority journey is written as steps with a success condition; the data profile or fixture plan exists.
3. **Plan (stage 3).**
   - Read [dashboard-engineering](../references/dashboard-engineering.md). Define IA (navigation, entity pages, list → detail → edit), which metrics appear, chart type per question, table columns, filters, sort and pagination strategy.
   - Read [security-and-privacy](../references/security-and-privacy.md): authorisation is enforced server-side; the UI only hides what the server already denies. No secrets in the client.
   - Write a [design decision record](../templates/design-decision-record.md) for IA and data-display choices; acceptance criteria via [acceptance-checklist](../templates/acceptance-checklist.md).
   - **Exit check:** IA map, metric definitions (formula, unit, period) and acceptance criteria exist.
4. **Design and build the priority journey (stage 4).**
   - Read [design-tokens](../references/design-tokens.md) and [typography-and-layout](../references/typography-and-layout.md). Generate tokens (`node <skill-dir>/scripts/build-tokens.mjs --preset <skill-dir>/presets/precision-saas.json --out <project>/src/styles`, [build-tokens.mjs](../scripts/build-tokens.mjs)) or extend the project's tokens. Use tabular numerals for figures.
   - Build only the priority journey first, on real data or labelled fixtures: the list, the detail, the action, and the confirmation.
   - Data integrity rules (from dashboard-engineering): show units and time range on every metric; show "last updated" time; render missing values as missing, never as zero; never interpolate or smooth silently; label fixture or sample data visibly.
   - **Exit check:** the priority journey works end to end and its data source (real or `FIXTURE`) is visible.
5. **Build the rest (stage 5).**
   - Read [interaction-design](../references/interaction-design.md). Every data view gets loading (skeleton or spinner per module rules), empty (with a next action), error (with retry), partial and permission-denied states.
   - CRUD: validate on client and server; optimistic updates roll back on failure; destructive actions (delete, archive, bulk operations) require confirmation and, where possible, undo.
   - Tables: keyboard reachable, sortable headers announced, sticky header where long, pagination or virtualisation for large sets per dashboard-engineering thresholds.
   - Charts: follow dashboard-engineering (delegate to `dataviz` if installed): accessible names, a table or text alternative, colour not the only encoding.
   - **Exit check:** every journey in the IA works; every view has all its states implemented.
6. **Assets (stage 6).**
   - Usually limited to icons and empty-state illustrations. Use the project's icon set; new assets go through [asset-production](asset-production.md).
   - **Exit check:** asset validation passes, or NOT_APPLICABLE.
7. **Motion (stage 7).**
   - Keep motion functional (state change, feedback, spatial continuity); see [motion-engineering](../references/motion-engineering.md) if loaded. No decorative motion on data-dense screens. Reduced-motion path required.
   - **Exit check:** reduced motion verified or NOT_APPLICABLE.
8. **Run (stage 8).**
   - Start with the project's command; run the production build; exercise the priority journey against the real backend if access is verified, otherwise against fixtures (say which).
   - **Exit check:** no blocking errors; data source used is recorded.
9. **Inspect visually (stage 9).**
   - Run `node <skill-dir>/scripts/visual-check.mjs --url <url> --out <scratch>/visual --axe` ([visual-check.mjs](../scripts/visual-check.mjs)) on each main view and on the empty, error and loading states (force them with fixtures or query flags). Exit 4 = BLOCKED; fall back per [visual-testing](../references/visual-testing.md).
   - Critique with [visual-critique](../references/visual-critique.md): scanability, alignment of numbers, density, hierarchy of KPIs.
   - **Exit check:** findings logged with severity.
10. **Validate and repair (stage 10).**
    - Gates B-H per [quality-gates](../references/quality-gates.md). [accessibility](../references/accessibility.md): full keyboard path through the priority journey, focus management in dialogs, table semantics, chart alternatives. [performance](../references/performance.md): INP ≤ 200 ms on filter, sort and edit interactions (Core Web Vitals threshold); large lists virtualised. [responsive-design](../references/responsive-design.md): tables and charts usable at 375 px (scroll container, card view or priority columns), no page-level horizontal overflow.
    - Cross-check displayed totals against the source or fixture computation for at least the priority journey's figures.
    - **Exit check:** no unresolved critical findings; displayed numbers match the source.
11. **Deliver (stage 11).**
    - Validate with `node <skill-dir>/scripts/quality-report.mjs --report <path>` ([quality-report.mjs](../scripts/quality-report.mjs)).
    - **Exit check:** report validates; fixture data clearly separated from real data in the report.

## Modules to load

- Always: [quality-gates](../references/quality-gates.md), [capability-registry](../references/capability-registry.md).
- Route: [product-discovery](../references/product-discovery.md), [dashboard-engineering](../references/dashboard-engineering.md), [interaction-design](../references/interaction-design.md), [design-tokens](../references/design-tokens.md), [typography-and-layout](../references/typography-and-layout.md), [responsive-design](../references/responsive-design.md), [accessibility](../references/accessibility.md), [performance](../references/performance.md), [security-and-privacy](../references/security-and-privacy.md).
- Modifiers as returned (for example [motion-engineering](../references/motion-engineering.md), [frontend-architecture](../references/frontend-architecture.md) for a named stack).
- Delegate skills, only if installed ([skill-delegation](../references/skill-delegation.md)): `dataviz`, `ui-ux-pro-max`, `impeccable`, `transitions-dev`, `ecc:frontend-a11y`. Companions ([companion-skills](../references/companion-skills.md)): `tdd`, `ponytail`, `improve-codebase-architecture` (user-invoked).

## Approvals needed

- Connecting to a production database or API with write access; running mutations against real data.
- Deleting, migrating or bulk-editing real records (`destructive`).
- Sending user or business data to a new third-party service (analytics, error tracking, hosted charting).
- Adding or changing secrets, roles or permissions; deploying.

## Done when

- Gate B PASS: the priority journey and every IA journey pass; destructive actions confirm; CRUD errors roll back.
- Data integrity checks pass: units, ranges and freshness shown; missing values shown as missing; fixture data labelled; totals reconciled.
- Gate C PASS; Gate D PASS or NOT_TESTED with reason (keyboard path through the priority journey tested); Gate E interaction latency recorded (lab, labelled).
- Gate F PASS across the matrix; Gate H PASS (no secrets in client, server-side authorisation, no console errors). Gate G PASS or NOT_APPLICABLE.

## Report

SKILL.md §9 plus: the priority journey and its result; data source per view (real, staging or `FIXTURE`); metric definitions; states implemented per view; reconciliation results; which interactions were measured and how; permissions assumptions; anything not connected to a real backend.
