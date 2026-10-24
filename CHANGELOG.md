# Changelog

All notable changes to the `ultimate-uiux` skill. Dates are ISO 8601.

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
