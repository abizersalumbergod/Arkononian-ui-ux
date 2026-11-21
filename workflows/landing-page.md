# Landing page workflow

Build a conversion-focused landing page or marketing site: one clear audience, one primary action, persuasive content structure, fast first render and honest measurement. Content and the conversion path come before decoration.

**Load when:** route `landing-page` is primary (landing page, marketing site, homepage, waitlist, launch or pricing page, hero section, conversion). **Owns:** the stage order for marketing pages; conversion patterns live in landing-page-engineering.
**Related:** [SKILL.md](../SKILL.md), [new-product](new-product.md), [ecommerce](ecommerce.md), [cinematic-3d](cinematic-3d.md), [asset-production](asset-production.md)

## When to use

- A page whose job is a measurable action: sign up, join waitlist, book demo, buy, download, contact.
- "3D landing page" or "cinematic hero": follow this workflow and add [cinematic-3d](cinematic-3d.md) steps for the hero only, with a static fallback.
- Product UI behind login is [dashboard](dashboard.md); a store is [ecommerce](ecommerce.md); improving an existing marketing site is [existing-project](existing-project.md) with this workflow's modules.

## Inputs

- Offer, audience, primary conversion event and secondary action; proof assets (testimonials, logos, metrics) and their permission to use.
- Brand assets or references; copy if supplied (otherwise draft copy and label it draft).
- Router output, environment audit JSON, and the form or signup backend if one exists.
- Suggested presets (never forced): `precision-saas`, `monochrome-editorial`, `warm-commerce` from [presets/README.md](../presets/README.md).

## Steps

1. **Discover (stage 1).**
   - Run [route.mjs](../scripts/route.mjs) (`node <skill-dir>/scripts/route.mjs "<request>" --pretty`) and [environment-audit.mjs](../scripts/environment-audit.mjs). Read [capability-registry](../references/capability-registry.md) and [quality-gates](../references/quality-gates.md).
   - Inspect any existing project (framework, styling, analytics already installed). Read [frontend-architecture](../references/frontend-architecture.md) if the router added it.
   - **Exit check:** stack, run command and verified capabilities named.
2. **Understand (stage 2).**
   - Production tier: read [production-readiness](../references/production-readiness.md), set the risk tier (T0-T3) from the facts (server code, personal data, accounts, payments, uploads, tenants, traffic) and record it in the brief or the design decision record. Every build is production-minded; the tier decides the depth.
   - Craft modules ([craft-library](../references/craft-library.md)): [positioning-and-research](../references/positioning-and-research.md) for positioning and audience language; for a vague or risky brief run the decision-tree interview in [interview-and-specs](../references/interview-and-specs.md) first.
   - Read [product-discovery](../references/product-discovery.md). Define the audience, the single primary conversion event, objections to answer and the proof available. Fill [design-brief](../templates/design-brief.md).
   - Never invent testimonials, customer logos, user counts or metrics. Use clearly labelled placeholders and tell the user.
   - **Exit check:** primary CTA, audience and proof inventory written; fabricated proof is absent.
3. **Plan (stage 3).**
   - Production baseline: plan what the tier needs ([production-readiness](../references/production-readiness.md) §1-2): endpoints and tables, what the host already provides, secrets by name, third parties and the data they receive, the backup and rollback path, the alerts. T1+: [api-protection](../references/api-protection.md); T2+: [security-hardening](../references/security-hardening.md), [database-integrity](../references/database-integrity.md), [devsecops-and-deployment](../references/devsecops-and-deployment.md), [observability-and-alerting](../references/observability-and-alerting.md); T3: [scalability-and-reliability](../references/scalability-and-reliability.md). Privacy starts with the data inventory in [privacy-and-compliance](../references/privacy-and-compliance.md).
   - Read [landing-page-engineering](../references/landing-page-engineering.md). Choose the section order (value proposition, proof, how it works, objections or FAQ, pricing if relevant, final CTA) from that module, adapted to the offer.
   - Plan the conversion path end to end: CTA → form or destination → success and error states → confirmation. Decide where form data goes; a new external service needs approval.
   - Plan SEO basics (title, meta description, Open Graph image, headings, structured data where relevant) per landing-page-engineering.
   - Record direction and section rationale in a [design decision record](../templates/design-decision-record.md); write acceptance criteria with [acceptance-checklist](../templates/acceptance-checklist.md).
   - **Exit check:** section list, conversion path and acceptance criteria exist.
4. **Design (stage 4).**
   - Read [design-intelligence](../references/design-intelligence.md) and [visual-systems](../references/visual-systems.md). The direction follows the offer and audience; a B2B tool and a fashion launch should not look alike.
   - Read [design-tokens](../references/design-tokens.md); if a preset fits, run `node <skill-dir>/scripts/build-tokens.mjs --preset <skill-dir>/presets/<name>.json --out <project>/src/styles` ([build-tokens.mjs](../scripts/build-tokens.mjs)) and fix contrast failures.
   - Read [typography-and-layout](../references/typography-and-layout.md). Build the hero plus primary CTA first, with real or draft copy, at mobile width.
   - **Exit check:** tokens in code; hero and primary CTA render at 375 px and 1280 px.
5. **Build (stage 5).**
   - Production defaults: build to the sixteen defaults in [production-readiness](../references/production-readiness.md) §2 from the first commit (secrets server-side, authorisation per record, schema validation, rate limits, security headers and CSP, bounded queries and timeouts, no mock data in production paths, a health endpoint, a privacy notice that matches the site). Verify every package name before installing it. Server speed and caching follow [backend-performance](../references/backend-performance.md).
   - Craft modules: draft copy with [copywriting](../references/copywriting.md), then run [prose-humanizing](../references/prose-humanizing.md) on it (facts, numbers, quotes and legal text stay as supplied); [seo-and-discoverability](../references/seo-and-discoverability.md) for structured data; [conversion-optimization](../references/conversion-optimization.md) for forms, sign-up and overlays; [test-driven-development](../references/test-driven-development.md) for logic that can break; [lean-code](../references/lean-code.md) for the smallest sufficient code, never at the cost of a gate item.
   - Build remaining sections as reusable components with semantic landmarks (`header`, `main`, `section` with headings, `footer`).
   - Read [interaction-design](../references/interaction-design.md) for the form: labels, inline validation, submitting, success, error and duplicate-submit handling. Read [security-and-privacy](../references/security-and-privacy.md) when the router adds it (forms, payments, user data): no keys in the client, server-side submission, consent where required.
   - Every CTA links to a real destination or a working form. Anchor links scroll to existing targets.
   - **Exit check:** primary conversion path works locally end to end (to a local or approved endpoint); no inert CTAs.
6. **Assets (stage 6).**
   - Hero image, product shots, OG image, illustrations: follow [asset-production](asset-production.md). Formats and responsive `srcset`/`sizes` per [image-pipelines](../references/image-pipelines.md) when loaded.
   - The LCP element (usually hero image or headline) must not be lazy-loaded; see [performance](../references/performance.md).
   - Run `node <skill-dir>/scripts/asset-validation.mjs --manifest <file>` ([asset-validation.mjs](../scripts/asset-validation.mjs)). Default budget from the script: image ≤ 500 KB, hero/background ≤ 800 KB, video ≤ 6 MB — adjust per product.
   - **Exit check:** critical assets validate, or failures recorded.
7. **Motion and 3D (stage 7).**
   - Optional. Read [motion-engineering](../references/motion-engineering.md) if the router added it. Motion must not delay the headline or CTA from being visible and usable.
   - A 3D or video hero follows [cinematic-3d](cinematic-3d.md) or [video-pipelines](../references/video-pipelines.md) with a static poster fallback.
   - **Exit check:** reduced-motion path verified; content readable with JavaScript disabled or still loading where the stack allows SSR.
8. **Run (stage 8).**
   - Start with the project's command; run the production build; check metadata renders in the HTML output.
   - **Exit check:** build and run succeed; no blocking errors; title and meta description present.
9. **Inspect visually (stage 9).**
   - Run `node <skill-dir>/scripts/visual-check.mjs --url <url> --out <scratch>/visual --axe` ([visual-check.mjs](../scripts/visual-check.mjs)), plus `--reduced-motion` if motion exists. Exit 4 = BLOCKED; fall back per [visual-testing](../references/visual-testing.md) or mark NOT_TESTED.
   - Critique with [visual-critique](../references/visual-critique.md): is the value proposition and CTA visible in the first viewport at 375 and 1280 px? Is hierarchy clear?
   - **Exit check:** findings logged with severity.
10. **Validate and repair (stage 10).**
   - Production checks: run `node <skill-dir>/scripts/baseline-check.mjs --project <dir> --tier <n> [--built <build-dir>]`, the dependency audit and a secret scan, check headers with `curl -sI` on the preview, run the authorisation and validation tests and, from T2, the load test at expected peak ([load-and-qa-testing](../references/load-and-qa-testing.md)) against an authorised target only. Fix failures at the root; a missing tool is NOT_TESTED, not a pass.
    - Craft modules: [seo-and-discoverability](../references/seo-and-discoverability.md) and [conversion-optimization](../references/conversion-optimization.md) on the built page, the seven sweeps in [copywriting](../references/copywriting.md) with [prose-humanizing](../references/prose-humanizing.md) for a copy sweep, [review-and-handoff](../references/review-and-handoff.md) on the diff, [bug-diagnosis](../references/bug-diagnosis.md) for a failing gate. Once the app runs and has grown past a handful of components, offer the architecture scan in [codebase-design](../references/codebase-design.md) and refactor only the candidate the user picks.
    - Gates B-H per [quality-gates](../references/quality-gates.md). [accessibility](../references/accessibility.md): form labels, error announcement, focus order, contrast. [performance](../references/performance.md): LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (Core Web Vitals, p75 field; lab labelled lab). [responsive-design](../references/responsive-design.md): matrix plus 320 px reflow.
    - **Exit check:** no unresolved critical findings in scope.
11. **Deliver (stage 11).**
   - Readiness report: fill [the template](../templates/production-readiness-report.md), scaled to the tier. READY only when every applicable checklist row has evidence ([production-readiness](../references/production-readiness.md) §4). Deploying needs the user's approval naming the target; the sign-off line is written only against a named owner who said so.
    - Craft modules: [launch-and-distribution](../references/launch-and-distribution.md) for the launch checklist (the publish itself still needs approval); [measurement-and-tracking](../references/measurement-and-tracking.md) only with approval for any script that sends visitor data; [review-and-handoff](../references/review-and-handoff.md) for a pull-request body and the handoff note when the session ends.
    - Validate the report with `node <skill-dir>/scripts/quality-report.mjs --report <path>` ([quality-report.mjs](../scripts/quality-report.mjs)). Do not deploy without approval.
    - **Exit check:** report validates; placeholder copy and proof are listed for the user to replace.

## Modules to load

- Always: [quality-gates](../references/quality-gates.md), [capability-registry](../references/capability-registry.md).
- Route: [product-discovery](../references/product-discovery.md), [design-intelligence](../references/design-intelligence.md), [landing-page-engineering](../references/landing-page-engineering.md), [visual-systems](../references/visual-systems.md), [typography-and-layout](../references/typography-and-layout.md), [design-tokens](../references/design-tokens.md), [interaction-design](../references/interaction-design.md), [responsive-design](../references/responsive-design.md), [accessibility](../references/accessibility.md), [performance](../references/performance.md).
- Common modifiers: [security-and-privacy](../references/security-and-privacy.md) (forms, signup, payments), [motion-engineering](../references/motion-engineering.md), [image-pipelines](../references/image-pipelines.md), [video-pipelines](../references/video-pipelines.md).
- Delegate skills, only if installed ([skill-delegation](../references/skill-delegation.md)): `frontend-design`, `design-taste-frontend`, `impeccable`, `ui-ux-pro-max`, `emil-design-eng`. Modules ([craft-library](../references/craft-library.md)): positioning-and-research, site-structure-and-content, copywriting, prose-humanizing, seo-and-discoverability, conversion-optimization, launch-and-distribution, test-driven-development, lean-code.
- Production: [production-readiness](../references/production-readiness.md) for every site or app build; add [security-hardening](../references/security-hardening.md), [api-protection](../references/api-protection.md), [database-integrity](../references/database-integrity.md), [backend-performance](../references/backend-performance.md), [scalability-and-reliability](../references/scalability-and-reliability.md), [devsecops-and-deployment](../references/devsecops-and-deployment.md), [observability-and-alerting](../references/observability-and-alerting.md), [load-and-qa-testing](../references/load-and-qa-testing.md) and [privacy-and-compliance](../references/privacy-and-compliance.md) as the tier and the router direct.

## Approvals needed

- Connecting a form to a new third-party service (email list, CRM, form backend) or adding analytics or tracking scripts.
- Sending a real test submission to a production list or inbox (`external-message`).
- Paid generation of hero media; buying fonts, stock images or domains (`spend`).
- Deploying or publishing (`publish-deploy`).
- Using real customer names, logos or quotes the user has not confirmed permission for.
- Security probing or load tests against anything but localhost or the user's own staging; rotating or changing secrets; changing production infrastructure, permissions or account settings; production data migrations or deletions; provisioning paid infrastructure or a new monitoring service ([production-readiness](../references/production-readiness.md) rules 7-8).

## Done when

- Gate B PASS: primary CTA path completes, including success and error states; all CTAs and anchors work.
- Gate C PASS: value proposition and primary CTA visible in the first viewport at 375 and 1280 px; no high-severity visual defects.
- Gate D PASS or NOT_TESTED with reason: form fully keyboard operable with labelled fields and announced errors.
- Gate E: lab LCP, CLS and an interaction measure recorded and labelled; field data NOT_TESTED before launch.
- Gate F PASS across the matrix; Gate G PASS for hero and OG assets; Gate H PASS (no secrets client-side, no console errors).
- The risk tier is recorded; every applicable row of the readiness checklist has evidence or a reason ([production-readiness](../references/production-readiness.md) §4); `baseline-check` reports no failures.

## Report

SKILL.md §9 plus: the conversion path and its tested states; section order and rationale; placeholders still in the page (copy, proof, images) clearly listed; SEO metadata set; where form data goes and whether it was tested against a real endpoint; lab performance numbers labelled lab.
