# E-commerce workflow

Build or improve a store: listing pages, product detail pages, cart and checkout. The buying journey (find → evaluate → add to cart → pay → confirmation) must work end to end before any visual polish, and payment handling must never touch raw card data in your code.

**Load when:** route `ecommerce` is primary (e-commerce, online store, shop, PDP/PLP, cart, checkout, catalogue, Shopify and similar platforms). **Owns:** the stage order for store builds; commerce page patterns live in landing-page-engineering, imagery in image-pipelines.
**Related:** [SKILL.md](../SKILL.md), [landing-page](landing-page.md), [asset-production](asset-production.md), [existing-project](existing-project.md)

## When to use

- New store front end, headless commerce UI, or a single PDP/PLP/cart/checkout build.
- Existing store improvements: run [existing-project](existing-project.md) steps 1-3 first (baseline the buying journey), then continue here from step 4.
- A marketing page that only links to an external store is [landing-page](landing-page.md).

## Inputs

- Commerce platform or backend (Shopify, WooCommerce, Medusa, Saleor, custom API, or none yet) and its SDK already in the project.
- Catalogue structure: categories, product fields, variants (size, colour), inventory, pricing, currency, tax and shipping rules.
- Payment provider and mode. Use the provider's test mode and published test cards only; never real card data.
- Product imagery (supplied, to be shot, or to be generated with approval).
- Router output, environment audit JSON. Suggested preset (never forced): `warm-commerce` ([presets/README.md](../presets/README.md)).

## Steps

1. **Discover (stage 1).**
   - Run [route.mjs](../scripts/route.mjs) and [environment-audit.mjs](../scripts/environment-audit.mjs); read [capability-registry](../references/capability-registry.md), [quality-gates](../references/quality-gates.md).
   - Identify the commerce backend, cart storage (server, cookie, local), and whether checkout is hosted by the provider or embedded.
   - **Exit check:** stack, commerce backend, payment mode (test or none) and verified capabilities named.
2. **Understand (stage 2).**
   - Read [product-discovery](../references/product-discovery.md). Define the shopper, the hero products, the primary conversion (purchase) and secondary (add to wishlist, newsletter).
   - Profile the catalogue: product count, variant combinations, image count per product, out-of-stock behaviour. Without a backend, write fixture products that match the platform schema and label them `FIXTURE`.
   - **Exit check:** buying journey written step by step with success condition; catalogue profile or fixture plan exists.
3. **Plan (stage 3).**
   - Read [landing-page-engineering](../references/landing-page-engineering.md) for PLP, PDP, cart and checkout patterns and SEO (product structured data, canonical URLs for variants).
   - Read [security-and-privacy](../references/security-and-privacy.md): prefer the provider's hosted checkout or hosted payment fields so card data never reaches your servers; secret keys only server-side; prices and totals recomputed server-side, never trusted from the client.
   - Record decisions in a [design decision record](../templates/design-decision-record.md); acceptance criteria via [acceptance-checklist](../templates/acceptance-checklist.md).
   - **Exit check:** page list, cart and checkout architecture, and acceptance criteria exist.
4. **Design and build the buying journey (stage 4).**
   - Read [design-tokens](../references/design-tokens.md); generate tokens with `node <skill-dir>/scripts/build-tokens.mjs --preset <skill-dir>/presets/warm-commerce.json --out <project>/src/styles` ([build-tokens.mjs](../scripts/build-tokens.mjs)) or extend the store's existing theme.
   - Build one product's journey first: PLP card → PDP (gallery, variant selection, price, stock, add to cart) → cart (quantity, remove, totals) → checkout handoff → confirmation, on real or `FIXTURE` data.
   - **Exit check:** one product can be bought end to end in test mode (or reaches the provider's test checkout).
5. **Build (stage 5).**
   - Read [interaction-design](../references/interaction-design.md). Variant selectors: unavailable combinations disabled with reason; price and image update on selection; selection reflected in the URL where the platform supports it.
   - Add-to-cart feedback is announced to screen readers and visible without blocking; cart count updates.
   - States: out of stock, low stock, loading, empty cart, payment failure, network error, price change between cart and checkout.
   - Filters and sort on PLP keep state in the URL; empty results suggest a next action.
   - **Exit check:** every page in the plan works; every state above is implemented.
6. **Assets (stage 6).**
   - Read [image-pipelines](../references/image-pipelines.md): consistent aspect ratio per product grid, responsive `srcset`/`sizes`, explicit width and height to prevent layout shift, modern formats with fallback.
   - Generated product imagery must not misrepresent the real product (colour, size, features); see [asset-production](asset-production.md) and get approval before any paid generation.
   - Run `node <skill-dir>/scripts/asset-validation.mjs --manifest <file>` ([asset-validation.mjs](../scripts/asset-validation.mjs)).
   - **Exit check:** product images validate; misrepresentation risk reviewed; failures recorded.
7. **Motion (stage 7).**
   - Optional and functional: gallery transitions, add-to-cart feedback. See [motion-engineering](../references/motion-engineering.md) if loaded; reduced-motion path required.
   - **Exit check:** reduced motion verified or NOT_APPLICABLE.
8. **Run (stage 8).**
   - Start with the project's command; production build; run the buying journey in test mode with the provider's published test card.
   - **Exit check:** test order reaches confirmation, or the reason it cannot (no test credentials) is recorded as BLOCKED.
9. **Inspect visually (stage 9).**
   - Run `node <skill-dir>/scripts/visual-check.mjs --url <url> --out <scratch>/visual --axe` ([visual-check.mjs](../scripts/visual-check.mjs)) on PLP, PDP, cart and checkout entry. Exit 4 = BLOCKED; fall back per [visual-testing](../references/visual-testing.md).
   - Critique with [visual-critique](../references/visual-critique.md): price, variant and add-to-cart visible without scrolling on mobile PDP; product grid alignment.
   - **Exit check:** findings logged with severity.
10. **Validate and repair (stage 10).**
    - Gates B-H per [quality-gates](../references/quality-gates.md). [accessibility](../references/accessibility.md): variant controls labelled, gallery operable by keyboard, cart updates announced, checkout form labels and errors. [performance](../references/performance.md): LCP ≤ 2.5 s and CLS ≤ 0.1 on PLP and PDP (lab labelled lab). [responsive-design](../references/responsive-design.md): matrix, touch target sizes, 320 px reflow.
    - Recompute a sample cart total (items, tax, shipping, discount) and compare with what the UI shows.
    - **Exit check:** no unresolved critical findings; totals match.
11. **Deliver (stage 11).**
    - Validate with `node <skill-dir>/scripts/quality-report.mjs --report <path>` ([quality-report.mjs](../scripts/quality-report.mjs)).
    - **Exit check:** report validates; test-mode vs live status stated plainly.

## Modules to load

- Always: [quality-gates](../references/quality-gates.md), [capability-registry](../references/capability-registry.md).
- Route: [product-discovery](../references/product-discovery.md), [landing-page-engineering](../references/landing-page-engineering.md), [interaction-design](../references/interaction-design.md), [image-pipelines](../references/image-pipelines.md), [design-tokens](../references/design-tokens.md), [responsive-design](../references/responsive-design.md), [accessibility](../references/accessibility.md), [performance](../references/performance.md), [security-and-privacy](../references/security-and-privacy.md).
- Delegate skills, only if installed ([skill-delegation](../references/skill-delegation.md)): `frontend-design`, `ui-ux-pro-max`, `impeccable`, `design-taste-frontend`.

## Approvals needed

- Any live-mode payment, real order, refund or inventory change; switching from test to live keys.
- Entering or changing payment or platform secrets (names only in reports; values never shown).
- Paid generation of product imagery; publishing generated images that depict real products.
- Connecting new third-party services (reviews, analytics, recommendation engines); deploying.
- Editing the live catalogue or theme on a hosted platform.

## Done when

- Gate B PASS: buying journey reaches confirmation in test mode (or BLOCKED with reason); all states implemented; totals reconcile.
- Gate C PASS; Gate D PASS or NOT_TESTED with reason (variant, gallery, cart and checkout keyboard paths tested).
- Gate E lab LCP and CLS recorded for PLP and PDP; Gate F PASS across the matrix.
- Gate G PASS: every product image in scope resolves, within budget, licensed, accurate.
- Gate H PASS: no secret keys client-side, server-side price computation, no console errors.

## Report

SKILL.md §9 plus: buying journey result and mode (test, fixture or live); payment integration type (hosted, embedded fields, none); states implemented; reconciliation check; catalogue source; imagery provenance and any generated-image disclosure; what must change before going live (keys, legal pages, tax configuration).
