# Visual systems

Rules for the visual layer that sits on top of tokens and layout: colour, imagery and art direction, iconography, materials (shadow, border, glass, texture) and visual hierarchy. Use it to make every surface look like it belongs to one deliberate system.

**Load when:** landing-page, portfolio-editorial, design-system, ecommerce and existing-project tasks; any request mentioning colour, palette, contrast, dark mode colours, icons, imagery, art direction, shadows, glass, cards or hierarchy. **Owns:** colour systems (OKLCH palettes, semantic roles, contrast pairs, accent discipline, colour-level dark-mode rules), imagery and art direction, iconography, materials (elevation, borders vs shadows, glass, texture), visual hierarchy.
**Related:** [design-intelligence](design-intelligence.md), [design-tokens](design-tokens.md), [typography-and-layout](typography-and-layout.md), [accessibility](accessibility.md), [image-pipelines](image-pipelines.md), [visual-critique](visual-critique.md), [dashboard-engineering](dashboard-engineering.md), [presets](../presets/README.md)

Token architecture (primitive → semantic → component), theme switching and Tailwind `@theme` plumbing belong to [design-tokens](design-tokens.md). This file decides *which* colours, materials and icons; design-tokens decides *how they are stored and switched*.

## Decision rules

1. **Inspect first.** Before choosing any colour, icon set or shadow, read the project's existing tokens, Tailwind config/`@theme`, icon imports and brand guide. If a working system exists, extend it; never replace a brand palette or icon library without the user's request (SKILL.md §2, level 2).
2. **Choose a colour strategy before choosing colours.** Pick one: *Restrained* (tinted neutrals plus one accent covering ≤ 10% of the surface; the product default), *Committed* (one saturated colour carries 30-60% of the surface; identity pages), *Full palette* (3-4 named roles, each with a stated job; campaigns, data viz), *Drenched* (the surface is the colour; heroes). Record the choice in the DDR. A single surface may deviate from the project strategy if the DDR says why.
3. **One accent, used identically.** In Restrained products use exactly one accent hue. Use the same accent token for every primary CTA, link, focus ring and selected state on every page. An off-palette badge or CTA in a later section is a high-severity visual defect.
4. **One grey temperature.** Build all neutrals from one hue (cool slate, neutral zinc, or warm stone). Never mix warm and cool greys in one product.
5. **Author palettes in OKLCH.** Define primitives as `oklch(L C H)` ramps with constant hue and stepped lightness, then map them to semantic roles. Never pick semantic colours by eye from unrelated hex values.
6. **Every text/background pair is a declared contrast pair.** Normal text needs ≥ 4.5:1 and large text ≥ 3:1 (WCAG 2.2 SC 1.4.3); UI component boundaries, focus indicators and meaningful graphics need ≥ 3:1 against adjacent colours (SC 1.4.11). List the pairs in the preset or token file and check them with `scripts/build-tokens.mjs` or the snippet below. If a brand colour fails, darken or lighten it in OKLCH for text use and keep the original for large fills only.
7. **Never use colour as the only signal.** Errors, status, selection, chart series and required fields also carry text, an icon, a pattern or a shape (SC 1.4.1). Details in [accessibility](accessibility.md).
8. **Do not invert for dark mode.** Re-derive the dark palette: lift surfaces off pure black, lower accent chroma, express elevation with lighter surfaces instead of darker shadows, and re-check every contrast pair in the dark theme. Never ship a dark theme whose contrast was checked only in light mode.
9. **Elevation must mean something.** Use a card or shadow only when the element is above the page (overlay, draggable, interactive tile) or is a distinct actionable unit. Otherwise group with whitespace, a top border or `divide-y`. Never nest cards. In dense UIs (data tables, admin, density dial > 7 per design-intelligence) drop card containers and use 1px rules.
10. **Borders separate, shadows lift.** Use borders for separation, input boundaries and focus rings; use layered, low-opacity, hue-tinted shadows for depth. Never use pure-black shadows on light surfaces.
11. **Glass only over something.** Use backdrop blur only when there is texture, imagery or content behind the panel to blur, and only for premium consumer, media-overlay or navigation/control layers. Never use glass for dashboards, forms, public-sector or data-dense UI. Always ship the reduced-transparency and no-`backdrop-filter` fallback.
12. **One icon family, one stroke.** Use one icon library per product with one global stroke width (1.5 or 2) and one style per hierarchy level (outline or filled). If the project already uses a library (shadcn projects ship lucide), keep it. Never hand-draw icon paths; never use emoji as structural icons unless the brand is chat-native or playful.
13. **Icons and logos carry licences.** Record the collection and licence of every added icon set; never export Apple SF Symbols for the web; never recolour or distort third-party brand logos.
14. **Imagery is a series.** All photos or renders on a site share light direction, colour grade, lens/perspective, crop ratios and subject distance. One off-series image (stock smile among product renders) is a medium-severity defect. Write the art-direction spec before generating or retrieving images (route in [asset-generation](asset-generation.md), prompts in [image-pipelines](image-pipelines.md)).
15. **Reserve negative space for type.** When text sits on an image, choose or crop images with a calm region where the text goes, or add a scrim. Text over imagery must still meet rule 6 at every viewport crop.
16. **One primary action per screen.** Exactly one visually dominant CTA per view; secondary actions are outline/ghost/text. Hierarchy comes from 2-3 combined levers (size, weight, colour, space), not from adding more colours.
17. **Structure must encode information.** Borders, eyebrows, numbering (01/02/03), dividers and labels must say something about the content. Numbered markers only for real sequences.
18. **Stay inside one style family.** Shadows, blur, radii and highlight treatments follow the chosen family (flat, soft, glass, clay, brutalist). Never mix flat and skeuomorphic treatments at random. Never ship an unmodified component-kit default look (radius, colour, shadow, type all untouched).

## Specifications

### Colour strategy budgets

| Strategy | Accent / colour share | Use for | Source |
|---|---|---|---|
| Restrained | accent ≤ 10% of surface | product UI, SaaS, docs | impeccable |
| Committed | one colour 30-60% | identity pages, portfolios | impeccable |
| Full palette | 3-4 named roles | campaigns, data viz | impeccable |
| Drenched | surface is the colour | heroes, splash, campaign sections | impeccable |
| Marketing asset budget | primary 60-70%, secondary 20-30%, accent 5-10%, off-palette ≤ 20% | banners, social, ad visuals (not product UI) | brand skill |

Palette size (brand skill, adjust per brand): 1-2 primaries, 2-3 secondaries, 3-5 neutrals, 4 semantic roles (success, warning, danger, info). At most 2-3 colours inside one component. Accent saturation below about 80% by default (design-taste-frontend); in OKLCH terms keep accent chroma ≤ 0.20 for UI text and controls — default, adjust per brand.

### OKLCH ramp (default — adjust per brand)

Keep H constant per ramp; step L; taper C at both ends so extremes stay in sRGB gamut.

| Step | L | C (neutral, tinted) | C (accent) | Typical role |
|---|---|---|---|---|
| 50 | 0.985 | 0.003 | 0.02 | page background (light) |
| 100 | 0.965 | 0.005 | 0.04 | subtle surface |
| 200 | 0.92 | 0.008 | 0.07 | border, divider |
| 300 | 0.87 | 0.010 | 0.10 | strong border, disabled fill |
| 400 | 0.71 | 0.013 | 0.14 | placeholder, icons on light (check 3:1) |
| 500 | 0.60 | 0.015 | 0.17 | accent fill, large text only unless checked |
| 600 | 0.52 | 0.016 | 0.17 | accent text/link on light |
| 700 | 0.44 | 0.015 | 0.15 | hover/pressed accent |
| 800 | 0.33 | 0.012 | 0.11 | secondary text on light |
| 900 | 0.24 | 0.010 | 0.08 | primary text on light; raised surface (dark) |
| 950 | 0.16 | 0.008 | 0.05 | page background (dark) |

Rule of thumb, not a guarantee: an L difference of about 0.40 or more between text and background usually clears 4.5:1 for low-chroma pairs. Always compute the ratio; OKLCH lightness is perceptual, WCAG contrast is not.

### Semantic roles (map primitives to these; names owned by design-tokens)

| Role | Light default | Dark default | Contrast requirement |
|---|---|---|---|
| `bg` / `surface` / `surface-raised` | 50 / 50-100 / white or 50 | 950 / 900 / 800 | n/a (base) |
| `text` | 900-950 | 50-100 (not pure white) | ≥ 4.5:1 on every surface it sits on |
| `text-muted` | 700-800 | 300-400 | ≥ 4.5:1 (it is still body text) |
| `border` | 200 | 800 | decorative; 3:1 if it is the only boundary of a control |
| `border-strong` / input outline | 400-500 | 500-600 | ≥ 3:1 vs adjacent (SC 1.4.11) |
| `accent` (fill) | 600 | 400-500, lower C | button label on it ≥ 4.5:1 |
| `accent-text` (links) | 600-700 | 300-400 | ≥ 4.5:1, plus non-colour cue (underline) in body text |
| `focus-ring` | accent 600 | accent 400 | ≥ 3:1 vs adjacent colours |
| `success/warning/danger/info` | 600-700 text, 100 fill | 300-400 text, 900 fill | each text/fill pair ≥ 4.5:1 |

Never use pure `#000` text on white for long reading; use the 900-950 step (about `#111` in sRGB terms, brand skill). Warning yellows almost never reach 4.5:1 as text on white; use a dark amber text step plus an icon.

### Dark-mode colour pitfalls

| Pitfall | Do instead |
|---|---|
| Pure black `#000` page with pure white text (halation, smearing on OLED scroll) | Background L ≈ 0.14-0.18, text L ≈ 0.93-0.97 (default — adjust per brand) |
| Same accent chroma as light mode (vibrates on dark) | Reduce accent C by about 20-30% and raise L (default) |
| Shadows for elevation (invisible on dark) | Raise surface L by about 0.03-0.05 per elevation level (default) plus a 1px top border at low alpha |
| Inverting the ramp mechanically | Re-map roles by hand; muted text and borders need their own dark steps |
| Saturated semantic fills | Use dark low-chroma fills with light text steps |
| Images and logos unchanged | Provide dark-variant logos; dim bright photography slightly only if the art direction allows |
| Checking contrast only in light mode | Re-run every declared pair per theme |

Theme switching mechanics (`prefers-color-scheme`, `data-theme`, persistence, no flash of wrong theme) live in [design-tokens](design-tokens.md).

### Elevation and shadow scale (default — adjust per brand)

Tint shadow colour toward the background hue (here a cool neutral H 260).

| Level | Use | Light value |
|---|---|---|
| 0 | flat content | `none` |
| 1 | resting card, input | `0 1px 2px oklch(0.2 0.02 260 / 0.06), 0 1px 1px oklch(0.2 0.02 260 / 0.04)` |
| 2 | hover card, sticky header | `0 2px 4px oklch(0.2 0.02 260 / 0.06), 0 4px 12px oklch(0.2 0.02 260 / 0.06)` |
| 3 | dropdown, popover | `0 4px 8px oklch(0.2 0.02 260 / 0.07), 0 12px 32px oklch(0.2 0.02 260 / 0.10)` |
| 4 | modal, sheet | `0 8px 16px oklch(0.2 0.02 260 / 0.08), 0 24px 64px oklch(0.2 0.02 260 / 0.16)` |

Dark mode: keep shadows only from level 3 up (they read as separation from the backdrop), and express levels 1-2 with surface lightness and a hairline border.

Other material numbers:
- Photo edge outline: `outline: 1px solid rgb(0 0 0 / 0.1); outline-offset: -1px` (dark: `rgb(255 255 255 / 0.1)`), photographic images only, never brand-tinted (make-interfaces-feel-better, ECC, MIT).
- Nested radii: outer radius = inner radius + padding; when padding is large, treat the layers as separate surfaces (make-interfaces-feel-better).
- Basic glass: backdrop blur, 1px border at about 10% white, 1px inset top highlight at about 10% white (design-taste-frontend).
- Liquid-glass web approximation (not Apple-official; design-taste-frontend): pill radius; 1px border 32% white; 135° gradient 30% → 8% white over a 12% white base; `backdrop-filter: blur(24px) saturate(180%) contrast(1.05)`; inset highlights 1px at 48% (top) / 12% (bottom); outer shadow `0 18px 60px` at 18% black. Dark: border 18%, gradient 16% → 4% over slate at 42%, shadow 42%. Reduced-transparency fallback: 96% opaque fill, no backdrop filter.
- Native iOS Liquid Glass belongs to native code (SwiftUI `glassEffect`, `GlassEffectContainer`); keep it to the navigation/control layer, avoid nested glass, test light/dark/tinted. Verify against the current SDK (liquid-glass-design, ECC, MIT; medium confidence).

### Iconography

| Spec | Value | Source |
|---|---|---|
| Families per product | 1 | design-taste-frontend, ui-ux-pro-max |
| Stroke width | 1.5 or 2 (one value globally) | same |
| Size tokens | `icon-sm` 16, `icon-md` 20-24, `icon-lg` 32 px; design at 24 | ui-ux-pro-max (md = 24) |
| Export sizes (raster/app) | 16/24/32/48 px; iOS 1x/2x/3x | design, ios-icon-gen |
| Icon-only control hit area | ≥ 24×24 CSS px (WCAG 2.2 SC 2.5.8 AA); 44×44 recommended for touch | WCAG 2.2; see [accessibility](accessibility.md) |
| Icon vs adjacent text | match cap height or x-height optically; gap 4-8 px | default — adjust per product |
| Meaningful icon contrast | ≥ 3:1 (SC 1.4.11) | WCAG 2.2 |

Style by context (design skill, heuristic): outline for web/app UI, filled for active states and mobile tab bars, duotone for marketing, sharp corners for fintech/enterprise, rounded for friendly/health products. Optically centre asymmetric glyphs (play, arrows): fix the SVG viewBox first, else nudge by 1px.

### Imagery and art-direction spec (fill before sourcing)

| Field | Example |
|---|---|
| Subject and distance | product at 3/4 view, mid shot; people only in context of use |
| Light | single soft key from upper left, warm 3200-4000K feel |
| Colour grade | low saturation, lifted blacks, accent hue appears once per image |
| Lens / perspective | 50mm-equivalent, eye level, no fisheye |
| Background | seamless neutral matching `surface` step |
| Crop ratios | hero 16:9 desktop / 4:5 mobile, cards 4:3, avatars 1:1 |
| Focal point | marked per image (x%, y%) for `object-position` |
| Negative space | text zone (left third, top band) kept low-detail |
| Forbidden | stock handshakes, generic gradients-as-content, mixed illustration styles |

Fixed aspect ratios also prevent layout shift; set `aspect-ratio` or width/height on every media element (budgets in [performance](performance.md)).

### Hierarchy checks

- Strong hierarchy: largest heading ≥ 3× body size; < 2× reads flat (impeccable).
- Exactly one primary CTA per screen (ui-ux-pro-max).
- Squint/blur test: at a 4-8px blur of the screenshot (default), the primary heading and primary CTA must still be the two most prominent shapes.
- Max distinct colours carrying meaning on one screen: neutral ramp + 1 accent + semantic roles in use.

## Implementation

Detect the project's stack first ([frontend-architecture](frontend-architecture.md)). If a preset fits, start from it ([presets](../presets/README.md)) and generate CSS with `scripts/build-tokens.mjs`, which also checks declared contrast pairs. Sibling style skills: [cinematic-noir-studio](../../cinematic-noir-studio/SKILL.md), [monochrome-editorial-portfolio](../../monochrome-editorial-portfolio/SKILL.md).

**Tailwind v4 primitives and roles (abridged; full token layering in design-tokens):**

```css
@import "tailwindcss";

@theme {
  --color-ink-50:  oklch(0.985 0.003 260);
  --color-ink-200: oklch(0.92 0.008 260);
  --color-ink-700: oklch(0.44 0.015 260);
  --color-ink-900: oklch(0.24 0.010 260);
  --color-ink-950: oklch(0.16 0.008 260);
  --color-accent-400: oklch(0.71 0.14 155);
  --color-accent-600: oklch(0.52 0.15 155);
  --shadow-e1: 0 1px 2px oklch(0.2 0.02 260 / 0.06), 0 1px 1px oklch(0.2 0.02 260 / 0.04);
  --shadow-e3: 0 4px 8px oklch(0.2 0.02 260 / 0.07), 0 12px 32px oklch(0.2 0.02 260 / 0.10);
}

:root {
  --bg: var(--color-ink-50);
  --text: var(--color-ink-900);
  --border: var(--color-ink-200);
  --accent: var(--color-accent-600);
  /* hover derived in the same space, no new hue */
  --accent-hover: color-mix(in oklch, var(--accent), black 12%);
}
```

Check `oklch()` / `color-mix()` support against the project's browser targets; if older browsers matter, emit sRGB fallbacks first (`color: #2f6f4f; color: oklch(...)`).

**Contrast check for OKLCH pairs (Node 18+, no dependencies).** OKLab → linear sRGB (Ottosson), then WCAG relative luminance:

```js
// contrast.mjs — usage: node contrast.mjs "0.24 0.01 260" "0.985 0.003 260"
const toLin = (L, C, hDeg) => {
  const h = (hDeg * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const c = (v) => Math.min(1, Math.max(0, v)); // gamut clip: approximate for out-of-gamut colours
  return [
    c(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    c(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    c(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ];
};
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const parse = (s) => {
  const n = s.trim().split(/\s+/).map(Number);
  if (n.length !== 3 || n.some(Number.isNaN)) throw new Error(`Bad OKLCH triple: "${s}"`);
  return n;
};
const [fg, bg] = process.argv.slice(2).map(parse);
const [l1, l2] = [lum(toLin(...fg)), lum(toLin(...bg))].sort((x, y) => y - x);
const ratio = (l1 + 0.05) / (l2 + 0.05);
console.log(ratio.toFixed(2), ratio >= 4.5 ? "AA text" : ratio >= 3 ? "AA large/UI only" : "FAIL");
```

Out-of-gamut colours are clipped, so the browser's gamut mapping can differ slightly; confirm borderline results (4.5-4.7) in a rendered screenshot or with axe via `scripts/visual-check.mjs --axe`.

**Text over imagery with a guaranteed scrim:**

```css
.hero-media { position: relative; isolation: isolate; }
.hero-media img { width: 100%; height: 100%; object-fit: cover; object-position: var(--focal, 50% 50%); }
.hero-media::after {
  content: ""; position: absolute; inset: 0; z-index: 0;
  background: linear-gradient(to top, oklch(0.16 0.01 260 / 0.72), oklch(0.16 0.01 260 / 0) 60%);
}
.hero-media .copy { position: absolute; inset: auto 0 0 0; z-index: 1; color: oklch(0.97 0.003 260); }
```

**Glass with fallbacks (vanilla CSS; works in any framework):**

```css
.glass {
  background: oklch(0.98 0.003 260 / 0.96);          /* fallback first: opaque */
  border: 1px solid oklch(1 0 0 / 0.32);
  border-radius: 999px;
}
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass {
    background: linear-gradient(135deg, oklch(1 0 0 / 0.30), oklch(1 0 0 / 0.08)), oklch(1 0 0 / 0.12);
    -webkit-backdrop-filter: blur(24px) saturate(180%) contrast(1.05);
    backdrop-filter: blur(24px) saturate(180%) contrast(1.05);
    box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.48), inset 0 -1px 0 oklch(1 0 0 / 0.12), 0 18px 60px oklch(0 0 0 / 0.18);
  }
}
@media (prefers-reduced-transparency: reduce) {
  .glass { background: oklch(0.98 0.003 260 / 0.96); backdrop-filter: none; -webkit-backdrop-filter: none; }
}
@media (forced-colors: active) {
  .glass { background: Canvas; border-color: CanvasText; box-shadow: none; }
}
```

`prefers-reduced-transparency` is not supported in every browser; the opaque fallback must already meet contrast on its own. Blur is GPU-expensive: limit to one or two glass layers per viewport and never animate `backdrop-filter` (cost rules in [performance](performance.md)).

**Icons (React; keep the project's library):**

```tsx
// icons.tsx — one wrapper fixes stroke and size tokens for the whole app
import type { LucideIcon } from "lucide-react"; // or the project's existing family
const sizes = { sm: 16, md: 20, lg: 24 } as const;
export function Icon({ as: Glyph, size = "md", label }: { as: LucideIcon; size?: keyof typeof sizes; label?: string }) {
  return label
    ? <Glyph size={sizes[size]} strokeWidth={1.5} role="img" aria-label={label} />
    : <Glyph size={sizes[size]} strokeWidth={1.5} aria-hidden="true" focusable="false" />;
}
```

Vanilla: inline SVG with `stroke="currentColor"`, `stroke-width="1.5"`, `aria-hidden="true"` when decorative. Prefer inline SVG with `currentColor` over baked-colour PNGs.

## Failure modes & fallbacks

| Symptom | Cause | Fix |
|---|---|---|
| Brand colour fails 4.5:1 as text | brand hue too light (yellow, cyan, lime) | keep brand for large fills; derive a darker text step in OKLCH (same H, lower L); add a non-colour cue |
| Accent drifts across pages | hard-coded hex in components | grep for raw hex/rgb/oklch outside token files; replace with role tokens |
| Dark mode looks muddy or neon | mechanical inversion | re-map roles per the dark table; reduce chroma; re-check pairs |
| Greys look dirty next to each other | mixed warm/cool neutrals (e.g. slate + stone) | collapse to one neutral ramp |
| Shadows look grey and dirty | pure-black, high-opacity single shadow | two-layer tinted shadow from the scale |
| Glass text unreadable | busy or bright imagery behind, or no backdrop support | add tint/scrim, increase fill opacity, verify the fallback alone passes contrast |
| Glass on a flat solid background looks like a grey box | nothing to blur | use a plain surface + border instead |
| Mixed icon weights | two libraries or per-icon strokeWidth | single wrapper component; one library |
| Generated or stock images look unrelated | no art-direction spec | write the spec, regenerate or re-select; mark mismatches medium severity |
| Text on image fails on mobile crop | focal point/scrim tuned only at desktop | set `object-position` per breakpoint; check scrim contrast at 375px |
| No contrast tool available | — | use the Node snippet above (only needs Node; check with `scripts/environment-audit.mjs`); if Node is absent, mark the contrast check NOT_TESTED with the reason |

## Verification

- **Gate D (accessibility):** every declared contrast pair ≥ its threshold in each theme (`scripts/build-tokens.mjs` or the snippet); rendered-page contrast via `node <skill-dir>/scripts/visual-check.mjs --url <url> --out <dir> --axe` if Playwright is resolvable (exit code 4 = BLOCKED); otherwise use browser MCP tools only if their status in [capability-registry](capability-registry.md) is `available-verified`, else NOT_TESTED. Check non-colour cues on errors, links and charts manually.
- **Gate C (visual quality):** screenshot each key screen in light and dark ([visual-testing](visual-testing.md)) and run the [visual-critique](visual-critique.md) rubric for: accent consistency, single grey temperature, one primary CTA, icon consistency, image series consistency, glass only over texture.
- **Static checks:** grep for raw colour literals outside token files (`#[0-9a-f]{3,8}\b`, `rgb\(`, `oklch\(`), for more than one icon package in `package.json`, and for `backdrop-filter` without a fallback block.
- **Gate E:** count glass layers per viewport and confirm no animated `backdrop-filter` ([performance](performance.md)).
- **Gate G:** every image and icon set has a recorded source and licence in the asset manifest ([asset-generation](asset-generation.md), `templates/asset-manifest.json`).
- Record each result with PASS/FAIL/BLOCKED/NOT_TESTED/NOT_APPLICABLE and the evidence, per [quality-gates](quality-gates.md).

## Sources

Installed skills (paraphrased; licences as recorded in the audit):
- design-taste-frontend (taste-skill) — accent lock, one grey temperature, card discipline, icon discipline, glass and liquid-glass approximation values. Licence: none found; ideas paraphrased only.
- impeccable — colour commitment axis (Restrained/Committed/Full/Drenched), hierarchy size ratios. Licence: none found locally (its detector scripts are Apache-2.0); paraphrased.
- make-interfaces-feel-better (ECC) — borders vs shadows, photo outline values, concentric radius, optical alignment. MIT (ECC plugin licence).
- liquid-glass-design (ECC) — native iOS glass usage. MIT (ECC plugin licence).
- taste (ECC) — one accent per section. MIT (ECC plugin licence).
- ui-ux-pro-max — icon tokens, one primary CTA, style-coherent effects, chart colour rules (owned by [dashboard-engineering](dashboard-engineering.md)). Licence: none found; paraphrased.
- design and brand (claudekit) — icon style by context, export sizes, palette size and colour budget, no pure #000 text. Licence: MIT in frontmatter (one bundle has an Apache-2.0 LICENSE.txt conflict); attribution given here.
- ios-icon-gen — icon licence recording, SF Symbols restriction. Licence as recorded in the audit digest.
- frontend-design (Anthropic) — structure-is-information rule. Licence: likely Apache-2.0, unverified.

External references (standards and specifications; cited from known published versions, not fetched during this build — re-check if a value is disputed; date of writing 2026-10-24):
- WCAG 2.2, SC 1.4.1, 1.4.3, 1.4.11, 2.5.8 — https://www.w3.org/TR/WCAG22/
- CSS Color Module Level 4 (`oklch()`), Level 5 (`color-mix()`) — https://www.w3.org/TR/css-color-4/ , https://www.w3.org/TR/css-color-5/
- Björn Ottosson, "A perceptual color space for image processing" (OKLab matrices) — https://bottosson.github.io/posts/oklab/
- MDN, `backdrop-filter`, `prefers-reduced-transparency`, `forced-colors` — https://developer.mozilla.org/
- Tailwind CSS v4 theme variables — https://tailwindcss.com/docs/theme
