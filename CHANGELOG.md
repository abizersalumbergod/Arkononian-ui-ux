# Changelog

All notable changes to the `arkononion-ui-ux` skill. Dates are ISO 8601.

## Unreleased

### Changed
- Renamed the skill to `arkononion-ui-ux` and aligned install instructions with the Agent Skills folder-name requirement.
- Documented personal and project installation for Claude Code and Codex, plus the constraints of other compatible clients.
- Made capability discovery agent-neutral and changed the bundled capability registry to unverified defaults.
- Router: a route scoring 2 or more now joins `secondary` even under a strong primary (a studio homepage keeps `landing-page`, "update the store" keeps `ecommerce`). "Add X to our site" and "style our page" count as existing work. Contact forms, waitlists, newsletters, bookings and carts load the forms modifier, whose note says that connecting them to a provider needs approval.
- Router: modifier notes now appear in `notes`, and the `canvas-design` delegate moved from the `asset-production` route to a new `illustration-art` modifier, so photography requests no longer suggest it.
- asset-generation: ask for a pilot of 2-4 items before a paid batch of more than 4 (rule 18); a count the user states caps the batch (rule 10); when no generator is usable without spend, say so and lead with free routes (rule 19); record placeholders with `source: "placeholder"` (rule 5).
- SKILL.md: a goal statement such as "conversion matters more than anything" stays at precedence level 4; each ask-first action needs its own approval and a deploy is proposed only after the gates; secondary workflows contribute approvals and checks, not build steps; final reports give test counts.
- Variant swatches need a visible non-colour selected state; line charts may use a labelled non-zero baseline; the mobile-first step names fluid type and no horizontal scroll.

### Added
- Behaviour eval results for the 16 scenarios (`evals/results/behavior-2026-10-29.json`, one attempt, graded from plans): 9 passed, 5 unclear, 2 failed; all 10 safety expectations passed. The fixes above address the failures and gaps it found.
- `placeholder` asset source: the manifest schema accepts it, and `asset-validation.mjs` warns until the asset is replaced.
- Pilot build record (`evals/results/pilot-2026-10-29.md`): a waitlist page built by following the skill end to end; gates B, C, D, F, G and H pass, E is NOT_TESTED (lab only before launch). `quality-gates` rule 5 now states that pre-launch field data is NOT_TESTED, matching the workflows.

### Fixed
- `tests/capability-detection.test.mjs` expected an absolute skills-root path, but roots are now reported as labels such as `<project>/.claude/skills`.

## 0.1.0 — 2026-10-24

First release.

### Added
- `SKILL.md` orchestrator: non-negotiable rules, approval boundaries, precedence order, the 11-stage workflow, routing table, quality-gate summary, final report format.
- 27 reference modules in `references/` (each topic has one owner) and 9 workflows in `workflows/`.
- Routing: `routing/routes.json` with 11 task types, keyword modifiers, approval triggers and untrusted-instruction warnings; `scripts/route.mjs`.
- Capability detection: `references/capability-registry.json` (dated snapshot with evidence) and `scripts/environment-audit.mjs`.
- Presets: cinematic-noir, monochrome-editorial, precision-saas, warm-commerce; `scripts/build-tokens.mjs` (CSS custom properties + Tailwind v4 `@theme`, contrast checks).
- Validators: `scripts/validate-skill.mjs` (Gate A), `scripts/asset-validation.mjs` (Gate G), `scripts/quality-report.mjs` (all gates, evidence rules), `scripts/visual-check.mjs` (Playwright: screenshots, overflow, console, broken images, reduced motion, optional axe).
- Generated docs: `scripts/build-docs.mjs` renders `MASTER_INSTRUCTIONS.md` and `references/capability-registry.md` and checks them for drift.
- Schemas, templates, `node:test` suites, and 16 behaviour scenarios in `evals/`.
- Audit of installed skills and dated research (`references/skill-audit.md`); licence policy and attribution (`LICENSES_AND_PROVENANCE.md`).
