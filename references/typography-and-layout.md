# Typography and layout

Rules for choosing and setting type (families, scale, line-height, tracking, measure, wrapping, numerals, loading) and for arranging it in space (grids, content widths, spacing scale, composition). Use it to turn tokens into readable, rhythmic pages.

**Load when:** landing-page, dashboard-saas, portfolio-editorial, design-system, mobile-responsive and existing-project tasks; any request about fonts, font pairing, type scale, headings, readability, line length, grid, spacing, whitespace, section rhythm or composition. **Owns:** type scales and ratios, fluid type-scale formulas, font selection and pairing, line-height and tracking by size, measure, text wrapping and numerals, font loading for layout stability, grids, content widths, spacing scale, container padding, composition patterns and density caps.
**Related:** [visual-systems](visual-systems.md), [design-tokens](design-tokens.md), [responsive-design](responsive-design.md), [design-intelligence](design-intelligence.md), [accessibility](accessibility.md), [performance](performance.md), [landing-page-engineering](landing-page-engineering.md), [dashboard-engineering](dashboard-engineering.md), [visual-critique](visual-critique.md)

Breakpoint values, touch vs pointer, zoom and reflow behaviour belong to [responsive-design](responsive-design.md); token naming and storage belong to [design-tokens](design-tokens.md). This file supplies the values those systems carry.

## Decision rules

1. **Existing brand fonts and scales win.** Inspect the project's fonts (`next/font`, `@font-face`, `@theme --font-*`, CSS) and type tokens first. Change them only when the brief asks for it (SKILL.md §2, level 2).
2. **Pick the scale ratio by product type.** Product UI and dashboards: fixed rem steps with ratio 1.125-1.2. Brand, marketing and editorial: 1.25, 1.333 or 1.5. Never mix two ratios in one product. Use about five sizes, and at most 3-4 sizes on any one screen.
3. **Use fluid `clamp()` only for display and marketing headings and for section spacing.** Keep body text and product-UI text in fixed rem. Keep each clamp's max ≤ 2.5× its min, the hero max ≤ 6rem (about 96px), and always include a rem term in the preferred value so text still scales with browser zoom.
4. **Body text ≥ 1rem (16px) in rem units.** Never set body copy below 16px on mobile (also avoids iOS input zoom); 14px only for short secondary text, 12px only for sparse captions and labels; nothing below 12px.
5. **Hold the measure at 45-75 characters.** Default prose width `max-width: 65ch`; mobile 35-60 characters is acceptable. Flag anything over 85 characters per line. Scale container and type together so the measure stays in range at every width.
6. **Line-height falls as size rises.** Body 1.5-1.7, headings 1.1-1.3, display 1.0-1.1. Use unitless values. Italic display words with descenders need ≥ 1.1 plus about 4px bottom padding to avoid clipping.
7. **Tracking tightens as size rises; caps open up.** Body 0; display -0.02 to -0.03em, never tighter than -0.04em; all-caps labels +0.05 to +0.12em. Never add > 0.05em to lowercase body text.
8. **One family, or two on a clear contrast axis.** Prefer one family with strong weight and size contrast. Pair only across a real axis (serif + sans, geometric + humanist, condensed + wide, sans + mono for data). Never pair two similar sans faces. Max 3-4 weights in use.
9. **Choose faces deliberately, not by reflex.** For greenfield brand work: write three physical-object brand words, list the three fonts you would reach for by reflex, and reject them if they are generic defaults. Do not default to Inter, or to a serif because the brief says "premium" or "creative"; use a serif when the brand names one or the direction is genuinely editorial, luxury, publication or heritage. These are level-7 heuristics: a preset or the user's choice overrides them.
10. **Emphasise within the family.** Use the same family's italic or bold for emphasis. Never drop a serif word into a sans headline or the reverse. Avoid accent-colouring a single word in every headline.
11. **Check font licences before using a face.** Record the licence (OFL, foundry licence such as Fontshare ITF, commercial) in the DDR. Never self-host a commercial face without a licence the user confirms.
12. **Load fonts without layout shift.** Load only the weights, axes and subsets in use; use `next/font` or self-hosted WOFF2 with `font-display: swap` and a metric-matched fallback. Measure or fit text only after `document.fonts.ready`.
13. **Wrap and number deliberately.** `text-wrap: balance` on h1-h3 and short titles; `text-wrap: pretty` on short/medium body, captions and list items; neither on long prose or code. `font-variant-numeric: tabular-nums` on prices, timers, counters, table columns and any updating number. Never justify body text on the web without `hyphens: auto` and a correct `lang`; default to left-aligned (start-aligned) text.
14. **Space on a 4px base and let gaps encode relationships.** Use the scale 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Tight (4-8) inside a unit, medium (12-16) between related items, wide (24-32) between groups, vast (48+) between sections. Use `gap` instead of sibling margins. Vary spacing for rhythm; equal padding everywhere is a defect.
15. **Grid by dimension.** Flex for one-dimensional rows/stacks, Grid for two-dimensional layouts, named grid lines or areas for page shells, container queries for reusable components, `repeat(auto-fit, minmax(280px, 1fr))` for breakpoint-free card grids.
16. **One max content width per site.** Pick one desktop container (72rem or 80rem by default) plus a prose width (65ch) and a full-bleed option. Body text never touches the viewport edge: keep ≥ 16px side inset (24-32px preferred).
17. **Asymmetric layouts must collapse.** Any offset, overlap, masonry or fractional grid collapses to a single column (full width, 16px side padding) below 768px unless tested otherwise.
18. **Cap content per section.** One heading + 4-6 bullets or 2 short paragraphs per content block; max 6 cards in a grid block; one image block ideally under 60vh. Split the section when a cap is exceeded.
19. **Never fix the height of a text container.** Text must survive user spacing overrides (WCAG 2.2 SC 1.4.12) and 200% zoom (SC 1.4.4) without clipping.
20. **Headings follow document order.** Visual size may differ from level, but never skip heading levels for styling; style with classes, not by picking a smaller `h` tag.

## Specifications

### Scale ratios (base 16px; values in px, round to 0.125rem when tokenising)

| Ratio | Name | Step +1 | +2 | +3 | +4 | +5 | +6 | Use |
|---|---|---|---|---|---|---|---|---|
| 1.125 | major second | 18 | 20.25 | 22.8 | 25.6 | 28.8 | 32.4 | dense product UI |
| 1.2 | minor third | 19.2 | 23 | 27.6 | 33.2 | 39.8 | 47.8 | SaaS, dashboards |
| 1.25 | major third | 20 | 25 | 31.3 | 39.1 | 48.8 | 61 | general marketing, docs |
| 1.333 | perfect fourth | 21.3 | 28.4 | 37.9 | 50.5 | 67.3 | 89.8 | brand, editorial |
| 1.5 | perfect fifth | 24 | 36 | 54 | 81 | — | — | posters, campaign heroes (few steps) |

Impeccable's ranges: brand 1.25-1.5, product 1.125-1.2 fixed rem.

### Reference scale (brand skill, ratio 1.25; default — adjust per brand)

| Token | Size | Weight | Line-height | Tracking | Mobile (< 768px) |
|---|---|---|---|---|---|
| `text-display` | 61px / 3.8125rem | 700 | 1.1 | -0.02em | fluid down to 40px |
| `text-h1` | 49px / 3.0625rem | 700 | 1.2 | -0.02em | 32px |
| `text-h2` | 39px / 2.4375rem | 600 | 1.25 | -0.01em | 24px |
| `text-h3` | 31px / 1.9375rem | 600 | 1.3 | 0 | 20px |
| `text-h4` | 25px / 1.5625rem | 600 | 1.35 | 0 | 20px |
| `text-h5` | 20px / 1.25rem | 600 | 1.4 | 0 | 18px |
| `text-body-lg` | 18px / 1.125rem | 400 | 1.6 | 0 | 18px |
| `text-body` | 16px / 1rem | 400 | 1.5-1.6 | 0 | 16px |
| `text-small` | 14px / 0.875rem | 400-500 | 1.5 | 0 | 14px |
| `text-caption` | 12px / 0.75rem | 500 | 1.4 | +0.01em | 12px |
| `text-overline` (caps) | 12-13px | 500-600 | 1.3 | +0.08em | same |

Product-UI alternative (ui-ux-pro-max): 12 / 14 / 16 / 18 / 24 / 32px; weights 400 body, 500 labels, 600-700 headings. Pick one scale and delete the other.

Heading spacing (brand skill): h1/h2 2rem above, 1rem below; h3/h4 1.5rem above, 0.75rem below; paragraphs 1rem apart. Code blocks 80-100 characters wide.

### Line-height by size

| Size | Line-height | Note |
|---|---|---|
| 12-14px | 1.4-1.6 | small text needs relatively more leading |
| 16-18px body | 1.5-1.7 (long-form 1.6-1.75) | serif body slightly more than sans |
| 20-25px | 1.35-1.4 | |
| 31-39px | 1.25-1.3 | |
| 49-61px | 1.1-1.2 | |
| > 61px display | 1.0-1.1 | ≥ 1.1 when italic descenders are present |

Flag line-height < 1.3 on any text run longer than 50 characters (impeccable detector).

### Tracking by size

| Context | Tracking | Source |
|---|---|---|
| Body, all sizes | 0 (font default) | ui-ux-pro-max, impeccable |
| Small UI text 12-14px | 0 to +0.01em | default — adjust per font |
| H3-H5 | 0 to -0.01em | brand skill |
| H1-H2 | -0.01 to -0.02em | brand skill |
| Display | -0.02 to -0.03em; floor -0.04em | impeccable |
| All caps | +0.05 to +0.12em | impeccable, brand skill |
| Small caps | +0.1em | brand skill |

Variable fonts with an optical-size axis (`opsz`) often need less manual tracking; set `font-optical-sizing: auto` and re-check.

### Measure and readability thresholds

| Check | Target | Flag | Source |
|---|---|---|---|
| Characters per line, desktop prose | 45-75 (≈ 66 ideal) | > 85 | Bringhurst; impeccable |
| Characters per line, mobile | 35-60 | < 30 on body text | ui-ux-pro-max |
| Line length, AAA | ≤ 80 characters | — | WCAG 2.2 SC 1.4.8 (AAA, advisory) |
| Body size | 16px | < 12px anywhere; < 14px on runs > 20 chars | impeccable |
| All caps | labels only | > 30 characters of caps | impeccable |
| Estimated chars/line | container width ÷ (0.5 × font-size) | > 85 | impeccable detector heuristic |

### Fluid clamp() formula

For a size that grows linearly from `minPx` at viewport `minVw` to `maxPx` at `maxVw`:

- slope = (maxPx − minPx) ÷ (maxVw − minVw)
- intercept = minPx − slope × minVw
- value = `clamp(minPx/16 rem, intercept/16 rem + slope×100 vw, maxPx/16 rem)`

Worked defaults (viewport 360 → 1280px or 1440px; adjust per brand):

| Token | Min | Max | clamp() | max/min |
|---|---|---|---|---|
| `text-hero` (360 → 1440) | 40px | 88px | `clamp(2.5rem, 1.5rem + 4.444vw, 5.5rem)` | 2.2 |
| `text-h1` (360 → 1280) | 32px | 56px | `clamp(2rem, 1.413rem + 2.609vw, 3.5rem)` | 1.75 |
| `text-h2` (360 → 1280) | 24px | 40px | `clamp(1.5rem, 1.109rem + 1.739vw, 2.5rem)` | 1.67 |
| `space-section` (360 → 1440) | 48px | 128px | `clamp(3rem, 1.333rem + 7.407vw, 8rem)` | 2.67 (spacing, not text) |

frontend-slides (ECC, MIT) defaults for viewport-filling frames: title `clamp(1.5rem, 5vw, 4rem)`, h2 `clamp(1.25rem, 3.5vw, 2.5rem)`, padding `clamp(1rem, 4vw, 4rem)`, gap `clamp(0.5rem, 2vw, 2rem)`, plus max-height queries at 700/600/500px that shrink padding and titles. Its body clamp starts at 0.75rem; raise the minimum to 1rem. Pure-`vw` preferred values do not respond to zoom; add a rem term before using them for page text.

### Grid and content widths (default — adjust per product)

| Element | Value |
|---|---|
| Columns | 4 (< 768px), 8 (768-1023px), 12 (≥ 1024px); breakpoint values owned by [responsive-design](responsive-design.md) |
| Gutter | 16px mobile, 24px tablet, 32px desktop |
| Outer margin | ≥ 16px mobile (24-32 preferred), 32-64px desktop |
| Prose width | 65ch (≈ 600-720px at 16-18px) |
| Form width | 28-36rem (448-576px) single column |
| Site container | 72rem (1152px, Tailwind `max-w-6xl`) or 80rem (1280px, `max-w-7xl`) |
| Wide / breakout | 90rem (1440px) |
| Card-grid minimum | `minmax(280px, 1fr)` (impeccable) |
| Dashboards | fluid full width with a sidebar from 1024px (ui-ux-pro-max); constrain text cells, not the shell |

### Spacing scale (4px base)

| Token | px | Typical use |
|---|---|---|
| `space-1` | 4 | icon-to-label, inline chips |
| `space-2` | 8 | related items, input internal vertical |
| `space-3` | 12 | list items, button internal |
| `space-4` | 16 | card padding (compact), stacked fields |
| `space-6` | 24 | card padding, group separation |
| `space-8` | 32 | between groups, mobile section padding |
| `space-12` | 48 | section gap (product) |
| `space-16` | 64 | section gap (marketing, density 4-7) |
| `space-24` | 96 | section gap (marketing, airy) |
| `space-32` | 128 | section gap (density 1-3: 128-192) |

Section rhythm by density dial (design-taste-frontend; dials defined in [design-intelligence](design-intelligence.md)): density 1-3 → 128-192px; 4-7 → 64-96px; 8-10 → tight padding, 1px rules instead of cards, tabular numerals.

Container insets (impeccable detector): inside a bordered or filled container, vertical padding ≥ max(4px, 0.3 × font-size), horizontal ≥ max(8px, 0.5 × font-size), 12-16px ideal; text must not sit within 2px of a visible edge. Spacing monotony flag: ≥ 10 spacing usages where one value covers > 60% and ≤ 3 distinct values exist.

### Composition patterns

| Pattern | Use when | Rules |
|---|---|---|
| Centred stack | single message, waitlist, empty state | ≤ 2 lines of headline, measure ≤ 60ch, one CTA |
| Split (6/6 or 5/7) | hero with product visual | text column holds measure; image keeps a fixed aspect ratio; stacks text-first on mobile |
| Asymmetric offset | portfolio, editorial (variance 4-7) | about -2rem overlaps, mixed 4:3 and 16:9 media; collapse < 768px |
| Fractional / masonry | galleries (variance 8-10) | e.g. `2fr 1fr 1fr`; large empty zones (≈ 20vw); keep reading order logical in DOM |
| Bento | feature overview | ≤ 6 tiles; one dominant tile; tiles differ by content, not decoration |
| Editorial column + margin notes | long-form, case studies | 65ch main, 16-20rem aside; aside drops below on mobile |
| Full-bleed breakout | media moments in prose | named grid lines (`full`, `content`); text never full-bleed |
| F-pattern | text-heavy and dashboard pages | key info in first two lines and left edge; left-aligned headings |
| Z-pattern | sparse marketing heroes | logo → nav → headline → CTA on the diagonal |

Variance dial values (design-taste-frontend): 1-3 symmetric 12-col, equal padding, centred; 4-7 offset overlaps and mixed ratios, left-aligned headers over centred data; 8-10 masonry and fractional grids.

## Implementation

Detect the project's stack first ([frontend-architecture](frontend-architecture.md)). Below: Next.js App Router + Tailwind v4, then a vanilla variant. Verify package versions at runtime (`npm view next version`, `npm view tailwindcss version`).

**Fonts with `next/font` (self-hosted at build, no layout shift):**

```tsx
// app/layout.tsx
import { Geist, Geist_Mono } from "next/font/google"; // OFL faces; swap for the brand's faces
const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

```css
/* app/globals.css */
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
}
@theme {
  --text-body: 1rem;      --text-body--line-height: 1.6;
  --text-h2: clamp(1.5rem, 1.109rem + 1.739vw, 2.5rem); --text-h2--line-height: 1.25;
  --text-h1: clamp(2rem, 1.413rem + 2.609vw, 3.5rem);   --text-h1--line-height: 1.2;
  --text-h1--letter-spacing: -0.02em;
}

@layer base {
  h1, h2, h3 { text-wrap: balance; }
  p, li, figcaption { text-wrap: pretty; }
  .prose { max-width: 65ch; }
  .num, td, [data-numeric] { font-variant-numeric: tabular-nums; }
  .display-italic { line-height: 1.1; padding-bottom: 0.25rem; }
}
```

Tailwind v4's default spacing unit is `--spacing: 0.25rem` (4px), so `p-4` = 16px matches the scale above; do not redefine it unless the project already has.

**Vanilla `@font-face` with a metric-matched fallback:**

```css
@font-face {
  font-family: "Brand Sans";
  src: url("/fonts/brand-sans-var.woff2") format("woff2");
  font-weight: 400 700; font-display: swap; unicode-range: U+0000-00FF, U+2000-206F;
}
@font-face { /* fallback tuned to Brand Sans metrics; measure per font (default values shown) */
  font-family: "Brand Sans Fallback"; src: local("Arial");
  size-adjust: 104%; ascent-override: 92%; descent-override: 24%; line-gap-override: 0%;
}
body { font-family: "Brand Sans", "Brand Sans Fallback", system-ui, sans-serif; }
```

Preload only the one or two files used above the fold (`<link rel="preload" as="font" type="font/woff2" crossorigin>`). Loading budgets: [performance](performance.md).

**Fluid clamp generator (any JS runtime):**

```js
export function fluid(minPx, maxPx, minVw = 360, maxVw = 1280, root = 16) {
  if (maxVw <= minVw) throw new Error("maxVw must exceed minVw");
  if (maxPx / minPx > 2.5) console.warn(`fluid(): max/min ${(maxPx / minPx).toFixed(2)} > 2.5, check 200% zoom`);
  const slope = (maxPx - minPx) / (maxVw - minVw);
  const intercept = (minPx - slope * minVw) / root;
  const r = (n) => +n.toFixed(3);
  return `clamp(${r(minPx / root)}rem, ${r(intercept)}rem + ${r(slope * 100)}vw, ${r(maxPx / root)}rem)`;
}
// fluid(32, 56) -> "clamp(2rem, 1.413rem + 2.609vw, 3.5rem)"
```

**Page shell with content, breakout and full-bleed lines:**

```css
.shell {
  --gutter: clamp(1rem, 0.6rem + 1.8vw, 2rem);
  --content: 72rem;
  display: grid;
  grid-template-columns:
    [full-start] minmax(var(--gutter), 1fr)
    [content-start] min(var(--content), 100% - 2 * var(--gutter))
    [content-end] minmax(var(--gutter), 1fr) [full-end];
}
.shell > * { grid-column: content; }
.shell > .full-bleed { grid-column: full; }

.grid-12 { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--gutter); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 1.5rem; }

/* component adapts to its container, not the viewport */
.card-wrap { container-type: inline-size; }
@container (min-width: 32rem) { .card { display: grid; grid-template-columns: 2fr 3fr; gap: 1.5rem; } }
```

`min(280px, 100%)` prevents overflow on 320px screens (SC 1.4.10 reflow). Asymmetric collapse in Tailwind: `grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr]`, with any negative-margin overlap applied only from `md:`.

**Measure text only after fonts load (canvas, fit-text, motion splitting):**

```js
async function measureAfterFonts(el, measure) {
  try { await document.fonts.ready; } catch { /* Font Loading API absent: measure anyway */ }
  return measure(el);
}
```

Split-text and scroll animation of type belong to [motion-engineering](motion-engineering.md); re-measure on resize and on `document.fonts` `loadingdone`, and clean up listeners on unmount.

## Failure modes & fallbacks

| Symptom | Cause | Fix |
|---|---|---|
| Layout jumps when the font arrives (CLS) | no fallback metrics, late font | `next/font` or `size-adjust` fallback; preload the above-fold file |
| Hero text huge on desktop, unreadable at 200% zoom | vw-only clamp, max/min > 2.5 | add a rem term; cap max ≤ 6rem; re-test zoom |
| Lines run 100+ characters | container widened without type | `max-width: 65ch` on prose; widen type with container |
| Descenders clipped in italic headline | line-height 1 with overflow hidden | ≥ 1.1 line-height and 4px bottom padding |
| Numbers wiggle in counters/tables | proportional figures | `tabular-nums` |
| Orphaned last word in headings | no wrap control | `text-wrap: balance` (progressive enhancement; harmless where unsupported) |
| Everything has the same padding | no rhythm in scale use | apply tight/medium/wide/vast relations; run the monotony check |
| Cards inside cards | grouping by container instead of space | remove inner container; use spacing or a divider |
| Asymmetric grid overflows on phones | no collapse rule | single column below 768px; `minmax(0, 1fr)` columns |
| Text clipped after user spacing override | fixed heights on text boxes | use `min-height`, let content grow |
| Commercial font, licence unknown | picked from a reference site | swap to an OFL alternative and ask the user before licensing anything |
| Font CDN blocked or offline | external font host | self-host WOFF2 or fall back to the system stack; record it |

## Verification

- **Gate C (visual quality):** screenshot key pages at the viewport matrix ([visual-testing](visual-testing.md)); in [visual-critique](visual-critique.md) check scale consistency (≤ 3-4 sizes per screen), measure, heading rhythm, single container width, spacing rhythm and collapse of asymmetric layouts.
- **Gate D (accessibility):** body ≥ 16px in rem; 200% zoom without loss (SC 1.4.4); 320px reflow without horizontal scroll (SC 1.4.10); text-spacing override (line-height 1.5, paragraph spacing 2em, letter 0.12em, word 0.16em) without clipping (SC 1.4.12); heading order unbroken. Inject the override with a bookmarklet or browser-tool script only if a browser capability is `available-verified` in [capability-registry](capability-registry.md); otherwise NOT_TESTED with the reason.
- **Gate E (performance):** CLS ≤ 0.1; count font files and weights loaded ([performance](performance.md)).
- **Gate F (responsive):** `node <skill-dir>/scripts/visual-check.mjs --url <url> --out <dir>` reports horizontal overflow per viewport; exit code 4 means BLOCKED (Playwright not resolvable).
- **Static checks:** grep for `px` font sizes on body text, `text-align: justify` without `hyphens`, `height:` on text containers, more than one font-size ratio in tokens, and spacing values off the 4px scale.
- Record results with PASS/FAIL/BLOCKED/NOT_TESTED/NOT_APPLICABLE and evidence ([quality-gates](quality-gates.md)).

## Sources

Installed skills (paraphrased; licences as recorded in the audit):
- impeccable — scale ratios by product type, clamp limits, text-quality thresholds, spacing scale and monotony check, container inset rules, font-selection procedure. Licence: none found locally (detector scripts Apache-2.0); paraphrased only.
- design-taste-frontend (taste-skill) — variance and density dials, display defaults, pairing examples and licence notes, serif discipline, same-family emphasis, italic descender fix. Licence: none found; paraphrased only.
- brand (claudekit) — 1.25 reference scale with per-level line-height, tracking and spacing. MIT (frontmatter; LICENSE conflict noted in audit).
- ui-ux-pro-max — product scale 12-32px, weights, mobile measure, breakpoints and containers. Licence: none found; paraphrased.
- frontend-slides (ECC) — content density caps, clamp token set, height-based queries. MIT.
- make-interfaces-feel-better (ECC) — `text-wrap` and tabular numerals. MIT. Its root font-smoothing advice is contested and left to presets.
- remotion-video-creation (ECC) — fonts loaded before measuring text. MIT.
- notion-design — spacing-as-meaning bands and sizes per screen (generic rules only). Licence: none found; paraphrased.
- frontend-design (Anthropic) — one or two distinct families, measure under 80 characters, typographic tells. Licence: likely Apache-2.0, unverified.

External references (cited from known published versions, not fetched during this build; date of writing 2026-10-24):
- WCAG 2.2 SC 1.4.4, 1.4.8, 1.4.10, 1.4.12 — https://www.w3.org/TR/WCAG22/
- Robert Bringhurst, *The Elements of Typographic Style* (45-75 character measure).
- CSS Text Level 4 `text-wrap` — https://www.w3.org/TR/css-text-4/ ; MDN `font-variant-numeric`, `size-adjust`, container queries — https://developer.mozilla.org/
- Next.js `next/font` — https://nextjs.org/docs/app/api-reference/components/font
- Tailwind CSS v4 theme variables (`--text-*`, `--spacing`) — https://tailwindcss.com/docs/theme
- Nielsen Norman Group, F-shaped reading pattern — https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/
