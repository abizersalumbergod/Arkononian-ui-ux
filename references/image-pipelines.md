# Image pipelines

Turn approved image sources into correctly formatted, responsive, fast-loading images, and write image generation prompts that produce usable raw material. Covers format choice per role, `srcset`/`sizes`, loading hints, `next/image`, sharp encoding, art-directed crops, transparency and byte budgets.

**Load when:** any page that ships photos, illustrations, screenshots, textures, logos or icons; `ecommerce` and `portfolio-editorial` routes; image/photo/illustration keywords; stage 6 (Assets) after the route is chosen in [asset-generation](asset-generation.md). **Owns:** image formats per role, responsive image markup, loading/priority hints, next/image configuration, sharp recipes, art-directed crops, transparent assets, image prompt patterns, per-image size targets.
**Related:** [asset-generation](asset-generation.md), [visual-systems](visual-systems.md), [performance](performance.md), [responsive-design](responsive-design.md), [accessibility](accessibility.md), [video-pipelines](video-pipelines.md), [security-and-privacy](security-and-privacy.md), [frontend-architecture](frontend-architecture.md), [capability-registry](capability-registry.md), [asset-production workflow](../workflows/asset-production.md), [asset-validation script](../scripts/asset-validation.mjs)

## Decision rules

1. Detect the stack first ([frontend-architecture](frontend-architecture.md)): if the project uses a framework image component (next/image, Astro Image, Nuxt Image), use it; otherwise emit `<picture>` markup from a build step. Never mix both for the same image.
2. Photos: serve AVIF, then WebP, then a JPEG fallback. UI screenshots and images with text: lossless (PNG or lossless WebP). Icons and logos: SVG. Transparent raster fallback: PNG.
3. Do not emit JPEG XL by default (about 60% global support, no Edge); add it only as an extra first `<source>` when the build already produces it.
4. Every `<img>` has `width` and `height` (or a CSS `aspect-ratio`) matching the intrinsic ratio, so layout never shifts.
5. Every `srcset` with `w` descriptors has a `sizes` that matches the rendered layout width; never rely on the implicit `100vw` for images narrower than the viewport.
6. Exactly one image per view gets `fetchpriority="high"`: the LCP candidate. Never put `loading="lazy"` on it. Lazy-load everything below the fold with `loading="lazy" decoding="async"`.
7. If the LCP image is a CSS background, preload it with `<link rel="preload" as="image" fetchpriority="high">` including `imagesrcset`/`imagesizes`; better, make it an `<img>`.
8. Limit `<picture>` to 2-3 `<source>` types (MDN). More types add markup and cache variants without measurable gain.
9. Generate widths from the layout, not from habit: default `[480, 768, 1080, 1440, 1920, 2560]` (default — adjust per layout); never upscale (`withoutEnlargement`), and never emit a width larger than the source.
10. Use art direction (`<source media>`) only when the crop or subject placement must change between breakpoints; use resolution switching (`srcset` + `sizes`) for everything else.
11. Apply EXIF orientation before stripping metadata (`.rotate()` first in sharp). For AI-generated assets, preserve or re-add provenance metadata per [asset-generation](asset-generation.md).
12. Never overwrite originals: keep sources in `_sources/`, write derivatives to new paths, and keep sources at ≥ 2x the largest display size.
13. Keep text, buttons, logos and prices out of raster images; render them as live HTML over the image (accessible, translatable, sharp at every density).
14. Animated images (animated WebP/AVIF/GIF) need a `prefers-reduced-motion: reduce` still and must not autoplay over 5 seconds without a pause control (WCAG 2.2.2); prefer video for anything longer than a short loop ([video-pipelines](video-pipelines.md)).
15. Generation prompts for images are colour-neutral, text-free and specify negative space for live text; grade the set afterwards with one measured treatment.
16. Verify every remote image URL resolves before referencing it, self-host for production, and allow only the specific remote hosts you need (`remotePatterns`).
17. Treat user-uploaded or downloaded images as untrusted input: set a decode timeout and pixel limit, and never inline untrusted SVG ([security-and-privacy](security-and-privacy.md)).

## Specifications

### Formats per role

| Role | Primary | Fallback chain | Notes |
|---|---|---|---|
| Hero / editorial photo | AVIF | WebP → JPEG | AVIF ~50% smaller than JPEG at similar quality, no progressive rendering (MDN) |
| Product photo (e-commerce) | AVIF | WebP → JPEG | Consistent background and aspect across the catalogue |
| Product cutout | AVIF/WebP with alpha | PNG | Trim to alpha bounds; check edge halos on light and dark surfaces |
| UI screenshot, diagram, text-heavy | PNG or lossless WebP | PNG | Lossy blurs text edges; lossless WebP ~26% smaller than PNG (MDN) |
| Icon, logo, simple illustration | SVG | PNG at 2x (email only) | `currentColor` for theme-aware icons |
| Texture / tile | WebP or AVIF | JPEG | Power-of-two sizes only if used as a WebGL texture ([three-dimensional-web](three-dimensional-web.md)) |
| Avatar / thumbnail | WebP | JPEG | Small; AVIF encode cost rarely pays off below ~10 KB (default — adjust per product) |
| Open Graph / social card | PNG or JPEG | — | 1200x630 common; many crawlers ignore AVIF/WebP (verify per platform) |
| Animated loop | MP4/WebM video | animated WebP | See [video-pipelines](video-pipelines.md) |

Browser support (caniuse, retrieved 2026-10): AVIF Chrome 85+, Edge 121+, Firefox 93+ (animated 113+), Safari 16.4+ (16.1-16.3 partial), ~96.4% global. WebP effectively universal. JPEG XL Chrome 155+, Firefox 158+, Safari 17+ partial, Edge not supported, ~60% global.

### Encoder settings (sharp 0.35.5; verify at runtime: `npm view sharp version`)

| Format | sharp default | Recommended start (default — adjust per image) |
|---|---|---|
| AVIF | quality 50, effort 4 (0-9), chroma 4:4:4 | quality 50, effort 4 |
| WebP | quality 80, alphaQuality 100, effort 4 (0-6) | quality 75-80; `lossless: true` for UI/text |
| JPEG | quality 80, progressive false, 4:2:0, mozjpeg false | quality 78, `mozjpeg: true` |
| PNG | compressionLevel 6, palette off | `palette: true` for flat graphics with few colours |

sharp strips all metadata by default (EXIF orientation, ICC → converted to sRGB, XMP, IPTC). `keepMetadata()` keeps EXIF/ICC/XMP/IPTC; `withMetadata()` keeps EXIF/XMP/IPTC and adds an sRGB ICC profile. Timeout defaults to 0 (unbounded). sharp has no CLI of its own; `sharp-cli` is a separate community package.

### Loading hints

| Attribute | Value | Use |
|---|---|---|
| `fetchpriority` | `high` | the single LCP image (support: Chrome/Edge 102, Firefox 132, Safari 17.2; a hint, not a directive) |
| `fetchpriority` | `low` | hidden carousel slides, off-screen tabs |
| `loading` | `lazy` | everything below the fold; never the LCP image |
| `decoding` | `async` | all images (hint; harmless on the hero) |
| `sizes` | layout expression | required with `w` descriptors; e.g. `(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw` |

web.dev reports Google Flights LCP falling from 2.6 s to 1.9 s after raising the hero's priority. LCP target ≤ 2.5 s is owned by [performance](performance.md).

### next/image (Next.js 16.x; latest 16.4.3 on 2026-10-23 — verify at runtime: `npm view next version`)

| Setting | Default | Rule |
|---|---|---|
| `preload` (replaces deprecated `priority` in 16) | off | Prefer `loading="eager"` or `fetchPriority="high"`; never combine `preload` with those, and do not use it when different images are LCP at different viewports |
| `priority` | — | Use only on Next ≤ 15 |
| `quality` | 75 | Must be in `images.qualities` (default `[75]`); other values are coerced to the nearest allowed value |
| `formats` | `['image/webp']` | Add AVIF for photo-heavy sites: `['image/avif','image/webp']` (AVIF ~50% slower to encode, ~20% smaller than WebP, cached separately) |
| `sizes` | none | `fill` without `sizes` assumes 100vw; `width` without `sizes` yields only 1x/2x; with `sizes` yields a full `w` srcset |
| `deviceSizes` | 640, 750, 828, 1080, 1200, 1920, 2048, 3840 | Keep unless the layout proves otherwise |
| `imageSizes` | 32, 48, 64, 96, 128, 256, 384 | Used for images with `sizes` narrower than the viewport |
| `placeholder` | `empty` | `blur` auto-generates `blurDataURL` only for static imports of jpg/png/webp/avif (not animated); keep manual placeholders ~10 px |
| `minimumCacheTTL` | 14400 s (4 h) | Raise for immutable hashed assets |
| `remotePatterns` / `localPatterns` | none | Required for remote hosts; local images with query strings need `localPatterns.search` |
| `dangerouslyAllowLocalIP` | false | Keep false |

Self-hosted Next behind a CDN must forward the `Accept` header, or every browser gets the same format.

### Per-image size targets

Validator ceilings (`scripts/asset-validation.mjs`): image 500 KiB; roles containing hero/background 800 KiB. Aim well below them:

| Image | Target at largest served width (default — adjust per product) |
|---|---|
| Hero photo, AVIF at 1920w | ≤ 200 KB |
| Content image, AVIF/WebP at 1080w | ≤ 100 KB |
| Card / thumbnail | ≤ 30 KB |
| Inline SVG icon | ≤ 2 KB; path data trimmed to ~2 decimals (react-performance, ECC) |
| LQIP / blur placeholder | ≤ 1 KB (~10 px wide) |

For locally viewed HTML deliverables (slides, offline reports) that are not served responsively: downscale any image over 1 MB to a 1200 px max dimension, Lanczos, quality 85, written with a `_processed` suffix (frontend-slides, ECC).

## Implementation

### Vanilla responsive hero (any stack)

```html
<picture>
  <source type="image/avif" sizes="100vw"
    srcset="/img/hero-768.avif 768w, /img/hero-1440.avif 1440w, /img/hero-1920.avif 1920w, /img/hero-2560.avif 2560w">
  <source type="image/webp" sizes="100vw"
    srcset="/img/hero-768.webp 768w, /img/hero-1440.webp 1440w, /img/hero-1920.webp 1920w, /img/hero-2560.webp 2560w">
  <img src="/img/hero-1440.jpg" sizes="100vw"
    srcset="/img/hero-768.jpg 768w, /img/hero-1440.jpg 1440w, /img/hero-1920.jpg 1920w, /img/hero-2560.jpg 2560w"
    width="2560" height="1440" alt="Ceramic desk lamp glowing on a linen table"
    fetchpriority="high" decoding="async">
</picture>
```

Below the fold: same structure, real `sizes`, plus `loading="lazy"`, no `fetchpriority`.

### Art-directed crop

```html
<picture>
  <source media="(max-width: 767px)" type="image/avif" width="1080" height="1440"
    srcset="/img/hero-tall-540.avif 540w, /img/hero-tall-1080.avif 1080w" sizes="100vw">
  <source media="(max-width: 767px)" width="1080" height="1440"
    srcset="/img/hero-tall-540.jpg 540w, /img/hero-tall-1080.jpg 1080w" sizes="100vw">
  <source type="image/avif" srcset="/img/hero-1440.avif 1440w, /img/hero-2560.avif 2560w" sizes="100vw">
  <img src="/img/hero-1440.jpg" srcset="/img/hero-1440.jpg 1440w, /img/hero-2560.jpg 2560w" sizes="100vw"
    width="2560" height="1440" alt="…" fetchpriority="high" decoding="async">
</picture>
```

`width`/`height` on `<source>` reserve the right box per breakpoint. Produce crops from the source with the focal point kept inside the crop; record each crop as its own manifest entry or as a derivative in `validation.notes`.

### Next.js App Router

```tsx
// app/components/Hero.tsx — static import gives width, height and blurDataURL
import Image from 'next/image';
import hero from './hero.jpg';

export function Hero() {
  return (
    <Image src={hero} alt="Ceramic desk lamp glowing on a linen table"
      sizes="100vw" fetchPriority="high" loading="eager" placeholder="blur"
      className="h-auto w-full" />
  );
}
```

```tsx
// Art direction with next/image: getImageProps + <picture>
import { getImageProps } from 'next/image';

export function ArtDirectedHero() {
  const common = { alt: 'Ceramic desk lamp glowing on a linen table', sizes: '100vw', fetchPriority: 'high' as const };
  const { props: { srcSet: wide } } = getImageProps({ ...common, src: '/img/hero-wide.jpg', width: 2560, height: 1440 });
  const { props: { srcSet: tall, ...rest } } = getImageProps({ ...common, src: '/img/hero-tall.jpg', width: 1080, height: 1440 });
  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={wide} />
      <source media="(max-width: 767px)" srcSet={tall} />
      <img {...rest} style={{ width: '100%', height: 'auto' }} />
    </picture>
  );
}
```

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [60, 75],
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.example.com', pathname: '/images/**' }],
  },
};
export default nextConfig;
```

### CSS background LCP (when an `<img>` is not possible)

```html
<link rel="preload" as="image" type="image/avif" fetchpriority="high"
  imagesrcset="/img/bg-960.avif 960w, /img/bg-1920.avif 1920w" imagesizes="100vw">
<style>
  .hero { background-color: var(--color-surface);
    background-image: image-set(url(/img/bg-1920.avif) type("image/avif"), url(/img/bg-1920.jpg) type("image/jpeg"));
    background-size: cover; }
</style>
```

### Reduced-motion still for an animated image

```html
<picture>
  <source media="(prefers-reduced-motion: reduce)" srcset="/img/loop-still.webp">
  <img src="/img/loop.webp" width="800" height="450" alt="…" loading="lazy" decoding="async">
</picture>
```

### sharp build script (ordinary dev dependency; Node ≥ 20.9.0)

Check first: `library:sharp` is `available-with-prerequisites` in [capability-registry](capability-registry.md); installing it in the project (`npm i -D sharp`) is autonomous; the native binary download needs network.

```js
// scripts/build-images.mjs — node scripts/build-images.mjs <srcDir> <outDir>
import sharp from 'sharp';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const [src = 'assets/_sources', out = 'public/img'] = process.argv.slice(2);
const WIDTHS = [480, 768, 1080, 1440, 1920, 2560]; // default — adjust per layout
const INPUT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff']);
sharp.cache(false);
await mkdir(out, { recursive: true });

const manifest = [];
for (const file of await readdir(src)) {
  if (!INPUT.has(path.extname(file).toLowerCase())) continue;
  const name = path.parse(file).name;
  try {
    // Default limitInputPixels stays on (decompression-bomb guard); rotate() applies EXIF orientation.
    const base = sharp(path.join(src, file)).rotate();
    const meta = await sharp(path.join(src, file)).metadata();
    const srcWidth = (meta.orientation ?? 1) >= 5 ? meta.height : meta.width;
    const widths = WIDTHS.filter((w) => w <= srcWidth);
    if (widths.length === 0) widths.push(srcWidth);
    for (const w of widths) {
      const step = () => base.clone().resize({ width: w, withoutEnlargement: true }).timeout({ seconds: 30 });
      const fallback = meta.hasAlpha
        ? step().png({ palette: false }).toFile(path.join(out, `${name}-${w}.png`))
        : step().jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(out, `${name}-${w}.jpg`));
      const [avif, webp, legacy] = await Promise.all([
        step().avif({ quality: 50, effort: 4 }).toFile(path.join(out, `${name}-${w}.avif`)),
        step().webp({ quality: 78 }).toFile(path.join(out, `${name}-${w}.webp`)),
        fallback,
      ]);
      manifest.push({ name, width: w, height: avif.height, bytes: { avif: avif.size, webp: webp.size, fallback: legacy.size } });
    }
  } catch (err) {
    console.error(`${file}: ${err.message}`);
    process.exitCode = 1;
  }
}
console.log(JSON.stringify(manifest, null, 2));
```

For AI-generated sources whose provenance must survive, add `.keepMetadata()` to the chain (it keeps EXIF/ICC/XMP/IPTC; C2PA re-signing is in [asset-generation](asset-generation.md)). If sharp cannot be installed, ship source images pre-sized by hand or rely on the framework optimiser, and record the limitation. ImageMagick and Pillow are recorded as unavailable; do not plan around them without re-checking.

### Transparent assets

- Prefer native alpha from the source or generator. If unavailable, generate on an impossible flat colour (a saturated green or magenta absent from the subject), key it out, then convert to alpha (impeccable, paraphrased); check for colour spill on edges.
- Trim to the alpha bounding box (`sharp(...).trim()`), then pad uniformly so a series aligns on a shared baseline.
- Test every cutout on the lightest and darkest surface tokens; halos mean un-premultiplied edges or spill.
- Overlay plates (glow, grain, light leaks): reject any covering more than 22% of the frame; if tightened coverage is below 10%, use it as a full-frame low-opacity wash, otherwise scale to 35-70% of frame width; vary position and scale with a seeded random so it never reads as a watermark; blend glow with `screen`/`plus-lighter`, grain with `overlay` (taste-distillation, ECC).

### Image prompt patterns

Use the template in [asset-generation](asset-generation.md); add these image-specific rules.

| Pattern | Subject + composition | Direction rules |
|---|---|---|
| Hero with live headline | One subject in the right or left third; empty opposite 40-50% | No text, logos, UI or frames; background plain and low-detail where the text sits |
| Product on seamless | Product centred, ≥ 60% of frame (default — adjust), seamless backdrop | Even soft light, consistent camera height across the catalogue |
| Lifestyle / editorial | Real setting, human scale, one clear action | No identifiable real people unless licensed; AI people never as testimonials |
| Texture / tile | Flat, front-on, uniform light | "seamless tileable", no vignette, no focal object |
| Clean plate for 3D | One object, plain background, > 50% of frame | Even light, no cast shadow, neutral colour (taste-application, ECC) |
| Spot illustration | Single concept, limited shapes | Fixed style block shared by the series; prefer SVG if simple enough to draw |

Colour: write "Colour: none. Render neutral. Grading is applied afterwards." In one measured project, colour words moved the target hue shift only from +1.9 to +0.3 against a +24.9 target, while a measured grade reached it in one pass (taste-distillation, ECC; medium-high confidence). Measure references per luminance zone (L* edges 0, 15, 35, 55, 75, 100) with median and MAD rather than mean, and mask UI chrome before measuring.

Text inside images: never request it. Headline, CTA, price and logo stay live HTML over a text-free background (banner-design, MIT).

### Deterministic HTML-to-PNG capture (banners, OG cards)

Serve from a loopback-only static server (127.0.0.1, path-traversal guard), load with `networkidle`, await `document.fonts.ready`, wait ~1500 ms to settle, force reveal elements visible, then screenshot at the exact target viewport (frontend-slides, ECC). Use Playwright only if [capability-registry](capability-registry.md) or `node ../scripts/visual-check.mjs` resolves it; otherwise mark the export BLOCKED.

## Failure modes & fallbacks

| Failure | Symptom | Fix |
|---|---|---|
| Missing `sizes` | Mobile downloads the 2560w file | Add `sizes` matching the layout; verify chosen `currentSrc` in DevTools |
| Lazy LCP image | LCP late, "lazy-loaded LCP" audit | Remove `loading="lazy"`, add `fetchpriority="high"` |
| Several `fetchpriority="high"` | Priority hint diluted | Keep one per view |
| CLS from images | Layout jumps on load | Add `width`/`height` or `aspect-ratio` |
| Rotated photos | Portrait shows sideways | `.rotate()` before resize |
| Washed-out colours | Wide-gamut source converted badly | Keep ICC (`keepMetadata`/`withMetadata`) or convert to sRGB deliberately |
| AVIF slow to build | Long CI times | Lower effort, restrict AVIF to photos, cache outputs |
| Blurry UI screenshot | Lossy encode of text | Lossless WebP or PNG |
| next/image quality ignored | Output looks like q75 | Add the value to `images.qualities` |
| CDN serves one format | No AVIF despite config | Forward `Accept`, vary cache on it |
| Remote image 400 in next/image | Host not allowed | Add the exact host to `remotePatterns` |
| Remote image breaks later | Hotlinked or expired URL | Self-host; manifest `path` not `uri` |
| Decompression bomb / hang | Huge or malformed upload | Keep `limitInputPixels`, set `.timeout()`, reject on error |
| sharp install fails offline | Native binary download blocked | Pre-sized sources or framework optimiser; record limitation |

## Verification

- Gate G: `node ../scripts/asset-validation.mjs --manifest asset-manifest.json --root . --summary` checks format (magic bytes), dimensions, aspect (1%), byte budgets and licences.
- Gate E: lab LCP and image weight via Lighthouse or performance traces if a browser tool is `available-verified` ([performance](performance.md)); label lab results as lab. Confirm exactly one high-priority image and no lazy LCP.
- Gate F: `node ../scripts/visual-check.mjs --url <url> --viewports 375x812,768x1024,1280x800,1920x1080 --out <dir>` reports broken images and overflow per viewport; check art-directed crops keep the focal point at each width.
- Gate D: informative images have meaningful alt; decorative images have `alt=""`; no text baked into images ([accessibility](accessibility.md)).
- Spot-check in DevTools: `img.currentSrc` at 375 px and 1920 px, response `content-type` (avif/webp), and transfer size against the targets above.
- No browser available: mark rendering checks NOT_TESTED with the reason; the validator still covers file integrity.

## Sources

- impeccable (installed skill; licence: none found locally) — imagery-mandatory rule for image-led briefs, verify-URL rule, chroma-key transparency method. Paraphrased only.
- taste-distillation and taste-application (ECC plugin 2.2.3, MIT) — neutral generation then measured grade, luminance-zone colour measurement, overlay compositing numbers, clean plate.
- frontend-slides (ECC, MIT) — deterministic HTML capture and non-destructive local image prep.
- react-performance (ECC, MIT) — SVG wrapper animation and path precision.
- banner-design (claudekit, MIT) — text-free generated backgrounds with live text.
- remotion-video-creation (ECC, MIT) — frame-rendered image loading is covered in [video-pipelines](video-pipelines.md).
- MDN image types — https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types (retrieved 2026-10).
- caniuse AVIF / JPEG XL — https://caniuse.com/avif, https://caniuse.com/jpegxl (retrieved 2026-10).
- web.dev Fetch Priority — https://web.dev/articles/fetch-priority (retrieved 2026-10).
- Next.js Image API — https://nextjs.org/docs/app/api-reference/components/image (docs updated 2026-09-28, retrieved 2026-10); https://registry.npmjs.org/next (16.4.3, 2026-10-23).
- sharp — https://sharp.pixelplumbing.com/, https://sharp.pixelplumbing.com/api-output, https://registry.npmjs.org/sharp (0.35.5, 2026-09-27; retrieved 2026-10).
- WCAG 2.2 SC 2.2.2 Pause, Stop, Hide — https://www.w3.org/TR/WCAG22/ (standard).
