# Cinematic and 3D workflow

Build immersive experiences: Three.js/R3F scenes, shaders, scroll-driven cinematic stories, product configurators. Write the motion and interaction plan before any code, keep content usable without the effect, and verify fallbacks, reduced motion and per-device budgets before calling it done.

**Load when:** route `immersive-3d` is primary or secondary (3D, WebGL/WebGPU, Three.js, R3F, shaders, immersive, cinematic, scroll story, configurator, particles). **Owns:** the stage order and plan-before-code rule for immersive work; technology, scene and shader detail live in three-dimensional-web, shader-and-creative-coding and motion-engineering.
**Related:** [SKILL.md](../SKILL.md), [landing-page](landing-page.md), [asset-production](asset-production.md), [visual-regression](visual-regression.md)

## When to use

- The experience itself is the product or the hero: a 3D product viewer, configurator, scroll story, generative background, interactive installation.
- "3D landing page": follow [landing-page](landing-page.md) for the page and this workflow for the immersive section only.
- If the user only wants a subtle animation, use [motion-engineering](../references/motion-engineering.md) from the primary workflow; do not reach for WebGL.

## Inputs

- The narrative or interaction goal: what the user should understand, feel or do at each beat.
- Models, textures, HDRIs, footage, or the need to produce them (see [asset-production](asset-production.md)).
- Target devices and audiences (mobile share, low-end hardware, corporate laptops without discrete GPUs).
- Router output, environment audit JSON (3D libraries, Blender or ffmpeg availability). Suggested preset (never forced): `cinematic-noir`; full style language in [cinematic-noir-studio](../../cinematic-noir-studio/SKILL.md) if installed.

## Steps

1. **Discover (stage 1).**
   - Run [route.mjs](../scripts/route.mjs) and [environment-audit.mjs](../scripts/environment-audit.mjs); read [capability-registry](../references/capability-registry.md), [quality-gates](../references/quality-gates.md).
   - Detect existing 3D and animation stack (three, @react-three/fiber, drei, GSAP, Motion, Lenis) and versions; verify versions at runtime with `npm view <pkg> version`, do not assume. Read [frontend-architecture](../references/frontend-architecture.md) if loaded.
   - **Exit check:** stack, versions, run command and verified capabilities (browser for screenshots, GPU-capable environment or not) named.
2. **Understand (stage 2).**
   - Production tier: read [production-readiness](../references/production-readiness.md), set the risk tier (T0-T3) from the facts (server code, personal data, accounts, payments, uploads, tenants, traffic) and record it in the brief or the design decision record. Every build is production-minded; the tier decides the depth.
   - Read [design-intelligence](../references/design-intelligence.md). Confirm 3D earns its place: name the job the effect does (explain a product, set a mood, enable configuration). If no job, recommend a lighter technique and ask.
   - List the content that must remain accessible without the effect (headline, copy, CTA, product facts).
   - **Exit check:** purpose of the effect written; essential content list exists.
3. **Plan: motion and interaction plan before code (stage 3).**
   - Production baseline: plan what the tier needs ([production-readiness](../references/production-readiness.md) §1-2): endpoints and tables, what the host already provides, secrets by name, third parties and the data they receive, the backup and rollback path, the alerts. T1+: [api-protection](../references/api-protection.md); T2+: [security-hardening](../references/security-hardening.md), [database-integrity](../references/database-integrity.md), [devsecops-and-deployment](../references/devsecops-and-deployment.md), [observability-and-alerting](../references/observability-and-alerting.md); T3: [scalability-and-reliability](../references/scalability-and-reliability.md). Privacy starts with the data inventory in [privacy-and-compliance](../references/privacy-and-compliance.md).
   - Write the plan in the [design decision record](../templates/design-decision-record.md) or a section of the [design-brief](../templates/design-brief.md). It must contain:
     - beats or scenes in order, each with trigger (load, scroll range, pointer, click), duration or scroll distance, what moves, and easing (tokens per [motion-engineering](../references/motion-engineering.md));
     - interaction model: input methods (pointer, touch, keyboard), what is controllable, camera limits;
     - technology choice per [three-dimensional-web](../references/three-dimensional-web.md) (CSS/SVG, Canvas 2D, Three.js, R3F, or pre-rendered video) and shader needs per [shader-and-creative-coding](../references/shader-and-creative-coding.md);
     - device tiers and budgets (see step 3 budgets below);
     - fallback ladder: full 3D → reduced (lower DPR, fewer effects) → static poster image or video → plain content;
     - reduced-motion behaviour: what is removed or replaced, never just "slower";
     - asset list with formats and budgets.
   - Budgets: take them from [three-dimensional-web](../references/three-dimensional-web.md) and [performance](../references/performance.md). If neither gives a number for this case, use: GLB ≤ 5 MB per model (asset-validation default), device pixel ratio capped at 2 desktop and 1.5 mobile, a sustained frame-rate target of 60 fps desktop and 30 fps low tier — defaults, adjust per product.
   - **Exit check:** the plan exists in writing with beats, inputs, tiers, budgets, fallback ladder and reduced-motion behaviour. No scene code before this check passes.
4. **Design (stage 4).**
   - Set tokens per [design-tokens](../references/design-tokens.md) (optionally `node <skill-dir>/scripts/build-tokens.mjs --preset <skill-dir>/presets/cinematic-noir.json --out <project>/src/styles`, [build-tokens.mjs](../scripts/build-tokens.mjs)). Text over imagery must pass contrast; the script checks declared pairs.
   - Build the static fallback first: the poster frame plus all essential content, laid out and readable. This is the baseline every tier must at least equal.
   - **Exit check:** the static fallback page works on its own.
5. **Build (stage 5).**
   - Production defaults: build to the sixteen defaults in [production-readiness](../references/production-readiness.md) §2 from the first commit (secrets server-side, authorisation per record, schema validation, rate limits, security headers and CSP, bounded queries and timeouts, no mock data in production paths, a health endpoint, a privacy notice that matches the site). Verify every package name before installing it. Server speed and caching follow [backend-performance](../references/backend-performance.md).
   - Implement the scene per [three-dimensional-web](../references/three-dimensional-web.md): lazy-load the 3D bundle after essential content, detect WebGL/WebGPU support and fall back, cap DPR, pause rendering when off-screen or tab hidden, dispose geometries, materials, textures and render targets on unmount, handle context loss.
   - Implement choreography per [motion-engineering](../references/motion-engineering.md) (GSAP with `@gsap/react` `useGSAP` cleanup, Motion, Lenis or CSS scroll-driven animation as chosen), with cleanup on unmount and route change.
   - Keyboard and touch parity for every interactive control; nothing hover-only.
   - **Exit check:** scene runs at the top tier locally; unmounting the component leaves no running loops or listeners (check renderer info or heap if DevTools MCP is verified).
6. **Assets (stage 6).**
   - Produce or optimise models, textures and footage through [asset-production](asset-production.md); see [asset-generation](../references/asset-generation.md) for route choice. Paid generation needs approval. A model made from a reference image can use the optional [image-to-3d-pipeline](../references/image-to-3d-pipeline.md): the generation is remote on a public Space, so it needs the user's upload approval first.
   - Run `node <skill-dir>/scripts/asset-validation.mjs --manifest <file>` ([asset-validation.mjs](../scripts/asset-validation.mjs)); every critical asset needs a fallback entry.
   - **Exit check:** asset validation passes for critical assets, or failures recorded.
7. **Motion, fallbacks and reduced motion (stage 7).**
   - Implement every rung of the fallback ladder and the reduced-motion behaviour from the plan.
   - Verify each: force no-WebGL (disable in the test browser or stub the capability check), force the low tier, emulate `prefers-reduced-motion: reduce`.
   - **Exit check:** each fallback rung and the reduced-motion path renders essential content and works; evidence recorded per rung.
8. **Run (stage 8).**
   - Start with the project's command; run the production build; check bundle size of the 3D chunk against [performance](../references/performance.md) budgets.
   - **Exit check:** build and run succeed; 3D chunk is split from the initial bundle.
9. **Inspect visually (stage 9).**
   - Run `node <skill-dir>/scripts/visual-check.mjs --url <url> --out <scratch>/visual --axe` and again with `--reduced-motion` ([visual-check.mjs](../scripts/visual-check.mjs)). WebGL canvases may render blank in headless browsers; if so, record "scene render NOT_TESTED in headless" and verify with a headed browser tool if one is `available-verified`.
   - Critique beats with [visual-critique](../references/visual-critique.md) per [visual-testing](../references/visual-testing.md) (capture at multiple scroll positions for scroll stories).
   - **Exit check:** findings logged with severity per tier and per beat.
10. **Validate and repair (stage 10).**
   - Production checks: run `node <skill-dir>/scripts/baseline-check.mjs --project <dir> --tier <n> [--built <build-dir>]`, the dependency audit and a secret scan, check headers with `curl -sI` on the preview, run the authorisation and validation tests and, from T2, the load test at expected peak ([load-and-qa-testing](../references/load-and-qa-testing.md)) against an authorised target only. Fix failures at the root; a missing tool is NOT_TESTED, not a pass.
    - Gates B-H per [quality-gates](../references/quality-gates.md). Gate E for immersive pages needs device budgets and a cheaper fallback (SKILL.md §8). Measure frame time and long tasks with a performance trace if DevTools MCP is verified; otherwise NOT_TESTED. LCP must come from content, not the canvas.
    - [accessibility](../references/accessibility.md): canvas has a text alternative or is `aria-hidden` with equivalent content nearby; no flashing above three per second (WCAG 2.3.1); controls keyboard operable. [responsive-design](../references/responsive-design.md): matrix and touch.
    - **Exit check:** no unresolved critical findings; budgets met or exceptions recorded with reason.
11. **Deliver (stage 11).**
   - Readiness report: fill [the template](../templates/production-readiness-report.md), scaled to the tier. READY only when every applicable checklist row has evidence ([production-readiness](../references/production-readiness.md) §4). Deploying needs the user's approval naming the target; the sign-off line is written only against a named owner who said so.
    - Validate with `node <skill-dir>/scripts/quality-report.mjs --report <path>` ([quality-report.mjs](../scripts/quality-report.mjs)).
    - **Exit check:** report validates; untested tiers and devices named.

## Modules to load

- Always: [quality-gates](../references/quality-gates.md), [capability-registry](../references/capability-registry.md).
- Route: [design-intelligence](../references/design-intelligence.md), [three-dimensional-web](../references/three-dimensional-web.md), [shader-and-creative-coding](../references/shader-and-creative-coding.md), [motion-engineering](../references/motion-engineering.md), [asset-generation](../references/asset-generation.md), [performance](../references/performance.md), [accessibility](../references/accessibility.md), [responsive-design](../references/responsive-design.md), [visual-testing](../references/visual-testing.md).
- As needed: [image-to-3d-pipeline](../references/image-to-3d-pipeline.md) for a GLB made from a reference image, [video-pipelines](../references/video-pipelines.md) for pre-rendered fallbacks, [audio-pipelines](../references/audio-pipelines.md) for sound, [troubleshooting](../references/troubleshooting.md).
- Delegate skills, only if installed ([skill-delegation](../references/skill-delegation.md)): `cinematic-noir-studio`, `frontend-design`, `emil-design-eng`, `design-taste-frontend`.
- Production: [production-readiness](../references/production-readiness.md) for every site or app build; add [security-hardening](../references/security-hardening.md), [api-protection](../references/api-protection.md), [database-integrity](../references/database-integrity.md), [backend-performance](../references/backend-performance.md), [scalability-and-reliability](../references/scalability-and-reliability.md), [devsecops-and-deployment](../references/devsecops-and-deployment.md), [observability-and-alerting](../references/observability-and-alerting.md), [load-and-qa-testing](../references/load-and-qa-testing.md) and [privacy-and-compliance](../references/privacy-and-compliance.md) as the tier and the router direct.

## Approvals needed

- Paid generation of models, textures, HDRIs, footage or audio (see [asset-production](asset-production.md)).
- Uploading private models or brand files to a third-party converter or generator (`third-party-upload`).
- Licensed assets with cost (`spend`); deploying or publishing.
- Security probing or load tests against anything but localhost or the user's own staging; rotating or changing secrets; changing production infrastructure, permissions or account settings; production data migrations or deletions; provisioning paid infrastructure or a new monitoring service ([production-readiness](../references/production-readiness.md) rules 7-8).

## Done when

- The written motion and interaction plan exists and the build matches it (or deviations are recorded).
- Every fallback rung and the reduced-motion path verified with evidence; essential content usable on every rung.
- Device budgets met per tier, or each exception recorded; Gate E includes a cheaper fallback.
- Gate B PASS (controls and CTAs work on all tiers), Gate D PASS or NOT_TESTED with reason, Gate F PASS, Gate G PASS for critical 3D assets, Gate H PASS (no leaks after unmount, no console errors, context loss handled).
- Gate C PASS, or scene visuals NOT_TESTED where only headless rendering was available.
- The risk tier is recorded; every applicable row of the readiness checklist has evidence or a reason ([production-readiness](../references/production-readiness.md) §4); `baseline-check` reports no failures.

## Report

SKILL.md §9 plus: link to the motion and interaction plan; technology choice and why; tiers, budgets and measured results per tier (lab, labelled); fallback ladder with evidence per rung; reduced-motion behaviour; asset provenance; devices and browsers not tested.
