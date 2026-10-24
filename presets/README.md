# Presets

A preset is a **starting token set**, never a forced style. It holds colour roles (a light palette and usually a dark one), typography, radius, spacing, shadow, motion tokens and the contrast pairs that must hold. Pick one only when it fits the product, audience and task. Use it as raw material: a client's brand guidelines and an existing project's working conventions always override it. Accessibility and product goals also rank above any preset (see the precedence list in [SKILL.md](../SKILL.md)). How to choose a visual direction lives in [design-intelligence](../references/design-intelligence.md). Token architecture (primitive → semantic → component), theming and the Tailwind v4 pipeline live in [design-tokens](../references/design-tokens.md).

| Preset | Feel | Palettes | Type |
|---|---|---|---|
| [cinematic-noir](cinematic-noir.json) | Dark-first poster drama: near-black canvas, one ember accent, hairlines instead of shadows, expressive easing | dark (reference) + light (daylight variant) | Anton display, Inter text, system mono |
| [monochrome-editorial](monochrome-editorial.json) | Achromatic gallery: paper sections, dark "rooms", uppercase extra-bold grotesk, mono metadata | light + dark (rooms) | Plus Jakarta Sans, JetBrains Mono |
| [precision-saas](precision-saas.json) | Dense, neutral product UI: zinc greys, one blue accent, 4 px grid, small radii, 120-200 ms motion | light + dark | Inter, JetBrains Mono for numbers |
| [warm-commerce](warm-commerce.json) | Warm and trustworthy: off-white paper, deep warm ink, terracotta accent with olive secondary, soft radii | light + dark | Fraunces display, Source Sans 3 text |

Each preset also lists `intendedFor` and `notFor`; read both before choosing.

## Product type → preset

| Product type | Start from | Notes |
|---|---|---|
| SaaS app, admin panel, analytics dashboard, internal tool, CRM, developer tool | `precision-saas` | Density first; keep the accent for primary actions, focus and selection. |
| Marketing, pricing or docs pages for such a product | `precision-saas` | Raise `base` and `display` sizes for reading; keep the app's tokens for continuity. |
| Online store, DTC brand, product detail, cart and checkout, food and beverage, hospitality, booking | `warm-commerce` | Terracotta for add-to-cart and links; olive only for badges. |
| Designer, photographer or architect portfolio, editorial site, case studies, magazine, personal site | `monochrome-editorial` | Colour stays out of the UI chrome; imagery and type scale carry the brand. |
| Creative studio or agency, launch or campaign page, film, music or fashion storytelling, immersive 3D | `cinematic-noir` | Only when strong imagery exists; pin the look with `<html data-theme="dark">`. |
| An existing brand or design system, or nothing above fits | none | Build a preset from the brand (next section) instead of bending one of these. |

[routing/routes.json](../routing/routes.json) lists the suggested presets for each route; the suggestion never overrides the user's brand or an existing project.

## Building tokens

[scripts/build-tokens.mjs](../scripts/build-tokens.mjs) turns a preset into CSS. It needs only Node 18 or newer and makes no network requests.

```bash
# validate the preset and measure every contrast pair; writes nothing
node scripts/build-tokens.mjs --preset precision-saas --check

# write tokens.css and theme.tailwind.css into a folder of the target project
node scripts/build-tokens.mjs --preset precision-saas --out ./src/styles/tokens

# a custom preset file, with a machine-readable summary
node scripts/build-tokens.mjs --preset ./design/brand-preset.json --out ./src/styles/tokens --json
```

`--preset` takes a file path or a bundled preset name. Without `--out` or `--check`, both stylesheets go to stdout and the summary goes to stderr. With `--out`, existing files are replaced only if build-tokens generated them; `--force` is required to replace anything else.

What it writes:

- `tokens.css`: `--font-*`, `--text-*`, `--leading-*`, `--tracking-*`, `--radius-*`, `--spacing-*`, `--shadow-*`, `--duration-*` and `--ease-*` on `:root`. Light colours (`--color-*`, keys converted to kebab-case, so `surfaceRaised` becomes `--color-surface-raised`) apply on `:root` and `[data-theme="light"]`. Dark colours apply on `[data-theme="dark"]` and, unless `<html data-theme="light">` is set, under `prefers-color-scheme: dark`. `data-theme` also works on a single section, which is how monochrome-editorial's dark rooms are scoped. Durations collapse to `0.01ms` under `prefers-reduced-motion: reduce`.
- `theme.tailwind.css`: a Tailwind CSS v4 `@theme` block with the same variable names (light values) plus `--default-font-family` and transition defaults. Import order: `@import "tailwindcss";`, then `theme.tailwind.css`, then `tokens.css`, so utilities such as `bg-surface` or `text-text-muted` follow the runtime theme.
- The summary includes a Google Fonts stylesheet URL built from each font role's `family` and `weights` (only roles whose `source` is Google Fonts). Nothing is fetched at build time; add the `<link>` yourself.

Exit codes: `0` valid and every pair meets its minimum, `1` a pair is below its minimum or cannot be measured (nothing is written), `3` invalid preset (bad JSON, schema errors, unsafe token values), `64` usage error or a refused overwrite.

Contrast uses the WCAG 2.x relative-luminance formula. Translucent colours are painted over the palette `background` first; colours outside sRGB are clipped and flagged. The pass/fail decision uses the unrounded ratio, and reported ratios are floored to two decimals. Supported colour syntax for measured pairs: hex, `rgb()`, `hsl()`, `lab()`, `lch()`, `oklab()`, `oklch()` and `color()` in srgb, srgb-linear, display-p3 and xyz spaces.

## Creating a new preset

1. Copy the closest preset to `presets/<name>.json` and set `name` to the same lowercase-hyphenated name. Keep `"$schema": "../schemas/preset.schema.json"`; the full contract is [schemas/preset.schema.json](../schemas/preset.schema.json).
2. Write `description`, `intendedFor` and `notFor` honestly; `notFor` is what stops a preset from being applied everywhere. Set `sourceSkill` when the values come from an installed style skill.
3. Fill every required colour role in each palette: `background`, `surface`, `surfaceRaised`, `text`, `textMuted`, `border`, `accent`, `accentContrast`, `focusRing`, `success`, `warning`, `danger`. Extra roles are allowed. Define each extra role in both palettes, or build-tokens warns that it will not switch with the theme. The bundled presets use `borderStrong` for input and control boundaries.
4. Fonts: use Google Fonts families under OFL or Apache-2.0, or system fonts, and record `source` and `license` for each role. List only weights the family actually ships, because Google Fonts rejects the whole stylesheet request when one weight is missing.
5. Declare `contrastPairs` for every pairing the UI really uses: 4.5 for body text, 3 for large text, focus indicators and control boundaries (WCAG 1.4.3 and 1.4.11). Omit `theme` to check a pair in every palette.
6. Run `node scripts/build-tokens.mjs --preset presets/<name>.json --check` until it exits 0, then `node --test tests/tokens.test.mjs`, which validates every bundled preset and its pairs.

## Style skills behind two presets

`cinematic-noir` and `monochrome-editorial` carry only the tokens of two installed style skills. The art direction, motion choreography, page blueprints and component specs stay in the skills themselves. Each preset's `$comment` lists where it deliberately departs from the skill (for example, accent text colours that the reference left below 4.5:1).

- [cinematic-noir-studio](../../cinematic-noir-studio/SKILL.md)
- [monochrome-editorial-portfolio](../../monochrome-editorial-portfolio/SKILL.md)

These skills are separate folders next to this package. Check that they exist before you link to them or invoke them from a project.
