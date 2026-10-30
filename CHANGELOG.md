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
- Companion skills for site building: `references/companion-skills.md` (stage map, which skills only the user can invoke, voice and scope rules, approval limits, gap-filling with `find-skills`), router modifiers `copy-and-voice`, `growth-and-conversion`, `code-quality` and `session-tools`, a `tracker-or-pr` approval, more `system-install` patterns, delegation rows and registry entries, and workflow steps for the mattpocock skills (including `improve-codebase-architecture`), `media-use`, `ponytail`, `humanizer`, the marketing and SEO set, `caveman`, `claude-mem` and `find-skills`. Installed on 2026-10-30 for Claude Code only; claude-mem runs locally with no account, cloud sync off and telemetry disabled. Not verified: any of these skills driving a full site build.
- Demo and marketing video route built on HyperFrames (HeyGen's open-source HTML-to-video renderer, Apache-2.0): `references/hyperframes-video.md` (engine rules, 60 s+ story spine, pacing and legibility numbers, composition contract, render ladder, approvals, length proof), `workflows/demo-video.md`, the `video-production` router route and `hyperframes` modifier, the `system-install` approval, `scripts/video-check.mjs` (checks a film plan, a HyperFrames project and a rendered file; it reads the duration from the MP4 header, so no ffprobe is needed), `templates/video-spec.json` with its schema, registry entries for the CLI, its skills, hosted render and HeyGen media, delegation rows, a quality-gates mapping for films, and eval scenario 17. A film is planned in numbers, built as source, checked, snapshotted, rendered and measured; the length floor is 60 s. The CLI runs with telemetry off (`HYPERFRAMES_NO_TELEMETRY=1`) and `init --skip-skills`, because by default it reports usage and writes its skills into the home folder of every agent tool it finds. Installing FFmpeg or those skills, hosted render, publish and HeyGen media each need approval. Checked on 2026-10-30 (Windows, Node 24, hyperframes 0.8.221): `init`, `lint`, `check --json` and `snapshot` on a 75 s, 7-scene composition, plus 29 new tests. Not verified: a render (FFmpeg was absent on that machine), `--skip-skills`, hosted render and HeyGen media.
- Behaviour eval results for the 16 scenarios (`evals/results/behavior-2026-10-29.json`, one attempt, graded from plans): 9 passed, 5 unclear, 2 failed; all 10 safety expectations passed. The fixes above address the failures and gaps it found.
- `placeholder` asset source: the manifest schema accepts it, and `asset-validation.mjs` warns until the asset is replaced.
- Pilot build record (`evals/results/pilot-2026-10-29.md`): a waitlist page built by following the skill end to end; gates B, C, D, F, G and H pass, E is NOT_TESTED (lab only before launch). `quality-gates` rule 5 now states that pre-launch field data is NOT_TESTED, matching the workflows.
- Optional image-to-3D pipeline: `references/image-to-3d-pipeline.md`, the Python toolkit in `scripts/image-to-3d/` (`image_to_glb.py` doctor/setup/run, `generate_3d.py`, `process_mesh.py`), the `image-to-3d` router modifier, and registry entries for `gradio_client` and the TRELLIS and Hunyuan3D-2 Spaces. A reference image is sent to a free public Hugging Face Space (remote, quota-limited), then cleaned up in headless Blender; the run writes a manifest entry and receipts. Opt-in; it needs an upload approval naming file and Space, a dry run, one attempt per job, and Python plus Blender only for this route. The default Space no longer has `/image_to_3d`, so endpoints are discovered from its API schema. Python tests in `tests/image-to-3d/` (fake client, recorded schema) run through `tests/image-to-3d.test.mjs`. Not verified: a live generation, the Blender step on a real Blender, the Hunyuan3D-2 backend.
- Optional Gemini stage in the same module (no second module): `scripts/image-to-3d/gemini_media.py` (image generation and editing, video, conversational video edit and extend, promotion with provenance), the `gemini-media` router modifier, a `generator:gemini-interactions` registry entry and `.env.example`. For people with Gemini API access only (Google lists the image and video models as paid-only); without it the normal procedure applies and nothing breaks. Gemini runs first (reference stills, site images, video), then the chosen still feeds the image-to-3D step (`run --reference-asset`). Built from Google's Interactions API pages read on 2026-10-29: the older generateContent and Veo examples are gone and the Veo 3.1 previews were shut down on 2026-10-22. Per-call approval, dry run, per-run caps, one create attempt per job, a job store so a running video is resumed rather than billed again; standard library only; 53 tests against a fake network layer. Not verified: any live Gemini request.

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
