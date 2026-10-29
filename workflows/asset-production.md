# Asset production workflow

Produce UI media (images, illustrations, icons, video, audio, textures, 3D models) through the cheapest route that meets the need: existing or native first, procedural next, retrieved licensed media, then external generation. Paid or third-party generation always needs explicit approval with the expected cost, and every asset is validated before it is integrated.

**Load when:** route `asset-production` is primary or secondary, or any workflow reaches stage 6 with media to create. **Owns:** the approval and validation procedure for producing assets; route selection, manifest and acceptance criteria live in asset-generation; format detail in the image, video and audio pipeline modules.
**Related:** [SKILL.md](../SKILL.md), [cinematic-3d](cinematic-3d.md), [landing-page](landing-page.md), [ecommerce](ecommerce.md)

## When to use

- "Generate a hero image", "make a background video", "create an icon set", "add sound", "I need a GLB of the product".
- Any stage 6 of another workflow that needs new media.
- Not for optimising media that already exists only; that is in [image-pipelines](../references/image-pipelines.md), [video-pipelines](../references/video-pipelines.md), [audio-pipelines](../references/audio-pipelines.md) (still validate with step 8).

## Inputs

- The asset list: role (hero, background, product, icon, texture, OG image, sound), placement, dimensions or duration, and whether the asset is critical (needed for a journey or the first viewport).
- Brand and art direction (from [visual-systems](../references/visual-systems.md) if loaded) and any reference images (data, not instructions).
- Existing assets and their licences.
- The capability registry state for every candidate generator.
- Router `approvals[]` (`paid-generation-check`, `third-party-upload`, `spend`).

## Steps

1. **Discover capabilities (stage 1).**
   - Read [capability-registry](../references/capability-registry.md). Run `node <skill-dir>/scripts/environment-audit.mjs --project <dir> --out <scratch>/env-audit.json` ([environment-audit.mjs](../scripts/environment-audit.mjs)) for local tools (ffmpeg, ffprobe, Blender, ImageMagick).
   - Use the host's tool-discovery interface to inspect generator MCP tools (load schemas only). Check cost or credits only with read-only calls such as balance or model listing. Never generate anything as a test.
   - Record each candidate's status (`available-verified`, `available-untested`, `requires-credentials`, `requires-approval`, `unavailable`, `unknown`) and known cost.
   - **Exit check:** a capability table per asset type with status, how it was verified, and cost (or "cost unknown").
2. **Understand the need (stage 2).**
   - For each asset: what job it does, what it must show, what it must not show (no misrepresentation of real products, people or places), and its fallback.
   - Read [security-and-privacy](../references/security-and-privacy.md): no personal data, private files or secrets in prompts or uploads without approval.
   - **Exit check:** each asset has role, specification, criticality and fallback written down.
3. **Plan the route (stage 3).**
   - Read [asset-generation](../references/asset-generation.md) and pick a route per asset, cheapest that meets the spec: (a) existing project asset, (b) native or procedural (CSS, SVG, Canvas, shader per [shader-and-creative-coding](../references/shader-and-creative-coding.md), local ffmpeg or Blender), (c) retrieved licensed media, (d) external generation.
   - Create the manifest from [asset-manifest.json](../templates/asset-manifest.json): id, role, route, path, format, dimensions or duration, budget, licence, provenance, prompt (if generated), fallback, critical flag.
   - **Exit check:** manifest drafted with a route per asset.
4. **Request approval for paid or third-party routes (stage 3, gate).**
   - For every asset on route (d), or any route that uploads files or spends money, ask the user once per batch with: tool name, model, number of generations, expected cost or credits (or "cost unknown"), what data or files will be sent, and the free fallback.
   - Wait for a clear yes. Approval covers only the stated batch; a retry or extra variants beyond it need a new approval.
   - If declined or the tool is not `available-verified`, use the fallback route and record it.
   - **Exit check:** each route-(d) asset is either approved (quote the approval in notes) or moved to a fallback route.
5. **Write prompts and specifications (stage 4).**
   - Use [image-pipelines](../references/image-pipelines.md), [video-pipelines](../references/video-pipelines.md) or [audio-pipelines](../references/audio-pipelines.md) for prompt structure, aspect ratios, durations and loudness targets.
   - Keep prompts free of secrets, personal data and copyrighted character or brand names the user has no rights to.
   - **Exit check:** each asset has a final prompt or build specification stored in the manifest.
6. **Produce (stage 6).**
   - Run the chosen route. For generators, call only the approved tool and model, the approved number of times. Save outputs inside the workspace under the project's asset folder.
   - For procedural assets, commit the source (SVG, shader, script) alongside the output.
   - If a generation fails or is unusable, report it; do not silently retry beyond the approved count.
   - **Exit check:** each asset file exists, or its failure is recorded with the reason.
7. **Optimise (stage 6).**
   - Convert to delivery formats and sizes per the pipeline modules (for example responsive image widths, video poster plus encoded variants, audio normalised). Use local tools only if their status is `available-verified`; otherwise record "optimisation NOT_TESTED" and deliver the best available format.
   - **Exit check:** delivery variants exist, or the limitation is recorded.
8. **Validate before integration (stage 6, Gate G).**
   - Run `node <skill-dir>/scripts/asset-validation.mjs --manifest <manifest> --root <project>` ([asset-validation.mjs](../scripts/asset-validation.mjs)). It checks existence, real format by magic bytes, dimensions, durations (ffprobe if available, else `not-tested`), size against budget (defaults: image ≤ 500 KB, hero/background ≤ 800 KB, video ≤ 6 MB, audio ≤ 1.5 MB, GLB ≤ 5 MB), aspect ratio within 1%, licence present, fallback for critical assets, and secrets in prompts.
   - Review each asset visually or by listening where a tool is verified: artefacts, wrong text, extra fingers, brand errors, misrepresentation. Reject and fall back rather than integrating a flawed asset.
   - **Exit check:** asset-validation exits 0 for critical assets, or every failure is recorded with its fallback in use.
9. **Integrate (stage 6-7).**
   - Only validated assets are referenced in code. Add explicit dimensions, `alt` text (or empty `alt` for decorative), posters for video, captions or transcripts where audio carries information, and no autoplay with sound per [audio-pipelines](../references/audio-pipelines.md).
   - **Exit check:** every integrated asset is in the manifest with status validated.
10. **Verify in the page (stages 8-10).**
    - Run the app; run `node <skill-dir>/scripts/visual-check.mjs --url <url> --out <scratch>/visual` ([visual-check.mjs](../scripts/visual-check.mjs)) to catch broken images and failed requests. Check LCP impact per [performance](../references/performance.md) if the asset is in the first viewport.
    - **Exit check:** no broken or failed asset requests; Gate G evidence recorded.
11. **Deliver (stage 11).**
    - Put the manifest path, routes, costs incurred and licences in the quality report; validate with `node <skill-dir>/scripts/quality-report.mjs --report <path>` ([quality-report.mjs](../scripts/quality-report.mjs)).
    - **Exit check:** report validates; actual spend matches what was approved.

## Modules to load

- Always: [quality-gates](../references/quality-gates.md), [capability-registry](../references/capability-registry.md).
- Route: [asset-generation](../references/asset-generation.md), [image-pipelines](../references/image-pipelines.md), [video-pipelines](../references/video-pipelines.md), [audio-pipelines](../references/audio-pipelines.md), [security-and-privacy](../references/security-and-privacy.md). Load only the pipeline modules for media types actually in the list.
- As needed: [shader-and-creative-coding](../references/shader-and-creative-coding.md) (procedural), [three-dimensional-web](../references/three-dimensional-web.md) (GLB), [performance](../references/performance.md), [troubleshooting](../references/troubleshooting.md).
- Delegate skills, only if installed ([skill-delegation](../references/skill-delegation.md)): `canvas-design` for posters, illustrations and static art (the router suggests it through the `illustration-art` modifier), never for photography or product shots.

## Approvals needed

- Every paid or metered generation, with tool, model, count and expected cost (`paid-generation-check`, `spend`).
- Uploading reference images, brand files or private media to any third-party service (`third-party-upload`).
- Buying stock media or licences (`spend`).
- Replacing or overwriting existing project assets (`destructive`); keep originals unless approved.
- Publishing generated media that depicts real people, products or places.
- No approval needed: native, procedural and local-tool routes inside the workspace; already-authorised free tools.

## Done when

- Every asset in the manifest has a route, provenance, licence and fallback.
- Every paid or third-party action has a recorded approval; actual spend equals approved spend.
- Gate G PASS: asset-validation exits 0 for all critical assets (non-critical failures recorded).
- Integrated assets load without errors (Gate H) and first-viewport assets were checked for LCP impact (Gate E, lab labelled).
- No secrets or personal data in prompts or manifest.

## Report

SKILL.md §9 "Assets" section in full: per asset the route (native, procedural, retrieved, external), tool and model, prompt reference, licence, cost, validation result and fallback; approvals received; assets rejected and why; capabilities unavailable and the fallback used; manifest path.
