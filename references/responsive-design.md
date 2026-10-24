# Responsive design

Rules and mechanics for interfaces that work from a 320 px phone to a 1920 px desktop, under zoom, with touch or a mouse, in short landscape viewports and with long or translated text. Applies in stages 3-5 (plan, design, build) and is verified in stage 9 of [SKILL.md](../SKILL.md).

**Load when:** any UI build or redesign, and every request mentioning mobile, mobile-first, tablet, PWA, responsive, breakpoints, zoom, touch, landscape, notch/safe area, localisation or text overflow. **Owns:** breakpoint strategy, the responsive viewport matrix, fluid type and space mechanics, container queries, touch vs pointer adaptation, viewport-height units and safe areas, zoom and reflow behaviour, long text and localisation resilience, responsive tables, art direction per breakpoint.
**Related:** [typography-and-layout](typography-and-layout.md), [design-tokens](design-tokens.md), [interaction-design](interaction-design.md), [accessibility](accessibility.md), [image-pipelines](image-pipelines.md), [dashboard-engineering](dashboard-engineering.md), [motion-engineering](motion-engineering.md), [performance](performance.md), [visual-testing](visual-testing.md), [quality-gates](quality-gates.md)

## Decision rules

1. Build mobile-first: base styles for the narrowest layout, then `min-width` queries. Place breakpoints where the content breaks (line length, crowding, wasted space), not at device names; reuse the project's existing breakpoint scale before adding one.
2. Write the below-768 px layout in the same component as every multi-column layout. Never assume a grid "just collapses".
3. Choose the query by scope: viewport media queries for page-level layout (navigation pattern, page columns); container queries for components that appear in different-width slots (cards, tiles, sidebars, widgets).
4. Detect input capability with `(hover: hover) and (pointer: fine)` / `(pointer: coarse)`, never with width. Never put a function behind hover only; every hover reveal needs a tap, focus and keyboard equivalent.
5. Make every pointer target at least 24×24 CSS px or meet the WCAG 2.5.8 spacing exception (AA). Aim for 44×44 on touch-primary layouts (WCAG 2.5.5 AAA, Apple HIG); extend small glyphs with padding or an inset `::before` hit area.
6. Never use `100vh` for full-height sections on mobile. Use `min-height: 100svh` for heroes (stable while browser bars move) and `100dvh` only for app shells or overlays that must track the visible area.
7. Never disable zoom (`user-scalable=no`, `maximum-scale=1`). Content must reflow at 320 CSS px width (= 1280 px at 400% zoom) without two-dimensional scrolling, except content that needs it (data tables, maps, diagrams, code).
8. Never size type with viewport units alone. Fluid type uses `clamp(min-rem, rem + vw, max-rem)` so browser zoom and user font settings still scale it (WCAG 1.4.4).
9. Prevent overflow structurally: `min-width: 0` on flex/grid children that hold text, `overflow-wrap: anywhere` on user/translated strings and URLs, `minmax(min(100%, X), 1fr)` grid tracks, `max-width: 100%` on media. Never hide overflow on `body` to mask a bug.
10. Design for text expansion: labels and buttons must survive about +35% length (default — adjust per locale; W3C i18n notes far larger growth for very short strings), wrapping instead of truncating unless a tooltip or full-text route exists.
11. Use logical properties (`margin-inline`, `padding-block`, `inset-inline-start`) and `dir`-aware icons so RTL works without a second stylesheet.
12. Keep fixed or sticky chrome small at short heights: below 500 px viewport height (default — adjust per product) collapse or unstick headers, toolbars and bottom bars so content keeps most of the screen.
13. Respect safe areas: with `viewport-fit=cover`, pad edge-anchored UI with `max(<base>, env(safe-area-inset-*))`.
14. Give data tables a deliberate mobile pattern (scroll region with sticky first column, card stack, or column priority). Never let a table widen the page.
15. Art-direct images per breakpoint with `<picture>` + `media` only when the crop must change; otherwise one `srcset`/`sizes` image. Reserve space with `aspect-ratio` or width/height. Formats and generation belong to [image-pipelines](image-pipelines.md).
16. Simplify, do not just shrink: heavy decoration (3D, particles, pinned scroll sequences, cursor effects) gets a lighter variant below 768 px or on `(hover: none)`; see [motion-engineering](motion-engineering.md) and [three-dimensional-web](three-dimensional-web.md).
17. Verify every required viewport in the matrix plus 400% zoom and landscape phone before claiming Gate F; anything not exercised is NOT_TESTED.

## Specifications

### Viewport matrix

| Width × height (CSS px) | Represents | Required for Gate F |
|---|---|---|
| 320 × 568 | smallest phones; 400% zoom of a 1280 px window (WCAG 1.4.10) | yes (reflow check) |
| 375 × 812 | common modern phone | yes |
| 414 × 896 | large phone | extended |
| 844 × 390 | phone landscape (short height) | extended; required if fixed chrome or full-height sections exist |
| 768 × 1024 | tablet portrait, first "md" layout | yes |
| 1024 × 768 | tablet landscape, small laptop | extended |
| 1280 × 800 | laptop, common max-width container | yes |
| 1440 × 900 | desktop | extended |
| 1920 × 1080 | large desktop; checks max-width and line length | yes |

Required set matches Gate F defaults in [SKILL.md](../SKILL.md) §8 (375, 768, 1280, 1920 plus 320 / 400% zoom). Device sizes are representative defaults — adjust per the product's analytics. Automation, screenshots and diffing are owned by [visual-testing](visual-testing.md).

### Breakpoint scale

- Tailwind v4 defaults: `sm` 40rem (640 px), `md` 48rem (768 px), `lg` 64rem (1024 px), `xl` 80rem (1280 px), `2xl` 96rem (1536 px) (Tailwind docs, from knowledge; verify in the installed version). Use them unless the project defines its own; content-driven extra points go in `@theme` as `--breakpoint-*`.
- Page container: max 1280 px (`max-w-7xl`) or ~1400 px, centred (design-taste-frontend); reading measure is owned by [typography-and-layout](typography-and-layout.md).
- Main collapse point for multi-column layouts: below 768 px (design-taste-frontend, impeccable).
- Heavy-effect cutoff: 768 px (frontend-slides, MIT).

### Fluid type and space

- Formula: `clamp(MIN, calc(MIN + (MAX − MIN) × (100vw − VMIN) / (VMAX − VMIN)), MAX)`, written as `clamp(1rem, 0.9rem + 0.5vw, 1.25rem)`. Keep a `rem` term in the middle value (rule 8).
- Interpolation range: 320 px → 1440 px (default — adjust per product). The scale ratios and step values come from [typography-and-layout](typography-and-layout.md); tokens live in [design-tokens](design-tokens.md).
- Body text never below 16 px (1rem) on mobile (default; prevents iOS input zoom on focus for form fields at < 16 px, from knowledge).
- Space: fluid section padding such as `clamp(3rem, 2rem + 4vw, 8rem)`; component gaps stay fixed steps.
- Inside containers, use `cqi` units for type that should follow the card, not the viewport: `font-size: clamp(1rem, 0.8rem + 2cqi, 1.5rem)`.

### Targets and input (WCAG 2.2)

| Requirement | Value | Level |
|---|---|---|
| 2.5.8 Target Size (Minimum) | 24 × 24 CSS px, or 24 px diameter circle around each target not overlapping others; inline-text links exempt | AA |
| 2.5.5 Target Size (Enhanced) | 44 × 44 CSS px | AAA (recommended for touch-primary) |
| Apple HIG | 44 × 44 pt | platform guidance |
| Material Design | 48 × 48 dp | platform guidance |
| 1.4.10 Reflow | 320 CSS px width / 256 CSS px height without 2D scroll | AA |
| 1.4.4 Resize Text | 200% without loss of content or function | AA |
| 1.3.4 Orientation | no lock to portrait or landscape unless essential | AA |
| 1.4.13 Content on Hover or Focus | dismissible, hoverable, persistent | AA |

Full WCAG checking is owned by [accessibility](accessibility.md).

### Viewport units and platform status

- `svh` / `lvh` / `dvh` (small, large, dynamic viewport): supported in all current engines since 2022-2023 (from knowledge: Chrome 108, Safari 15.4, Firefox 101; verify on webstatus.dev). Fallback: declare `100vh` first, then the new unit.
- Container size queries and `cq*` units: Baseline widely available since 2025-08-14 (webstatus.dev, retrieved 2026-10-24). Safe without fallback. Container style queries are a separate feature; check before use.
- Anchor positioning: Limited availability (webstatus.dev, 2026-10-24); enhancement only.
- `interactive-widget=resizes-content` in the viewport meta changes how the on-screen keyboard resizes the viewport in Chromium (from knowledge; verify before relying on it).

## Implementation

Detect the stack first ([frontend-architecture](frontend-architecture.md)): Tailwind version (v4 `@theme` vs v3 config), existing breakpoints, CSS modules or plain CSS. Reuse the project's scale.

### 1. Viewport meta and base

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

```css
*, *::before, *::after { box-sizing: border-box; }
img, video, svg, canvas { max-width: 100%; height: auto; }
body { overflow-wrap: break-word; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
:where(.flex, .grid) > * { min-width: 0; }              /* or add min-w-0 on text-holding children */
.hero { min-height: 100vh; min-height: 100svh; }
.app-shell { height: 100vh; height: 100dvh; }
.bottom-bar { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
```

In Next.js App Router, set the viewport via `export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" }` in `app/layout.tsx` instead of a manual meta tag.

### 2. Tailwind v4 breakpoints and fluid tokens

```css
@import "tailwindcss";
@theme {
  --breakpoint-xs: 22.5rem;                          /* content-driven extra point (360px); default — adjust */
  --text-fluid-body: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --text-fluid-h1: clamp(2.25rem, 1.5rem + 3.5vw, 4.5rem);
  --spacing-section: clamp(3rem, 2rem + 4vw, 8rem);
}
```

Usage: `text-fluid-h1`, `py-section`, `md:grid-cols-2`. Tailwind v4 includes container variants in core: `@container` on the parent and `@md:grid-cols-2` on children (from knowledge; verify syntax for the installed version).

### 3. Intrinsic grid and container query component

```css
.cards { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); }

.card-slot { container-type: inline-size; container-name: card; }
.card { display: grid; gap: 1rem; }
@container card (min-width: 28rem) {
  .card { grid-template-columns: 10rem 1fr; align-items: start; }
}
.card h3 { font-size: clamp(1.125rem, 1rem + 1.5cqi, 1.5rem); }
```

The auto-fit track with `min(100%, X)` never overflows a 320 px screen (frontend-slides, MIT). Do not put `container-type` on an element whose width depends on its children (it becomes zero-width).

### 4. Hover and pointer adaptation

```css
.card-actions { opacity: 1; }                                  /* visible by default (touch, keyboard) */
@media (hover: hover) and (pointer: fine) {
  .card:not(:hover):not(:focus-within) .card-actions { opacity: 0; }
  .card-actions { transition: opacity 150ms ease; }
}
.icon-button { position: relative; inline-size: 1.5rem; block-size: 1.5rem; }
.icon-button::before { content: ""; position: absolute; inset: -0.625rem; }   /* 24px glyph -> 44px hit area */
@media (pointer: coarse) { .toolbar { gap: 0.5rem; } }
```

```ts
// React: subscribe, don't read during render (avoids hydration mismatch)
import { useSyncExternalStore } from "react";
export function useMedia(query: string, serverDefault = false) {
  return useSyncExternalStore(
    (cb) => { const mq = matchMedia(query); mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); },
    () => matchMedia(query).matches,
    () => serverDefault,
  );
}
// const finePointer = useMedia("(hover: hover) and (pointer: fine)");
```

Prefer CSS for layout decisions; use `useMedia` only when behaviour, not styling, differs (for example, mounting a drag interaction).

### 5. Short viewports and landscape

```css
@media (max-height: 500px) {
  .site-header { position: static; }               /* stop sticky chrome eating a 390px-tall screen */
  .hero { min-height: auto; padding-block: 2rem; }
}
@media (orientation: landscape) and (max-height: 500px) { .bottom-sheet { max-height: 85dvh; overflow-y: auto; } }
```

For fixed-frame surfaces (slides, kiosk panels, full-screen hero frames): each frame is exactly one viewport (`height: 100vh; height: 100dvh; overflow: hidden`). If content overflows, split it into another frame; never shrink type below the readable floor. A scrollbar inside a frame is a failure (frontend-slides, MIT). Optional 16:9 lock above 769 px: `max-width: calc(100vh * 16 / 9); max-height: calc(100vw * 9 / 16); margin: auto` (claudekit slides; idea paraphrased).

### 6. Long text and localisation

```css
.label { overflow-wrap: anywhere; hyphens: auto; }          /* hyphens needs a correct lang attribute */
.button { min-inline-size: 0; max-inline-size: 100%; white-space: normal; text-wrap: balance; }
.truncate-1 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }   /* only with a full-text route (title/tooltip/detail view) */
.clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.chevron:dir(rtl) { transform: scaleX(-1); }
```

Test with pseudo-localisation: replace strings with versions about 35% longer plus accented characters (`[Ŝéţţîñĝš ţîţļé ~~~~]`), a long unbroken token (an email or URL) and one RTL locale (`<html dir="rtl" lang="ar">`). Keep layout stability: toolbars, counters, tiles and fixed-format controls must not shift when labels change or hover states appear (frontend-design-direction); use `font-variant-numeric: tabular-nums` for changing numbers.

### 7. Tables on mobile

Pick by task (dashboard table patterns are owned by [dashboard-engineering](dashboard-engineering.md)):

- **Comparison or dense data:** keep the table; wrap it in a focusable scroll region with a sticky first column.
- **Record lists (few columns read per row):** collapse to label/value cards below 640 px with `data-label` (impeccable).
- **Many columns, few important:** column priority; hide low-priority columns behind a "Columns" control, never silently.

```html
<div class="table-scroll" role="region" aria-labelledby="orders-caption" tabindex="0">
  <table><caption id="orders-caption">Orders</caption> ... </table>
</div>
```

```css
.table-scroll { overflow-x: auto; max-width: 100%; overscroll-behavior-inline: contain; }
.table-scroll th:first-child, .table-scroll td:first-child { position: sticky; inset-inline-start: 0; background: var(--surface, Canvas); }
@media (max-width: 39.99rem) {
  .table-cards thead { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
  .table-cards tr { display: grid; gap: 0.25rem; padding-block: 0.75rem; border-block-end: 1px solid var(--line, GrayText); }
  .table-cards td { display: grid; grid-template-columns: 8rem 1fr; }
  .table-cards td::before { content: attr(data-label); font-weight: 600; }
}
```

`display` changes on table elements can strip table semantics in some screen readers; when using card collapse, re-test with a screen reader or keep the scroll-region pattern ([accessibility](accessibility.md)).

### 8. Art direction per breakpoint

```html
<picture>
  <source media="(min-width: 64rem)" srcset="hero-wide-1600.avif 1600w, hero-wide-2400.avif 2400w" type="image/avif">
  <source media="(min-width: 40rem)" srcset="hero-4x3-1200.avif 1200w" type="image/avif">
  <img src="hero-portrait-800.jpg" srcset="hero-portrait-800.jpg 800w, hero-portrait-1200.jpg 1200w"
       sizes="100vw" width="800" height="1000" alt="…" fetchpriority="high">
</picture>
```

Change crop, not just size: the mobile source is portrait with the subject centred; text overlays move below the image on narrow screens rather than shrinking over it. Cap decorative media with `max-height: min(50vh, 400px); object-fit: contain` (frontend-slides, MIT). Encoding, `sizes` maths and generation are owned by [image-pipelines](image-pipelines.md).

## Failure modes & fallbacks

| Symptom | Cause | Fix |
|---|---|---|
| Horizontal scroll at 320-375 px | fixed widths, long words/URLs, `100vw` inside a scrollbar page, grid tracks with px minimums | `min(100%, X)` tracks, `overflow-wrap: anywhere`, `min-width: 0`, replace `100vw` with `100%` |
| Hero jumps when the mobile URL bar hides | `100vh`/`dvh` on a hero | `100svh` |
| Bottom CTA hidden behind home indicator | no safe-area padding | `max(1rem, env(safe-area-inset-bottom))` with `viewport-fit=cover` |
| Actions unreachable on touch | hover-only reveal | visible by default, hide only under `(hover: hover) and (pointer: fine)` |
| Text does not grow with browser zoom | `vw`-only font sizes | `clamp()` with a `rem` term |
| Component breaks in sidebar but not in main column | viewport query used for a component | container query |
| Container collapses to zero width | `container-type` on a shrink-to-fit element | put it on a wrapper with a definite width |
| Landscape phone shows only header and footer | sticky chrome at short heights | `max-height: 500px` query to unstick |
| Translated label overflows button | fixed-width buttons, `nowrap` | allow wrap, min/max inline size, test pseudo-locale |
| Table widens the page | table not wrapped | scroll region or card collapse |

When the browser tooling needed to check these is unavailable, keep the structural fixes and mark the visual checks NOT_TESTED. More cases in [troubleshooting](troubleshooting.md).

## Verification

Feeds Gate F (responsive) and parts of Gate D (reflow, target size, orientation, resize text) and Gate C (layout quality). Definitions in [quality-gates](quality-gates.md).

1. **Check tooling honestly:** read [capability-registry](capability-registry.md) or run `node ../scripts/environment-audit.mjs --project <dir>`; probe in-session browser tools with ToolSearch. Use only tools whose status is `available-verified`.
2. **Matrix screenshots and overflow:** `node ../scripts/visual-check.mjs --url <url> --viewports 320x568,375x812,768x1024,1280x800,1920x1080 --out <dir>` (add `844x390` when fixed chrome or full-height sections exist). It reports horizontal overflow and elements wider than the viewport. Exit 4 means BLOCKED (Playwright not resolvable); then use verified browser MCP tools (resize + screenshot) or mark Gate F NOT_TESTED.
3. **Overflow probe** (run in any verified browser tool):

```js
[...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
  .slice(0, 20).map(el => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`)
```

4. **Zoom/reflow:** at a 1280 px window set 400% zoom, or emulate 320 × 256 CSS px; confirm no 2D scrolling outside exempt content and no clipped controls. At 200% text-only zoom, confirm no truncated content.
5. **Touch:** emulate a touch device (Playwright `hasTouch: true, isMobile: true` or a mobile preset) and complete each critical journey without hover. Measure targets: `getBoundingClientRect()` of interactive elements ≥ 24 × 24 or spacing exception met; flag < 44 × 44 on touch-primary layouts as low/medium.
6. **Long content:** run one pass with pseudo-localised strings and one RTL pass; record breakages.
7. **Report per viewport** (PASS/FAIL with screenshot path, or NOT_TESTED with reason). A single desktop screenshot never passes Gate F.

## Sources

Installed skills (ideas paraphrased; numbers credited inline):
- design-taste-frontend: dvh/svh over h-screen, grid over flex maths, container max width, 640-1536 breakpoints, below-768 fallback rule (licence: none found; paraphrased).
- impeccable (adapt.md, layout.md, typeset.md): mobile-first content breakpoints, pointer/hover queries, 44 px targets with hit-area expansion, safe areas, never disable zoom, `data-label` table cards (prose licence: none found; Apache-2.0 SPDX on its detector scripts only; paraphrased).
- ECC frontend-design-direction: layout stability constraints (ECC; licence recorded per skill in the audit, verify).
- ECC frontend-slides (MIT): viewport-fit gate, split-not-shrink, intrinsic grid and media caps, 768 px heavy-effect cutoff.
- claudekit slides template: 16:9 letterbox lock (licence: none found; idea paraphrased).

External:
- WCAG 2.2 Understanding 2.5.8 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html (from knowledge, not re-fetched 2026-10-24; verify)
- WCAG 2.2 Understanding 1.4.10 Reflow: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html (from knowledge; verify)
- WCAG 2.2 Understanding 1.4.4, 1.3.4, 2.5.5, 1.4.13: https://www.w3.org/WAI/WCAG22/Understanding/ (from knowledge; verify)
- Container queries Baseline: https://webstatus.dev/features/container-queries (retrieved 2026-10-24)
- Anchor positioning status: https://web-platform-dx.github.io/web-features-explorer/features/anchor-positioning/ (retrieved 2026-10-24)
- MDN viewport-percentage lengths: https://developer.mozilla.org/en-US/docs/Web/CSS/length (from knowledge; verify)
- W3C Internationalization, text size in translation: https://www.w3.org/International/articles/article-text-size (from knowledge; verify)
- Tailwind CSS v4 responsive design and container queries: https://tailwindcss.com/docs/responsive-design (from knowledge; verify)
