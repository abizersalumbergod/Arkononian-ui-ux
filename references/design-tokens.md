# Design tokens

How design decisions become named, themeable values: the three-tier token architecture, naming, light/dark theming, Tailwind v4 `@theme`, motion/z-index/focus tokens, and the preset → CSS pipeline. Use it so that components never hold raw values and a theme or brand change touches one layer only.

**Load when:** creating or refactoring a design system, adding dark mode or theming, adopting a preset, wiring Tailwind v4, auditing hardcoded values, or adding project brand overrides. **Owns:** token architecture (primitive → semantic → component), token naming, theming and dark-mode mechanics, Tailwind v4 `@theme` bridge, z-index / focus-ring / motion token *names and wiring*, presets → CSS with `build-tokens.mjs`, override strategy.
**Related:** [visual-systems](visual-systems.md), [typography-and-layout](typography-and-layout.md), [motion-engineering](motion-engineering.md), [interaction-design](interaction-design.md), [accessibility](accessibility.md), [frontend-architecture](frontend-architecture.md), [quality-gates](quality-gates.md), [presets](../presets/README.md), [design-system workflow](../workflows/design-system.md), [build-tokens script](../scripts/build-tokens.mjs)

Colour choice, palette construction and imagery live in [visual-systems](visual-systems.md); type scale and spacing rhythm values live in [typography-and-layout](typography-and-layout.md); timing and easing choices live in [motion-engineering](motion-engineering.md). This file defines how those values are stored, named, themed and consumed.

## Decision rules

1. Detect the stack before writing a token: Tailwind major version (`tailwindcss` in `package.json`; v4 = CSS-first `@theme`, v3 = `tailwind.config.*`), existing token files (`tokens.css`, `globals.css` `:root` blocks, `design-tokens.json`), `components.json` (shadcn), CSS-in-JS themes. If tokens exist, extend them; never introduce a parallel system (see [frontend-architecture](frontend-architecture.md)).
2. Use three tiers: primitive (raw values) → semantic (purpose) → component (binding). Components read semantic or component tokens only. Never reference a primitive, raw hex, raw `px` spacing or a Tailwind palette class (`bg-blue-600`) inside a component.
3. Switch themes only in the semantic tier. Primitives never change per theme; component tokens re-point automatically because they alias semantics.
4. Ship every surface role with a paired foreground (`surface` / `on-surface` or `accent` / `accent-contrast`) and declare the pair as a contrast pair. A role without a measured foreground is incomplete.
5. Name tokens by purpose, never by value: `--color-text-muted`, not `--color-gray-500` at the semantic tier and never `--blue-button`. Grammar is in Specifications; keep one name per concept across CSS, Tailwind and docs.
6. Promote a value to a token only when it is used 3+ times with the same intent; keep visually similar but semantically different values separate; never mint a token per arbitrary value.
7. Choose one theming strategy per project: semantic CSS variables swapped by `[data-theme]` with a `prefers-color-scheme` fallback. Do not mix it with paired `dark:` utilities on the same components. If the project already uses `.dark` (shadcn default), keep `.dark` and map it to the same semantic layer.
8. Design dark mode, do not invert it: lighter surfaces for depth instead of shadows, slightly desaturated accents, no pure `#000` / `#fff` pairs for large areas, and hierarchy parity (a CTA that stands out in light must stand out in dark). Never default a product to dark; a single-theme preset pins its theme with `<html data-theme="dark">` and says so.
9. Set the theme before first paint with a tiny inline head script that writes `data-theme` on `<html>`. Put `suppressHydrationWarning` on `<html>` only, never on a subtree.
10. Gate contrast at token level, in both themes, using unrounded ratios: text ≥ 4.5:1, large text ≥ 3:1, borders that identify controls, focus rings, essential icons and chart series ≥ 3:1 against adjacent colours (WCAG 2.2 SC 1.4.3, 1.4.11). Declare each real pairing in `contrastPairs` and let `build-tokens.mjs` fail the build.
11. Use a named z-index scale; never `999`, `9999` or ad-hoc values. Prefer the top layer (`<dialog>.showModal()`, `popover`) for overlays so z-index is not needed (see [interaction-design](interaction-design.md)).
12. Define focus-ring tokens once (`--focus-ring-color`, `--focus-ring-width`, `--focus-ring-offset`) and consume them in every interactive component; the ring colour must reach 3:1 against every surface it can appear on, in both themes.
13. Expose motion as named duration and easing tokens, and collapse durations under `prefers-reduced-motion: reduce`. Never inline durations, cubic-beziers or spring configs in components. Choice of values belongs to [motion-engineering](motion-engineering.md).
14. Lock one radius system per page (all sharp, all soft, or a documented mix such as pill buttons + 16px cards + 8px inputs) and derive steps from one base token.
15. Apply project and brand overrides at the semantic tier in a separate file loaded after generated tokens. Never hand-edit generated files; regenerate them. Component tokens fall back to semantics (`var(--button-bg, var(--color-accent))`) so overrides do not break components.
16. Treat presets as starting points: pick one only when product, audience and task fit (`intendedFor` / `notFor`), run `build-tokens.mjs --check` first, and let client brand guidelines and existing working conventions override it ([SKILL.md](../SKILL.md) §2). Replacing user-authored token files (`--force`) is overwriting user work: ask first.
17. Before finishing, audit drift: count hardcoded colours, spacing and font sizes in component sources and either tokenise them or record why not.

## Specifications

### Tiers

| Tier | Holds | Example | Changes per theme | Consumed by |
|---|---|---|---|---|
| Primitive | raw values, full ramps | `--blue-600: oklch(0.55 0.2 260)`, `--space-4: 16px` | never | semantic tier only |
| Semantic | purpose aliases | `--color-accent: var(--blue-600)`, `--space-component-md: var(--space-3)` | yes (theme, brand, density) | components, utilities |
| Component | per-component bindings | `--button-bg: var(--color-accent)`, `--button-h: 40px` | no (follows semantic) | that component only |

Source: design-system (claudekit) three-layer model; design-system (ECC) taxonomy.

### Naming grammar

`--<category>-<role>[-<variant>][-<state>]`, kebab-case, lowercase.

| Category | Pattern | Examples |
|---|---|---|
| colour | `--color-<role>[-<state>]` | `--color-surface-raised`, `--color-accent-hover`, `--color-text-muted` |
| on-colour | `--color-<role>-contrast` or `--color-on-<role>` (pick one per project) | `--color-accent-contrast` (bundled presets) |
| space | `--spacing-<step>` (primitive), `--space-<use>-<size>` (semantic) | `--spacing-4`, `--space-section-lg` |
| radius | `--radius-<size>` | `--radius-sm`, `--radius-full` |
| shadow / elevation | `--shadow-<level>` | `--shadow-sm` … `--shadow-2xl` |
| type | `--font-<role>`, `--text-<step>`, `--leading-<step>`, `--tracking-<step>` | `--font-display`, `--text-lg` |
| motion | `--duration-<name>`, `--ease-<name>` | `--duration-fast`, `--ease-standard` |
| z-index | `--z-<layer>` | `--z-modal` |
| focus | `--focus-ring-<prop>` | `--focus-ring-width` |
| component | `--<component>-<prop>[-<state>]` | `--button-bg-hover`, `--input-border-invalid` |

Tailwind v4 maps namespaces to utilities (`--color-*` → `bg-*`/`text-*`, `--radius-*`, `--shadow-*`, `--font-*`, `--text-*`, `--spacing`, `--breakpoint-*`, `--container-*`, `--ease-*`, `--animate-*`; Tailwind docs, research r02). Keep these prefixes so utilities are generated. `build-tokens.mjs` converts camelCase preset keys to kebab-case (`surfaceRaised` → `--color-surface-raised`).

### Semantic colour role inventory

Required by `schemas/preset.schema.json` (summarised in [presets](../presets/README.md)) in every palette: `background`, `surface`, `surfaceRaised`, `text`, `textMuted`, `border`, `accent`, `accentContrast`, `focusRing`, `success`, `warning`, `danger`. Bundled presets add `borderStrong` for input/control boundaries. Extend as needed (shadcn-style inventory: background/foreground, card, popover, primary, secondary, muted, accent, destructive, each with `-foreground`, plus border, input, ring). Define every extra role in both palettes, or it will not switch with the theme (`build-tokens.mjs` warns).

| Pair to declare | Minimum | Standard |
|---|---|---|
| `text` on `background`, `surface`, `surfaceRaised` | 4.5 | WCAG 1.4.3 |
| `textMuted` on every surface it sits on | 4.5 (raise it; muted text is the usual failure) | WCAG 1.4.3 |
| `accentContrast` on `accent` (button labels) | 4.5 (3 only if label is ≥ 24px or ≥ 18.66px bold) | WCAG 1.4.3 |
| `accent` as link/text on `background` | 4.5 | WCAG 1.4.3 |
| `borderStrong` (input boundary) on `background` | 3 | WCAG 1.4.11 |
| `focusRing` on `background` and on `accent` | 3 | WCAG 1.4.11 / 2.4.7 |
| `success`/`warning`/`danger` used as text or icon | 4.5 text, 3 icon | WCAG 1.4.3 / 1.4.11 |

Known failing defaults to check (computed in the audit): muted text on muted surface ~4.4:1, white on green-600 ~3.3:1, white on blue-500 ~3.7:1; an auto-extracted system measured muted text 2.52:1 and white-on-accent 1.82:1. Ratios are not rounded: 4.499 fails. Disabled controls and decoration are exempt (WCAG 1.4.3 exceptions).

Overlay/scrim token: `--color-scrim` at 40-60% black (ui-ux-pro-max). Use explicit overlay tokens instead of ad-hoc alpha, except for focus rings and interactive state layers (impeccable).

### Dark-mode values (defaults — adjust per brand)

- Surfaces step up in lightness for elevation, for example OKLCH L 15% / 20% / 25% at the same hue and chroma (impeccable colorize).
- Brand-tinted near-black around OKLCH L 12-18% is acceptable for `background`; neutrals either chroma 0 or tinted 0.005-0.015 toward the brand hue, one doctrine per project (impeccable).
- Accents slightly desaturated versus light mode; re-measure every pair, never infer dark contrast from light.
- One theme per page; sections do not invert unless the brief asks for a colour-block story (design-taste-frontend). Scoped `data-theme` on a section (monochrome-editorial "rooms") is the sanctioned mechanism.

### Spacing, density, radius, elevation

| Token set | Values | Source |
|---|---|---|
| Primitive spacing | 4px base, 0-96px, half steps 2/6/10/14 (21 steps) | design-system (claudekit) |
| Component padding | xs/sm/md/lg = 4/8/12/16px | design-system (claudekit) |
| Section spacing | sm/md/lg = 32/48/64px | design-system (claudekit) |
| Page gutters | 16px horizontal, 24px vertical (mobile default) | design-system (claudekit) |
| Density dial | 1-3 spacious 24-96px range; 4-7 standard 16-64px; 8-10 dense 8-32px | ui-ux-pro-max |
| Control sizes | sm 32px h / 12px pad / 12px text; md 40 / 16 / 14; lg 48 / 24 / 16; touch hit area ≥ 44px | design-system (claudekit) |
| Radius | one `--radius` base (shadcn default 0.5rem); md = base − 2px, sm = base − 4px; `--radius-full: 9999px` | web-artifacts-builder (shadcn model) |
| Shadow | one scale sm → 2xl shared by cards, sheets, modals; dark mode leans on surface lightness | design-system (claudekit), impeccable |

Spacing values themselves are owned by [typography-and-layout](typography-and-layout.md); this table fixes the token names and tiers.

### Z-index scale (default — adjust per product)

| Token | Value | Use |
|---|---|---|
| `--z-base` | 0 | in-flow content |
| `--z-raised` | 10 | sticky table headers inside a scroller, card hover lift |
| `--z-dropdown` | 1000 | non-top-layer menus and selects |
| `--z-sticky` | 1100 | sticky site header, bottom nav |
| `--z-overlay` | 1150 | custom scrim (only if not using `<dialog>`) |
| `--z-modal` | 1200 | custom modal (only if not using `<dialog>`) |
| `--z-popover` | 1300 | portalled popovers |
| `--z-toast` | 1350 | toast stack |
| `--z-tooltip` | 1400 | tooltips |

Order follows design-system (claudekit) named layers (dropdown 1000 … tooltip 1400) with impeccable's ordering dropdown < sticky < backdrop < modal < toast < tooltip. Elements in the browser top layer (`showModal()`, `popover`) sit above all of these regardless of z-index.

### Focus-ring tokens

`--focus-ring-width: 2px` (range 2-3px), `--focus-ring-offset: 2px`, `--focus-ring-color: var(--color-focus-ring)`; identical across components; ≥ 3:1 against adjacent colours (impeccable; WCAG 1.4.11). Where the ring can land on the accent colour, use a two-tone ring (offset gap in `--color-background` plus the ring colour) so it passes on both.

### Motion tokens (names and wiring; values owned by motion-engineering)

Preset schema requires `durations.fast/base/slow` and `easings.standard/emphasized/exit`. Recommended extended ladder (synthesis of emil-design-eng, transitions-dev, ecc:motion-foundations): `--duration-micro: 80ms`, `--duration-quick: 150ms`, `--duration-fast: 250ms`, `--duration-medium: 350ms`, `--duration-slow: 450ms`, `--duration-emphasis: 500ms` (marketing only). Easings from the named set only: `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`, `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`, `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`, `--ease-sharp: cubic-bezier(0.4, 0, 0.2, 1)`. Spring presets live in JS (`motion/react` config objects in one module), never inline. Under `prefers-reduced-motion: reduce`, `build-tokens.mjs` collapses durations to `0.01ms`.

### Tunable knobs (optional)

For explorations, author variants against knobs: `--p-density` 0.6-1.4, `--p-scale` 0.85-1.3 step 0.05, colour amount 0-1; at most 4 knobs per large composition. On acceptance, bake the chosen values into semantic tokens and delete unused branches (impeccable live mode).

## Implementation

### 1. Detect

```bash
node -e "const p=require('./package.json');console.log({tw:(p.dependencies||{}).tailwindcss||(p.devDependencies||{}).tailwindcss})"
```

Then search the repo for `@theme`, `tailwind.config.`, `components.json`, `:root {`, `data-theme`, `.dark`. Or run [environment-audit](../scripts/environment-audit.mjs) with `--project <dir>` and read `project.styling` / tailwind version. Tailwind current major is 4 (4.3.x in Oct 2026 per research r02; verify at runtime: `npm view tailwindcss version`).

### 2. Generate from a preset

```bash
node <skill-dir>/scripts/build-tokens.mjs --preset precision-saas --check            # validate + contrast, writes nothing
node <skill-dir>/scripts/build-tokens.mjs --preset precision-saas --out src/styles/tokens
node <skill-dir>/scripts/build-tokens.mjs --preset ./design/brand-preset.json --out src/styles/tokens --json
```

Exit codes: `0` valid and all pairs pass; `1` a pair fails or cannot be measured (nothing written); `3` invalid preset; `64` usage error or refused overwrite. Fix the colour, never lower `min`. Outputs: `tokens.css` (`:root` values; light colours on `:root` and `[data-theme="light"]`; dark colours on `[data-theme="dark"]` and under `prefers-color-scheme: dark` unless `data-theme="light"` is set; reduced-motion collapse) and `theme.tailwind.css` (`@theme` with the same names, light values). For a brand with no fitting preset, build a preset JSON from the brand per [presets/README.md](../presets/README.md) instead of bending a bundled one.

### 3. Tailwind v4 entry stylesheet

```css
/* app/globals.css — order matters */
@import "tailwindcss";
@import "./tokens/theme.tailwind.css"; /* @theme: registers utilities (bg-surface, text-text-muted …) */
@import "./tokens/tokens.css";         /* runtime values incl. [data-theme] + prefers-color-scheme */
@import "./brand-overrides.css";       /* project semantic overrides, hand-written */

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

Utilities resolve to `var(--color-surface)`, so the later runtime blocks switch them. The `@custom-variant` line keeps any legacy `dark:` utilities consistent with `data-theme` (Tailwind v4 docs; verify against the installed version). Avoid dynamically concatenated class names (`bg-${tone}`); map tones to full class strings so the scanner emits them (ui-styling). shadcn on v4: leave `tailwind.config` blank in `components.json` and keep tokens in CSS (research r02).

### 4. Hand-written semantic + component tiers (no preset)

```css
:root {
  /* primitives */
  --gray-50: oklch(0.985 0 0); --gray-900: oklch(0.21 0 0); --gray-950: oklch(0.145 0 0);
  --blue-600: oklch(0.546 0.215 262.9); --blue-700: oklch(0.488 0.217 264.4);
  /* semantic (light) */
  --color-background: var(--gray-50);
  --color-text: var(--gray-900);
  --color-accent: var(--blue-600);
  --color-accent-hover: var(--blue-700);
  --color-accent-contrast: oklch(1 0 0);
  --color-focus-ring: var(--blue-600);
  --focus-ring-width: 2px; --focus-ring-offset: 2px;
}
[data-theme="dark"] {
  --color-background: var(--gray-950);
  --color-text: var(--gray-50);
  /* accent, hover and ring re-measured for dark surfaces */
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* same declarations as [data-theme="dark"] */ }
}

/* component tier: private variables, variants re-point them */
.btn {
  --_bg: var(--button-bg, var(--color-accent));
  --_fg: var(--button-fg, var(--color-accent-contrast));
  --_h: var(--button-h, 40px);
  background: var(--_bg); color: var(--_fg); min-block-size: var(--_h);
  border-radius: var(--radius-md);
  transition: background-color var(--duration-quick) var(--ease-out);
}
.btn:focus-visible {
  outline: var(--focus-ring-width) solid var(--color-focus-ring);
  outline-offset: var(--focus-ring-offset);
}
@media (hover: hover) and (pointer: fine) {
  .btn:hover { --_bg: var(--button-bg-hover, var(--color-accent-hover)); }
}
.btn[data-size="sm"] { --_h: 32px; }
.btn[data-size="lg"] { --_h: 48px; }
```

Duplicate the dark declarations in both blocks (or generate them, as `build-tokens.mjs` does); CSS cannot share one block between a selector and a media query without a preprocessor. Variants change variables, never rules. State styling per component is specified in [interaction-design](interaction-design.md).

### 5. No-flash theme (Next.js App Router)

```tsx
// app/layout.tsx
const themeScript = `(()=>{try{var t=localStorage.getItem('theme');
if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
```

No stored choice → no attribute → `prefers-color-scheme` decides. The script is a static string (no user input), so it is not an injection path; if the project has a strict CSP, add a nonce or hash (see [security-and-privacy](security-and-privacy.md)). Vanilla sites: put the same IIFE inline in `<head>` before stylesheets apply.

```ts
// theme toggle (client); three states: 'light' | 'dark' | 'system'
export function setTheme(choice: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.theme; else root.dataset.theme = choice;
  try { choice === 'system' ? localStorage.removeItem('theme') : localStorage.setItem('theme', choice); }
  catch { /* storage blocked: theme still applies for this page view */ }
}
```

Also set `color-scheme: light dark` on `:root` (and `color-scheme: dark` under `[data-theme="dark"]`) so native controls and scrollbars match.

### 6. Tailwind v3 or no Tailwind

v3: keep the same CSS variables and point `theme.extend.colors` at them (`surface: 'var(--color-surface)'`); do not upgrade the major version unless the user asks. No Tailwind: import `tokens.css` and use the variables directly; ignore `theme.tailwind.css`. CSS-in-JS: expose the variables, not JS copies of values, so theme switching stays in CSS.

### 7. Interchange format and brand sync

When tokens must travel (Figma, other platforms), store them as W3C DTCG JSON (`$value`, `$type`) and generate CSS from it; keep one canonical brand source and regenerate token files from it rather than editing outputs (brand; design-system ECC). Check for a design-tool MCP with the current host's tool-discovery interface before promising Figma sync; status must be `available-verified` in [capability-registry](capability-registry.md), and pushing to a third-party file needs user approval.

### 8. Drift audit

```bash
rg -n --glob '!**/tokens/**' -e '#[0-9a-fA-F]{3,8}\b' -e 'rgba?\(' src | wc -l      # raw colours outside token files
rg -n -e '\[(\d+px|#[0-9a-fA-F]{3,8})\]' src | wc -l                                  # Tailwind arbitrary values
rg -n -e 'z-index:\s*\d{3,}' -e 'z-\[\d+\]' src                                       # ad-hoc z-index
```

Report tokens defined vs hardcoded instances per category, per-component completeness (states, variants, docs) out of 10, and the top 3 highest-impact fixes (design-system, Anthropic design plugin). Adapt the tally to inherit conventions: in a small repo (≤ ~50 files) a 3-vs-2 split is not a majority; ask about strong forks (inherit-legacy-style).

## Failure modes & fallbacks

| Symptom | Cause | Fix |
|---|---|---|
| Flash of wrong theme on load | theme set in React effect | inline head script (Implementation 5) |
| Dark mode ignores explicit "light" choice | media query not guarded | use `:root:not([data-theme="light"])` inside `prefers-color-scheme` |
| Utilities stuck on light values | `theme.tailwind.css` imported after `tokens.css`, or `@theme` holds literals only | import order: tailwindcss → theme → tokens → overrides |
| Extra role does not switch | defined in one palette only | define in both; heed the build-tokens warning |
| `build-tokens` exit 1 | a declared pair fails | adjust the colour (darken fill or lighten text); never lower `min` |
| `build-tokens` exit 64 on `--out` | target file not generated by the script | ask the user before `--force`; or write to a new folder |
| Classes missing in production | dynamic class concatenation | static class maps |
| Focus ring invisible on accent buttons | ring colour = accent | two-tone ring or offset gap in background colour |
| Hardcoded SVG/icon fills ignore theme | `fill="#111"` | `fill="currentColor"` or a token |
| Translucent token passes on paper, fails on image | measured against flat bg only | add scrim token; check worst-case region manually (axe reports these as "incomplete") |
| Nested `data-theme` section inherits wrong muted colours | semantic values not redefined on the section | the section selector must redeclare the full semantic set (build-tokens output does) |
| No Node available | script cannot run | hand-write tokens per Implementation 4; compute contrast with a verified tool or mark the contrast check NOT_TESTED |

## Verification

Feeds Gate D (contrast, focus visibility), Gate C (theme parity, consistency) and Gate A (only when changing this skill).

1. `node <skill-dir>/scripts/build-tokens.mjs --preset <file> --check` exits 0; record the summary as Gate D evidence (`tool: build-tokens.mjs`).
2. When changing bundled presets: `node --test tests/` passes (Gate A).
3. Drift audit (Implementation 8): zero raw colours and ad-hoc z-index in component sources, or each exception recorded.
4. Render both themes: run [visual-check](../scripts/visual-check.mjs) or verified browser tools with `data-theme="light"`, `data-theme="dark"` and system dark emulation; with `--axe` where resolvable. If the browser capability is not `available-verified`, mark the theme render check NOT_TESTED with the reason.
5. Reload with the stored theme opposite to the OS setting: no flash, no hydration warning in the console (Gate H).
6. Tab through one representative screen in each theme: focus ring visible on every surface, including accent buttons.
7. Toggle `prefers-reduced-motion: reduce`: transitions collapse.

## Sources

Installed skills (paraphrased; licences per the audit digest, see [LICENSES_AND_PROVENANCE](../LICENSES_AND_PROVENANCE.md)):
- design-system (claudekit), MIT (frontmatter): three tiers, role inventory, spacing aliases, control sizes, named z-index layers, property-by-state matrix.
- ui-styling (claudekit), licence conflict (frontmatter MIT vs LICENSE.txt Apache-2.0): Tailwind v4 CSS-first bridge, static class names.
- design-system (ECC plugin 2.2.3), MIT: token taxonomy, generate-from-codebase pipeline, DTCG format.
- inherit-legacy-style, frontend-design-direction (ECC), MIT: reuse before inventing, convention tally thresholds.
- ecc:motion-foundations, MIT: duration and spring presets.
- design-system, design-handoff (Anthropic design plugin), no LICENSE file (likely Apache-2.0, unverified): drift audit scoring.
- impeccable, none found (detector Apache-2.0): OKLCH dark surfaces, neutral tint doctrine, overlay tokens, focus ring spec, knobs. Ideas only.
- design-taste-frontend, none found: radius lock, one theme per page. Ideas only.
- ui-ux-pro-max, none found: density dial, scrim range. Ideas only.
- emil-design-eng, transitions-dev, none found: easing and duration values (numbers only, cited).
- brand (claudekit), none declared: single brand source synced to tokens. Ideas only.
- react-performance (ECC rules), MIT (ECC root licence): pre-hydration theme script.
- web-artifacts-builder: shadcn radius derivation (paraphrased; licence not recorded in the brief).
- notion-design, none found: used only as a source of measured contrast failures.

External (retrieved 2026-10 via the research briefs r01/r02):
- WCAG 2.2 Understanding 1.4.3 Contrast (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- WCAG 2.2 Understanding 1.4.11 Non-text Contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- Tailwind CSS theme variables: https://tailwindcss.com/docs/theme ; v4.3 notes: https://tailwindcss.com/blog/tailwindcss-v4-3 ; upgrade guide: https://tailwindcss.com/docs/upgrade-guide
- shadcn components.json: https://ui.shadcn.com/docs/components-json
