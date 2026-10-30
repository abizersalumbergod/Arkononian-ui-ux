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
   - Companion skills, if installed ([companion-skills](../references/companion-skills.md)): `product-marketing` for positioning and `customer-research` for audience language; for a vague or risky brief the user can run `/grill-me` first.
   - Read [product-discovery](../references/product-discovery.md). Define the audience, the single primary conversion event, objections to answer and the proof available. Fill [design-brief](../templates/design-brief.md).
   - Never invent testimonials, customer logos, user counts or metrics. Use clearly labelled placeholders and tell the user.
   - **Exit check:** primary CTA, audience and proof inventory written; fabricated proof is absent.
3. **Plan (stage 3).**
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
   - Companion skills, if installed: draft copy with `copywriting`, then run `humanizer` on it (facts, numbers, quotes and legal text stay as supplied); `schema` for structured data; `signup` and `popups` for the conversion flow; `tdd` for logic that can break; `ponytail` for the smallest sufficient code, never at the cost of a gate item.
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
    - Companion skills, if installed: `seo-audit` and `cro` on the built page, `copy-editing` with `humanizer` for a copy sweep, `code-review` or `ponytail-review` on the diff, `diagnosing-bugs` for a failing gate. Once the app runs and has grown past a handful of components, offer `/improve-codebase-architecture` (user-invoked) and refactor only the candidate the user picks.
    - Gates B-H per [quality-gates](../references/quality-gates.md). [accessibility](../references/accessibility.md): form labels, error announcement, focus order, contrast. [performance](../references/performance.md): LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (Core Web Vitals, p75 field; lab labelled lab). [responsive-design](../references/responsive-design.md): matrix plus 320 px reflow.
    - **Exit check:** no unresolved critical findings in scope.
11. **Deliver (stage 11).**
    - Companion skills, if installed: `launch` for the launch checklist (the publish itself still needs approval); `analytics` or `conversion-tracking` only with approval for any script that sends visitor data; `pr` for a pull-request body; `/handoff` when the session ends.
    - Validate the report with `node <skill-dir>/scripts/quality-report.mjs --report <path>` ([quality-report.mjs](../scripts/quality-report.mjs)). Do not deploy without approval.
    - **Exit check:** report validates; placeholder copy and proof are listed for the user to replace.

## Modules to load

- Always: [quality-gates](../references/quality-gates.md), [capability-registry](../references/capability-registry.md).
- Route: [product-discovery](../references/product-discovery.md), [design-intelligence](../references/design-intelligence.md), [landing-page-engineering](../references/landing-page-engineering.md), [visual-systems](../references/visual-systems.md), [typography-and-layout](../references/typography-and-layout.md), [design-tokens](../references/design-tokens.md), [interaction-design](../references/interaction-design.md), [responsive-design](../references/responsive-design.md), [accessibility](../references/accessibility.md), [performance](../references/performance.md).
- Common modifiers: [security-and-privacy](../references/security-and-privacy.md) (forms, signup, payments), [motion-engineering](../references/motion-engineering.md), [image-pipelines](../references/image-pipelines.md), [video-pipelines](../references/video-pipelines.md).
- Delegate skills, only if installed ([skill-delegation](../references/skill-delegation.md)): `frontend-design`, `design-taste-frontend`, `impeccable`, `ui-ux-pro-max`, `emil-design-eng`. Companions ([companion-skills](../references/companion-skills.md)): `product-marketing`, `site-architecture`, `copywriting`, `humanizer`, `schema`, `seo-audit`, `cro`, `launch`, `tdd`, `ponytail`.

## Approvals needed

- Connecting a form to a new third-party service (email list, CRM, form backend) or adding analytics or tracking scripts.
- Sending a real test submission to a production list or inbox (`external-message`).
- Paid generation of hero media; buying fonts, stock images or domains (`spend`).
- Deploying or publishing (`publish-deploy`).
- Using real customer names, logos or quotes the user has not confirmed permission for.

## Done when

- Gate B PASS: primary CTA path completes, including success and error states; all CTAs and anchors work.
- Gate C PASS: value proposition and primary CTA visible in the first viewport at 375 and 1280 px; no high-severity visual defects.
- Gate D PASS or NOT_TESTED with reason: form fully keyboard operable with labelled fields and announced errors.
- Gate E: lab LCP, CLS and an interaction measure recorded and labelled; field data NOT_TESTED before launch.
- Gate F PASS across the matrix; Gate G PASS for hero and OG assets; Gate H PASS (no secrets client-side, no console errors).

## Report

SKILL.md §9 plus: the conversion path and its tested states; section order and rationale; placeholders still in the page (copy, proof, images) clearly listed; SEO metadata set; where form data goes and whether it was tested against a real endpoint; lab performance numbers labelled lab.
