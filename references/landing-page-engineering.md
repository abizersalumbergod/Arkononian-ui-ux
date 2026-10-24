# Landing page engineering

How to build marketing, launch, pricing and e-commerce pages that convert: one primary action, a clear message hierarchy, proof where doubt appears, honest commerce flows, crawlable markup and measured events. Visual direction, tokens, motion and component states live in their own modules; this file decides what goes on the page, in what order, and how it is wired.

**Load when:** landing page, homepage, launch/waitlist page, pricing page, product page (PDP), listing page (PLP), cart, checkout, SEO metadata, analytics events on marketing pages. **Owns:** conversion architecture, section blueprints, CTA rules, conversion-form scope, pricing patterns, e-commerce PDP/PLP/cart/checkout patterns, on-page SEO basics (metadata, Open Graph, structured data, headings), marketing analytics event plan, marketing copy rules.
**Related:** [product-discovery](product-discovery.md), [design-intelligence](design-intelligence.md), [typography-and-layout](typography-and-layout.md), [interaction-design](interaction-design.md), [motion-engineering](motion-engineering.md), [image-pipelines](image-pipelines.md), [performance](performance.md), [accessibility](accessibility.md), [security-and-privacy](security-and-privacy.md), [quality-gates](quality-gates.md), [landing-page workflow](../workflows/landing-page.md), [ecommerce workflow](../workflows/ecommerce.md)

## Decision rules

1. Name exactly one primary conversion event per page before designing (take it from [product-discovery](product-discovery.md)). Every section must either move the visitor toward it or answer an objection that blocks it; cut sections that do neither.
2. Give each view one primary CTA. Allow at most one secondary CTA in the hero; never place two equal-weight buttons side by side.
3. Start every CTA label with a verb and name the concrete outcome ("Start free trial", "Add to bag"), never "Submit" or "Learn more" as the primary. The label must match what happens next; if the click opens a form, a sales call or a payment, say so.
4. Make the hero fit the first viewport at 375 and 1280 px with the primary CTA visible without scrolling. Hold it to at most 4 text elements: eyebrow or brand strip, headline, subtext, CTAs. Move trust strips, bullets, avatars and pricing teasers below the fold.
5. If the headline wraps to more than 2 lines on desktop, reduce font size or cut words; do not shrink the CTA or the visual to compensate.
6. Place proof directly after the claim it supports: logo wall directly under the hero, a metric or quote beside each feature claim, security/compliance proof next to the form or pricing. Never cluster all proof in one section at the bottom.
7. Use only real, attributable proof. Never invent testimonials, logos, review counts, ratings, user numbers or "as seen in" badges. If the user has none, use placeholders clearly marked `TODO(content)` and report them.
8. Never ship an inert CTA (Gate B). Every primary button resolves to a working route, form or handler; a missing backend becomes a visible, labelled stub and a report item.
9. Ask only for fields the next step genuinely needs. A waitlist or lead form defaults to email only (default — adjust per product); every extra field needs a stated reason in the brief.
10. Show pricing with the full recurring price, billing period and currency; if a discount depends on annual billing, show both. Never hide mandatory fees until checkout; show taxes and shipping as soon as they can be estimated.
11. Never use fake urgency (countdowns that reset, invented low-stock counts, "3 people are viewing"). Show stock only from real inventory data.
12. On a PDP, keep price, variant selectors, stock state and the add-to-cart button in one visual group; on mobile keep add-to-cart reachable (sticky bar) once the original button scrolls away.
13. Disable a variant-dependent add-to-cart only with a visible reason ("Select a size"); prefer leaving it enabled and showing an inline error on click. Mark unavailable variants as unavailable, not hidden.
14. Always offer guest checkout. Offer account creation after purchase, never as a gate before payment.
15. Keep one H1 per page and a heading outline that mirrors content, never chosen for size. Style with classes, not heading levels.
16. Add structured data only for content visibly on the page, using the type that matches the page (rule table below). Never promise rich results from FAQPage markup.
17. Fire analytics only after consent where consent is required, never send personal data (email, name, phone, address) in event parameters, and name events from the plan below before writing code.
18. Do not hide above-the-fold or LCP content behind an opacity-0 entrance. Scroll reveals apply below the fold only and run once ([motion-engineering](motion-engineering.md) owns timing).

## Specifications

### Above-the-fold contract (source: design-taste-frontend; defaults — adjust per brand)

| Element | Rule |
|---|---|
| Headline | ≤ 2 lines desktop; Tailwind `text-4xl` → `text-5xl` → `text-6xl` (36/48/60 px) across breakpoints; `text-6xl`–`text-7xl` (60–72 px) only for 3–5 word headlines |
| Subtext | ≤ 20 words, ≤ 3–4 lines |
| CTAs | 1 primary + ≤ 1 secondary |
| Text elements | ≤ 4 (eyebrow or brand strip, headline, subtext, CTAs) |
| Top padding | ≤ 96 px (`pt-24`) desktop |
| Visual | A real product shot, demo, illustration or interactive moment. Text plus gradient blob is a placeholder, not a hero |
| Nav | One line from 1024 px; height 64–72 px, cap 80 px; if it does not fit, shorten labels or switch to a menu button |

The hero should show the most characteristic thing of the product's world (a live demo, the product, the result); the big-number-plus-stats hero is only one option (source: frontend-design, Apache-2.0).

### Message hierarchy (top to bottom)

1. What it is and who it is for (headline).
2. The outcome and the main differentiator (subtext).
3. The action (primary CTA) and the risk reducer next to it ("No card required", "Free returns") only when true.
4. Proof (logos, metric, rating with source).
5. How it works (3–4 steps) or the key features, each with its own proof.
6. Objections answered (pricing, security, migration, time to value, support).
7. Final CTA repeating the primary action with the same label.

### Section blueprint library

| Section | Use for | Content shape (defaults — adjust per brand) | Avoid |
|---|---|---|---|
| Hero | Value proposition + action | Contract above | Centred hero by default; use centred only for editorial, manifesto or launch briefs |
| Logo wall | Instant credibility | 5–8 real customer logos, monochrome, one row; own section directly under hero | Logos without permission; "trusted by" with no logos |
| Problem / cost of inaction | Pain the product removes | Headline ≤ 8 words, sub ≤ 25 words, one visual | Fear tactics in product flows |
| How it works | Reduce perceived effort | 3–4 numbered steps with one visual each | More than 5 steps |
| Feature detail | Explain capabilities | Alternate layout families; ≤ 2 consecutive image/text zigzags, then break with full-width, stack, bento or marquee | 3 equal feature cards in a row as the only pattern |
| Bento | Several related features | N items = N cells (3 → 1+2 or 2+1; 5 → 2+3, 3+2 or hero+4); ≥ 2–3 cells with real visual variation | Empty filler cells; white-on-white text cards |
| Testimonial | Proof at an objection | Quote ≤ 3 lines; name + role (+ company); real photo optional | First-name-only attribution; dash flourishes |
| Metrics | Quantified outcome | 3–4 figures with source and period | Unsourced numbers |
| Pricing | Choice and commitment | 2–4 tiers, one marked recommended, monthly/annual toggle, feature comparison behind a disclosure | Large pricing matrix on the marketing page |
| Comparison | Switching from a competitor | Factual table, dated, with sources | Claims you cannot substantiate |
| FAQ | Remaining objections | 5–8 questions as a disclosure list (`<details>` or accessible accordion) | Hiding pricing or terms in FAQ only |
| Final CTA | Close | Same primary label as hero, one risk reducer | New, different offer |
| Footer | Navigation, legal | Legal links, contact, sitemap links | Second hero |

Variety and density (source: design-taste-frontend): an 8-section page uses at least 4 distinct layout families; show the top 3–5 items of any long list with a "view all" link; turn more than 5 items into tabs, grouped columns, accordions, a carousel or a card grid; group 10 specs into about 3 clusters or 3–4 featured tiles plus a disclosure; use one divider style, never a hairline under every row. Grids, spacing and type scale belong to [typography-and-layout](typography-and-layout.md).

### Objection handling map

| Objection | Answer with | Place it |
|---|---|---|
| "Is it worth the price?" | ROI example, plan comparison, free tier/trial terms | Pricing section |
| "Will it work for me?" | Segment-specific case study, integrations list | After features |
| "Is it safe?" | Security/compliance facts with links (only certifications actually held) | Next to forms and pricing |
| "Is it hard to switch?" | Migration steps, import tools, time estimate | How it works / FAQ |
| "What if I don't like it?" | Cancellation, refund or return policy in plain words | Next to CTA and at checkout |

### Pricing patterns

- Default to 3 tiers (default — adjust per product) with the recommended tier visually marked and labelled in text, not colour alone ([accessibility](accessibility.md)).
- Billing toggle: a real radio group or switch with visible labels; annual savings stated as a figure ("Save $48/year"), computed from the actual prices.
- Each tier: name, one-line audience, price + period + currency, primary CTA, 4–6 key inclusions; full matrix behind "Compare all features".
- Enterprise/"Contact sales" tier: say what the visitor gets (call, quote) and the response time only if it is real.

### E-commerce patterns

**PDP (product page)**

| Area | Requirements |
|---|---|
| Gallery | First image is the LCP candidate: preloaded, explicit dimensions, no lazy load; others lazy. Thumbnails are buttons with accessible names; zoom/lightbox is keyboard-operable and closable with Esc; swipe on touch plus arrow buttons. Formats and `srcset` per [image-pipelines](image-pipelines.md). |
| Variants | Size/colour as radio groups (`fieldset` + `legend`), colour swatches with a text label; selection updates price, image, stock and URL (`?variant=` so the page is shareable). Unavailable options stay visible, marked unavailable, with "Notify me" if supported. |
| Price and stock | Current price, compare-at price only if the item was genuinely sold at it, currency, unit price where legally required (EU), stock state from inventory data, delivery estimate when computable. |
| Add to cart | Pending state on click, success feedback announced via `aria-live="polite"` (cart count + mini-cart or toast with "View bag" / "Checkout"), error state with retry on failure. Never navigate away silently. |
| Reviews | Average rating with count and distribution, sort/filter, verified-buyer marker if real; never seed fake reviews. Load the review list below the fold or on interaction. |
| Shipping and returns | Cost or threshold, delivery estimate, return window, all near the add-to-cart group, not only in the footer. |

**PLP (listing) filters**

- Put filter state in the URL query so it survives reload, back and sharing; keep the browser Back button working.
- Show the result count and active filters as removable chips with a "Clear all" control.
- Desktop: sidebar or top bar; mobile: a full-height sheet with an "Apply (N results)" button. Announce result-count changes with `aria-live="polite"`.
- Sort options: relevance, price low→high, price high→low, newest (default — adjust per catalogue). Use pagination or "Load more" over infinite scroll when the footer must stay reachable.
- Empty result: say which filters caused it and offer to remove the last one.

**Cart and checkout**

- Cart: line items with image, variant, quantity stepper (with remove), line price, subtotal, estimated shipping/tax, promo field collapsed by default, and a single "Checkout" primary CTA.
- Checkout: guest first, steps in order contact → shipping → delivery method → payment → review; a progress indicator; order summary visible (collapsible on mobile).
- Use correct `autocomplete` tokens (`email`, `shipping street-address`, `postal-code`, `cc-number` only inside the payment provider's field), `inputmode` for numeric fields, and never block paste. Do not ask for re-entry of data the user already gave (WCAG 2.2 SC 3.3.7 Redundant Entry; see [accessibility](accessibility.md)).
- Payments: use the provider's hosted fields or checkout (Stripe Elements, Shopify Checkout, Adyen and so on); never collect raw card data in your own inputs. Keys and webhook secrets stay server-side ([security-and-privacy](security-and-privacy.md)).
- Errors: inline next to the field with the fix, plus a summary at the top for multi-field errors; payment declines explain what to do next and keep all entered data. Idempotent order submission: disable the pay button while pending and use a server idempotency key so double clicks do not double charge.
- Trust: show accepted payment methods, return policy and contact near the pay button; show the total including tax and shipping before the final confirmation.

### On-page SEO basics (source: ecc:seo, MIT; Google Search Central)

| Item | Rule |
|---|---|
| `<title>` | About 50–60 characters, main topic first: "Primary Topic – Specific Modifier \| Brand" |
| Meta description | About 120–160 characters: action + topic + value + one supporting detail |
| Headings | One H1; H2/H3 follow content hierarchy |
| Intent | One primary intent/keyword per URL; descriptive internal anchor text |
| Canonical | Absolute canonical URL on every indexable page; filtered PLP variants canonicalise to the base listing unless intentionally indexed |
| Open Graph | `og:title`, `og:type`, `og:image`, `og:url` are required by the Open Graph protocol; add `og:description`. Image 1200×630 px is the common default (default — check each platform's current docs) |
| Social card | `twitter:card` = `summary_large_image` when an OG image exists |
| Robots | `noindex` for thank-you, cart, checkout, account and internal search pages |
| Language | `<html lang>` set; `hreflang` only when real translations exist |

Structured data by page type (only for visible content; validate with Google's Rich Results Test, which needs network access and the user's OK to send the URL):

| Page | schema.org type |
|---|---|
| Homepage | `Organization` (or `LocalBusiness` with address/hours) + `WebSite` |
| Article / blog / case study | `Article` or `BlogPosting` |
| Product page | `Product` with `Offer` (`price`, `priceCurrency`, `availability`); `AggregateRating`/`Review` only from real reviews shown on the page |
| Interior pages | `BreadcrumbList` |
| FAQ | Optional; since 2023 Google shows FAQ rich results only for well-known government and health sites, so never claim a SERP gain |

### Analytics event plan

Use the analytics tool the project already has. If none exists, adding one sends visitor data to a third party and requires the user's approval. Default names follow GA4 recommended events so they map to most tools:

| Moment | Event | Key parameters (no PII) |
|---|---|---|
| Primary CTA click | `cta_click` (custom) | `cta_id`, `location` (hero, pricing, final) |
| Lead / waitlist submit success | `generate_lead` | `form_id`, `method` |
| Sign-up success | `sign_up` | `method` |
| Pricing toggle / tier select | `select_content` | `content_type: "plan"`, `item_id` |
| PLP view / item click | `view_item_list` / `select_item` | `item_list_id`, `items[]` |
| PDP view | `view_item` | `currency`, `value`, `items[]` |
| Add / remove | `add_to_cart` / `remove_from_cart` | `currency`, `value`, `items[]` |
| Cart / checkout | `view_cart` / `begin_checkout` / `add_shipping_info` / `add_payment_info` | `currency`, `value`, `items[]` |
| Order complete | `purchase` | `transaction_id`, `currency`, `value`, `items[]` (fire once, server-confirmed) |
| Form error | `form_error` (custom) | `form_id`, `field` (never the value) |

### Marketing page performance budget

Gate E thresholds (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75) and the full budget method live in [performance](performance.md). Marketing-specific defaults (adjust per product):

- LCP element is the hero headline or hero image, rendered in the server HTML, never injected by client JS.
- Initial JS for a static marketing page ≤ 150 KB compressed (default — adjust per product); load chat widgets, review widgets, video players and 3D on interaction or idle.
- Third-party tags (analytics, pixels, A/B tools) load after consent and `afterInteractive`/`lazyOnload`; each one is listed in the report.
- Reserve space for every image, embed, cookie banner and sticky bar so nothing shifts layout.

### Copy rules

- Headline names the outcome or the product category in plain words; avoid slogans that need the subtext to make sense.
- Replace generic buzz phrases (streamline, empower, supercharge, unleash, world-class, next-generation, cutting-edge, seamless, game-changer) with a specific verb + noun of what the product does (source: impeccable copy checks, paraphrased).
- Flag body copy with ≥ 5 em-dashes or ≥ 3 manufactured-contrast aphorisms ("Not an X. A Y.") and rewrite (source: impeccable detector thresholds, advisory).
- Do not open sections with a paragraph that restates the heading.
- Section copy defaults: headline ≤ 8 words, sub ≤ 25 words (source: design-taste-frontend).
- For persuasive sequencing, map formulas to sections: problem → PAS, cost of inaction, solution → before/after/bridge, proof → testimonial stack, close → one clear ask (source: claudekit slides, paraphrased; no licence found).
- Microcopy for form errors, empty and loading states is owned by [interaction-design](interaction-design.md); delegate copy review to `design:ux-copy` when installed ([skill-delegation](skill-delegation.md)).

## Implementation

Detect the project's stack first ([frontend-architecture](frontend-architecture.md)). The examples assume Next.js App Router + React 19 + TypeScript (verify at runtime: `npm view next version`, `npm view react version`); a framework-agnostic variant follows each.

**Metadata (Next.js App Router)**

```tsx
// app/(marketing)/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Invoice automation for small agencies | Brand",
  description: "Send, chase and reconcile invoices automatically. Set up in ten minutes, free for your first 20 clients.",
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", title: "Invoice automation for small agencies",
    images: [{ url: "/og/home.png", width: 1200, height: 630, alt: "Dashboard showing paid invoices" }] },
  twitter: { card: "summary_large_image" },
};
```

Use `generateMetadata` for product pages so title, canonical and OG image come from the product record. Vanilla/other frameworks: emit the same tags in `<head>` (`<title>`, `<meta name="description">`, `<link rel="canonical">`, `<meta property="og:*">`).

**JSON-LD (escape `<` so content cannot break out of the script tag)**

```tsx
type Json = Record<string, unknown>;
export function JsonLd({ data }: { data: Json }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
// <JsonLd data={{ "@context": "https://schema.org", "@type": "Product", name: p.name,
//   image: p.images, offers: { "@type": "Offer", price: p.price.toFixed(2),
//   priceCurrency: p.currency, availability: `https://schema.org/${p.inStock ? "InStock" : "OutOfStock"}` } }} />
```

Vanilla: `script.type = "application/ld+json"; script.textContent = JSON.stringify(data);` (`textContent` does not parse HTML).

**Consent-gated event helper (no PII, never throws)**

```ts
// lib/track.ts
type Params = Record<string, string | number | boolean | unknown[]>;
const PII = /email|phone|name|address|password/i;

export function track(event: string, params: Params = {}): void {
  try {
    if (typeof window === "undefined") return;
    if ((window as any).__consent?.analytics !== true) return; // set by the project's consent banner
    const safe = Object.fromEntries(Object.entries(params).filter(([k]) => !PII.test(k)));
    (window as any).gtag?.("event", event, safe); // or the project's own client
  } catch { /* analytics must never break the page */ }
}
```

**Add to cart with optimistic feedback and rollback (React 19)**

```tsx
"use client";
import { useOptimistic, useState, useTransition } from "react";
import { addToCart } from "./actions"; // server action; returns { ok: boolean; count: number }
import { track } from "@/lib/track";

export function AddToCart({ variantId, count, disabledReason }:
  { variantId?: string; count: number; disabledReason?: string }) {
  const [optimisticCount, setOptimistic] = useOptimistic(count);
  const [status, setStatus] = useState<"idle" | "error" | "added">("idle");
  const [pending, start] = useTransition();
  const onClick = () => {
    if (pending) return; // aria-disabled keeps focus but must also block repeats
    if (!variantId) { setStatus("error"); return; }
    start(async () => {
      setOptimistic(optimisticCount + 1);
      try {
        const res = await addToCart(variantId);
        if (!res.ok) throw new Error("rejected");
        setStatus("added"); track("add_to_cart", { item_id: variantId });
      } catch { setStatus("error"); } // optimistic value reverts when the transition ends
    });
  };
  return (
    <div>
      <button type="button" onClick={onClick} aria-disabled={pending} className="min-h-11">
        {pending ? "Adding…" : "Add to bag"}
      </button>
      <p role="status" aria-live="polite">
        {status === "added" && `Added. ${optimisticCount} items in your bag.`}
        {status === "error" && (variantId ? "Could not add this item. Try again." : disabledReason ?? "Select an option first.")}
      </p>
    </div>
  );
}
```

Revalidate the cart in the server action (`revalidatePath`/`revalidateTag`) so the server count replaces the optimistic one. Without React: disable during the `fetch`, update the count from the response, write the message into a `role="status"` element, and restore the button in `finally`.

**PLP filters in the URL**

```ts
// Client: update one filter without losing others; keeps Back working.
const params = new URLSearchParams(window.location.search);
value ? params.set(key, value) : params.delete(key);
history.pushState(null, "", `?${params.toString()}`); // Next.js: router.push(`?${params}`, { scroll: false })
```

## Failure modes & fallbacks

| Failure | Fix / fallback |
|---|---|
| No real proof, logos or prices supplied | Build the layout with `TODO(content)` placeholders, list them in the report; never fabricate |
| Hero headline wraps to 3–4 lines | Shorten copy first, then step the size down one level; never let the CTA fall below the fold |
| Primary CTA has no backend yet | Wire to a stub route that shows "Coming soon – join the list" or the agreed placeholder; record as a Gate B limitation |
| Hydration mismatch from consent/AB tools | Read consent and variants on the server or after mount; render one stable server HTML |
| Duplicate titles / missing canonical on PLP variants | Generate from the route params; canonicalise filtered views |
| JSON-LD invalid or describing hidden content | Generate it from the same data that renders the page; remove properties not shown |
| Double charge on retry | Server idempotency key per checkout attempt; disable submit while pending |
| Analytics blocked by an ad blocker | `track` is a no-op; never gate UI on analytics calls |
| Payment provider SDK unavailable or no keys | Keep the checkout UI with a clearly labelled test-mode stub; real keys need the user (`requires-credentials`) |
| Third-party widget pushes LCP or CLS over budget | Load on interaction, reserve its box, or replace with a static summary linking out |

## Verification

- Gate B: click every CTA and link in the hero, pricing and final CTA; complete the primary conversion and, for commerce, PDP → add to cart → cart → checkout up to the payment provider's test mode. Record each journey PASS/FAIL. Without a browser tool, mark NOT_TESTED with the reason.
- Gate C: hero contract (lines, element count, CTA above the fold at 375 and 1280 px) checked on screenshots via [visual-testing](visual-testing.md) or `node ../scripts/visual-check.mjs --url <url> --out <dir>`.
- Gate D: one H1, heading order, form labels and errors, `aria-live` announcements for cart and filter changes, variant radio groups operable by keyboard ([accessibility](accessibility.md)).
- Gate E: LCP element identified and server-rendered; lab Lighthouse results labelled as lab ([performance](performance.md)).
- Gate F: sticky add-to-cart and filter sheet tested at 320–375 px and 400% zoom.
- Gate H: no PII in event payloads (inspect network requests if a browser tool is `available-verified`), no secrets in client bundles (`grep` the build output for key prefixes), JSON-LD escaped.
- SEO: view source for `<title>`, description, canonical, OG tags and JSON-LD; validate JSON-LD locally with `JSON.parse`; online validators only with the user's approval to send the URL.

## Sources

- design-taste-frontend (installed skill; licence: none found) — hero limits, nav height, section variety, bento, density and quote rules; numbers kept, wording paraphrased.
- impeccable (installed skill; licence: none found locally, detector scripts Apache-2.0 per SPDX headers) — copy-slop phrase list and em-dash/aphorism thresholds, paraphrased.
- frontend-design (Anthropic official plugin; Apache-2.0) — hero as the most characteristic expression of the subject.
- ecc:seo (ECC plugin 2.2.3; MIT, © 2026 Affaan Mustafa) — title/description lengths, structured data by page type.
- ecc:motion-patterns (MIT) and emil-design-eng (licence: none found) — reveal-once rule, referenced via motion-engineering.
- design:ux-copy (Anthropic design plugin; no LICENSE file, Anthropic-authored) and banner-design (claudekit; MIT) — CTA labelling.
- slides (claudekit; licence: none found) — copy-formula mapping, paraphrased.
- Google Search Central, structured data and FAQ rich result change: https://developers.google.com/search/docs/appearance/structured-data and https://developers.google.com/search/blog/2023/08/howto-faq-changes (cited from prior knowledge, not fetched in this build: verify).
- Open Graph protocol: https://ogp.me/ (cited from prior knowledge, not fetched in this build: verify).
- GA4 recommended events: https://developers.google.com/analytics/devguides/collection/ga4/reference/events (cited from prior knowledge, not fetched in this build: verify).
- WCAG 2.2 SC 3.3.7 Redundant Entry: https://www.w3.org/TR/WCAG22/ (cited from prior knowledge, not fetched in this build: verify).
- Next.js Metadata and JSON-LD guides: https://nextjs.org/docs/app/getting-started/metadata-and-og-images and https://nextjs.org/docs/app/guides/json-ld (cited from prior knowledge, not fetched in this build: verify; verify against the installed Next.js version).
