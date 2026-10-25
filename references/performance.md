# Performance (Core Web Vitals, budgets, cost)

Single source of truth for performance targets, per-page-type budgets, the causes and fixes of slow LCP/INP/CLS, JavaScript/media/font/3D cost, and the Gate E measurement procedure. Use it to keep pages fast by construction and to report lab and field results honestly.

**Load when:** any page build or redesign; heavy media, animation, 3D or third-party scripts; requests mentioning performance, speed, Lighthouse, Core Web Vitals, bundle size or "it feels slow". **Owns:** Core Web Vitals thresholds and the p75 rule, lab vs field labelling, page-type and device-tier budgets, JS/bundle budgets and splitting, image/video/font loading priorities, 3D and animation cost budgets, long tasks and main-thread work, the Gate E procedure.
**Related:** [image-pipelines](image-pipelines.md), [video-pipelines](video-pipelines.md), [typography-and-layout](typography-and-layout.md), [motion-engineering](motion-engineering.md), [three-dimensional-web](three-dimensional-web.md), [shader-and-creative-coding](shader-and-creative-coding.md), [frontend-architecture](frontend-architecture.md), [landing-page-engineering](landing-page-engineering.md), [dashboard-engineering](dashboard-engineering.md), [visual-testing](visual-testing.md), [quality-gates](quality-gates.md), [capability-registry](capability-registry.md), [accessibility](accessibility.md)

## Decision rules

1. Hold every page to the Core Web Vitals "good" lines at the 75th percentile of field page loads, mobile and desktop separately: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (web.dev). A page passes only when all three pass.
2. Label every number as **lab** or **field**. Never state that a site "passes Core Web Vitals" from a Lighthouse or DevTools trace; say "lab metrics within budget; field verification pending (CrUX or web-vitals RUM)".
3. In the lab, use the headroom budgets: LCP ≤ 2.0 s, TBT ≤ 200 ms, CLS ≤ 0.05 on a mobile-throttled run (r01 implementation note — default, adjust per product). If no interactions were scripted, report INP as NOT_TESTED and TBT as the proxy.
4. Pick the page-type budget (marketing, dashboard, immersive) before building and record it in the plan; immersive pages must also define device tiers and a cheaper fallback.
5. Never lazy-load the LCP element. Give the hero image `fetchpriority="high"` (or the framework's preload API) and render it in server HTML, not client-only.
6. Lazy-load everything below the fold: images (`loading="lazy"`), iframes, video, heavy components, Three.js/R3F, large motion libraries.
7. Reserve space for every image, video, embed, ad slot, font swap and Suspense fallback (`width`/`height` or `aspect-ratio`, fixed skeleton sizes). Never inject content above existing content after load.
8. Animate only `transform` and `opacity` (with care `filter`, `clip-path`). Never animate `top`, `left`, `width`, `height`, `margin` or `padding` for routine UI; never `transition: all`; use `will-change` only on elements about to animate.
9. Keep event handlers under 50 ms; split work longer than 50 ms (a long task) with `scheduler.yield()` or `setTimeout` chunks; avoid layout reads after writes in input handlers.
10. Load analytics, chat and tag managers after hydration (`next/script` `afterInteractive` or `lazyOnload`; `defer`/`async` for raw tags). Any new third-party script is a data transfer: check [security-and-privacy](security-and-privacy.md) and ask the user first.
11. Import from source files, not barrel `index.ts` re-exports; never build dynamic import paths with template literals.
12. Default to no manual memoisation; add `useMemo`/`useCallback`/`React.memo` only for a measured problem, an identity-sensitive memo child or a hook dependency. If React Compiler is enabled, do not add them at all.
13. Self-host fonts (`next/font` or `@font-face`), load only used weights, preload only the above-the-fold body face, and use a metric-matched fallback so the swap does not shift layout.
14. Pause infinite loops and render loops when `document.visibilityState` is `hidden` or the element is off-screen; stop them on unmount.
15. Measure before and after every optimisation on the same profile; never claim an improvement without both numbers.
16. Never lower a budget to make a gate pass. If a budget is exceeded for a justified reason, record the exception and its owner in the quality report.

## Specifications

### Core Web Vitals bands (field, p75; web.dev)

| Metric | Good | Needs improvement | Poor | Notes |
|---|---|---|---|---|
| LCP | ≤ 2.5 s | 2.5–4.0 s | > 4.0 s | Candidates: `img`, `image` in SVG, video poster/first frame, `url()` backgrounds (not gradients), text blocks |
| INP | ≤ 200 ms | 200–500 ms | > 500 ms | Clicks, taps, keys only; input delay + processing + presentation; worst interaction ignoring one per 50 |
| CLS | ≤ 0.1 | 0.1–0.25 | > 0.25 | Session windows (gaps < 1 s, cap 5 s, largest counts); shifts within 500 ms of discrete input excluded; scroll/drag do not exclude |

INP replaced FID in March 2024. LCP and INP became Baseline Newly available on 2025-12-12 (Safari 26.2); CLS is still Chromium-only. CrUX counts eligible Chrome users only. Experimental soft-navigation CrUX metrics (announced 2026-10-13, Chrome 151 Soft Navigations API) target graduation in May 2027; thresholds are unchanged. Lighthouse score weights (v10+, unchanged in v13): TBT 30%, LCP 25%, CLS 25%, FCP 10%, Speed Index 10%.

### Budgets by page type (lab, mobile-throttled; defaults — adjust per product)

| Budget | Marketing / landing / editorial | Dashboard / SaaS app | Immersive / 3D story |
|---|---|---|---|
| LCP (lab) | ≤ 2.0 s | ≤ 2.0 s for shell; data skeleton visible ≤ 2.0 s | ≤ 2.0 s for HTML hero/poster; 3D may arrive later |
| TBT (lab) | ≤ 200 ms | ≤ 200 ms | ≤ 300 ms on tier-high, ≤ 200 ms on fallback |
| CLS (lab) | ≤ 0.05 | ≤ 0.05 (incl. route changes) | ≤ 0.05 |
| Initial JS (compressed) | ≤ 170 KB | ≤ 300 KB per route | ≤ 170 KB before 3D; 3D chunk lazy |
| Initial CSS (compressed) | ≤ 50 KB | ≤ 80 KB | ≤ 50 KB |
| Fonts | ≤ 2 families, ≤ 4 files, ≤ 150 KB total | ≤ 2 families, ≤ 100 KB | ≤ 3 files before first scene |
| LCP image | ≤ 200 KB at mobile width | none ideally (text LCP) | poster ≤ 200 KB |
| Per-image cap | ≤ 500 KB (hero/background ≤ 800 KB) | ≤ 200 KB | ≤ 500 KB |
| Background/hero video | ≤ 6 MB, muted, poster | avoid | ≤ 6 MB |
| 3D model (GLB) | avoid | avoid | ≤ 5 MB compressed per scene |
| Third-party scripts | ≤ 2 before interaction | ≤ 2 | ≤ 1 |
| Interaction latency target | INP ≤ 200 ms | INP ≤ 200 ms; table filter/sort ≤ 100 ms processing | INP ≤ 200 ms; scroll scrub at display rate |

Per-asset caps for image, video and GLB mirror the defaults in `../scripts/asset-validation.mjs` (Gate G). JS/CSS/font numbers are working defaults, not standards.

### Immersive device tiers (defaults — adjust per scene)

| Tier | Detect | Render budget | Behaviour |
|---|---|---|---|
| High | Desktop GPU, `navigator.hardwareConcurrency ≥ 8`, `deviceMemory ≥ 8` (Chromium only), WebGL2 | ≤ 150 draw calls, ≤ 1 M triangles, DPR clamp 2, post-processing allowed | Full scene |
| Mid | Recent phones/laptops | ≤ 80 draw calls, ≤ 300 k triangles, DPR clamp 1.5, ≤ 1 post pass | Reduced effects |
| Low / fallback | No WebGL2, `saveData`, reduced motion, `deviceMemory ≤ 4`, sustained FPS < 30 | No WebGL | Static poster or video + HTML content |

Target frame time 16.7 ms at 60 Hz; downgrade one tier when the moving average stays above 33 ms for ~2 s (default). Use runtime FPS monitoring (drei `PerformanceMonitor` or a rAF timer) rather than user-agent sniffing alone. Scene techniques (instancing, LOD, KTX2/Draco/Meshopt, disposal) are owned by [three-dimensional-web](three-dimensional-web.md); shader cost by [shader-and-creative-coding](shader-and-creative-coding.md).

### Metric → cause → fix

| Metric | Common causes | Fixes |
|---|---|---|
| LCP | Hero lazy-loaded or client-rendered; server waterfalls; render-blocking CSS/fonts; oversized image; slow TTFB; hero waits for JS animation | `fetchpriority="high"`/preload, SSR/SSG hero, parallel data fetching, responsive `srcset` + AVIF/WebP, preconnect to the image CDN, never start the hero at `opacity: 0` waiting for JS |
| INP | Long tasks in handlers; large re-renders; hydration of huge trees; layout thrash; third-party scripts; heavy synchronous JSON parsing | Yield, `startTransition`/`useDeferredValue`, virtualise long lists, split contexts, derived store selectors, defer third parties, move work to a Web Worker |
| CLS | Media without dimensions; font swap; late banners/ads; Suspense fallbacks of different height; animations of layout properties; client route changes inserting content | Dimensions or `aspect-ratio`, metric-matched fallback fonts, reserved slots, fixed skeleton heights, transform-only motion |
| TBT (lab) | Bundle size, unsplit vendors, legacy polyfills | Code-split by route and interaction, `optimizePackageImports`, drop `@vitejs/plugin-legacy` unless analytics require it |

### Server and data waterfalls (React/Next; react-performance, priority 1 of 8)

Each sequential `await` adds one full round trip. Order of fixes: test cheap synchronous conditions before any `await`; move each `await` into the branch that uses it; `Promise.all` independent work; start promises early and await late; split sibling awaits into separate async Server Components so they stream in parallel.

### Font loading

`font-display: swap`, or `optional` when zero shift matters (fallback kept if the font misses about 100 ms). Fallback `@font-face` with `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` computed by a tool (Fontaine, Capsize), not guessed. Variable font when ≥ 3 weights/styles; subset with `unicode-range`. Type choices are owned by [typography-and-layout](typography-and-layout.md). Exception: a claude.ai Artifact can only load Google Fonts stylesheets.

### Images and video

Image quality around 80–85 is usually visually lossless (impeccable optimize guidance). Formats, `srcset`/`sizes`, art direction: [image-pipelines](image-pipelines.md). Encoding, poster frames, `preload="none"` or `metadata` for below-fold video: [video-pipelines](video-pipelines.md). Grain/noise overlays live on one fixed, full-viewport, `pointer-events: none` layer, never on scrolling containers.

## Implementation

Detect the project's stack and versions first ([frontend-architecture](frontend-architecture.md)); read `package.json`, the bundler config and the framework's image/font/script APIs before choosing an approach.

### LCP hero (Next.js App Router)

```tsx
import Image from "next/image";
// Next 16: `priority` is deprecated; use `preload` or `fetchPriority` (verify against the installed version: npm view next version)
export function Hero() {
  return (
    <Image src="/hero.avif" alt="Team reviewing a dashboard" width={1600} height={900}
      sizes="(max-width: 768px) 100vw, 1200px" fetchPriority="high" loading="eager" />
  );
}
```

Vanilla equivalent: `<img src="hero.avif" width="1600" height="900" fetchpriority="high" decoding="async" alt="…">` plus `<link rel="preload" as="image" href="hero.avif" imagesrcset="…" imagesizes="…">` when the image is discovered late (CSS background or JS).

### Yielding long tasks (framework-agnostic)

```ts
const yieldToMain = () =>
  "scheduler" in globalThis && "yield" in (globalThis as any).scheduler
    ? (globalThis as any).scheduler.yield()
    : new Promise<void>((r) => setTimeout(r, 0));

export async function processInChunks<T>(items: T[], work: (item: T) => void, budgetMs = 40) {
  let start = performance.now();
  for (const item of items) {
    work(item);
    if (performance.now() - start > budgetMs) { await yieldToMain(); start = performance.now(); }
  }
}
```

In React, wrap non-urgent state updates in `startTransition` so input stays responsive; move CPU-heavy parsing to a Web Worker.

### Lazy 3D with poster and tier gate (React 19 + R3F 9)

```tsx
"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const Scene = dynamic(() => import("./Scene"), { ssr: false, loading: () => null });

function canRun3D() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if ((navigator as any).connection?.saveData) return false;
  const gl = document.createElement("canvas").getContext("webgl2");
  return !!gl;
}

export function HeroScene() {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!ref.current || !canRun3D()) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShow(true); io.disconnect(); } },
      { rootMargin: "200px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ aspectRatio: "16 / 9", position: "relative" }}>
      <img src="/scene-poster.avif" alt="" width={1600} height={900} style={{ position: "absolute", inset: 0 }} />
      {show && <Scene />}
    </div>
  );
}
```

Inside `Scene`, set `<Canvas dpr={[1, 1.5]} frameloop="demand">` when the scene is mostly static, use drei `PerformanceMonitor` to step down tiers, and dispose geometries/textures on unmount (details in [three-dimensional-web](three-dimensional-web.md)). The poster is the LCP candidate and the low-tier fallback; it also reserves space so the canvas causes no shift.

### Pause off-screen and hidden loops

```ts
export function runLoop(el: Element, frame: (t: number) => void) {
  let id = 0, visible = true, onScreen = true;
  const tick = (t: number) => { frame(t); id = requestAnimationFrame(tick); };
  const sync = () => { cancelAnimationFrame(id); if (visible && onScreen) id = requestAnimationFrame(tick); };
  const onVis = () => { visible = document.visibilityState === "visible"; sync(); };
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); });
  document.addEventListener("visibilitychange", onVis); io.observe(el); sync();
  return () => { cancelAnimationFrame(id); io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
}
```

GSAP: create tweens inside `useGSAP` (`@gsap/react`) so they revert on unmount; Lenis: call `lenis.destroy()` in cleanup. Motion budgets and reduced-motion paths: [motion-engineering](motion-engineering.md).

### Field measurement (RUM)

```ts
// web-vitals 6.2.3 per r01 research — verify at runtime: npm view web-vitals version
import { onCLS, onINP, onLCP } from "web-vitals/attribution";
const send = (m: { name: string; value: number; id: string; rating: string }) =>
  navigator.sendBeacon?.("/api/vitals", JSON.stringify({ name: m.name, value: m.value, id: m.id, rating: m.rating }));
onLCP(send); onINP(send); onCLS(send);
```

Adding a RUM endpoint or vendor is a new data flow: it needs the user's approval and a privacy check ([security-and-privacy](security-and-privacy.md)). Next.js alternative: `useReportWebVitals` from `next/web-vitals`. Treat Safari/Firefox RUM as LCP and INP only.

### Bundle inspection

Run the project's own analyser if present (`@next/bundle-analyzer`, `vite-bundle-visualizer`, `source-map-explorer`); otherwise read the build output sizes. Group vendors deliberately (`manualChunks`; `rolldownOptions` in Vite 8, `rollupOptions` before — verify the installed version), never one chunk per package.

## Failure modes & fallbacks

| Failure | Fix |
|---|---|
| Hero fades in from `opacity: 0` via JS, LCP waits for hydration | Render visible in HTML; animate with CSS from a visible state or after LCP |
| Next `<Image priority>` warnings on Next 16 | Use `preload`/`fetchPriority` per installed version |
| CLS from web font swap | Metric-matched fallback with overrides, or `font-display: optional` |
| CLS from cookie banner | Overlay at the bottom with fixed position; do not push content |
| INP spikes on filter/search | Debounce input, `startTransition`, virtualise lists, memoise only the measured hotspot |
| Lighthouse score high but users report jank | Lab is one device and cold cache; collect field INP; script interactions in a trace |
| 3D drops below 30 FPS on phones | Step down tier, clamp DPR, demand frameloop, or show poster |
| Bundle grows after adding an icon/UI library | Per-icon imports, `optimizePackageImports`, remove barrels |
| Throttled run impossible (no tool) | Report lab numbers as unthrottled and flag the gap; never extrapolate field results |
| Animated grain on scroll container | Move to fixed pseudo-element layer |

## Verification

Feeds **Gate E** (also supports C, F and H). Status rules and report format: [quality-gates](quality-gates.md).

### Tools (check before use)

Read [capability-registry](capability-registry.md) and run `../scripts/environment-audit.mjs`; MCP tools are invisible to the script, so check them with the current host's tool-discovery interface. Use a tool only when its status is `available-verified`.

| Tool | Gives | Known limits (r01, verify in-session) |
|---|---|---|
| Chrome DevTools MCP `performance_start_trace` / `performance_stop_trace` / `performance_analyze_insight` | Lab LCP, CLS, long tasks, insights such as `LCPBreakdown`, `DocumentLatency`; INP only for interactions performed during the trace | Upstream can query CrUX for the URL (sends the URL to Google; disable with `--no-performance-crux` or get approval) |
| Chrome DevTools MCP `emulate` | `cpuThrottlingRate` 1–20, `networkConditions` (Slow/Fast 3G/4G, Offline), `viewport` `"WxHxDPR,mobile,touch"` | Installed plugin lacks reduced-motion/forced-colors emulation; each call replaces previous emulation |
| Chrome DevTools MCP `lighthouse_audit` | Accessibility, SEO, Best Practices only | No performance category; use traces for Gate E |
| Lighthouse CLI | Full lab report incl. performance | Recorded as missing on this machine in the audit; re-check with environment-audit |
| Playwright (`../scripts/visual-check.mjs`) | Console errors, failed requests, broken images; scripted interactions; `PerformanceObserver` reads | Exit 4 = BLOCKED, Playwright not resolvable |
| CrUX API / PageSpeed Insights / RUM | Field p75 | External service: needs approval; low-traffic or unreleased sites have no CrUX data |

### Gate E procedure

1. **Budget.** Write the page type, device tiers (immersive) and budgets from the tables above into the quality report before measuring.
2. **Build for production.** Measure the production build served locally (`next build && next start`, `vite build && vite preview`, or the project's scripts). Never measure the dev server.
3. **Mobile lab profile.** With DevTools MCP: `emulate` viewport `412x915x2.625,mobile,touch`, `cpuThrottlingRate` 4, `networkConditions` "Slow 4G" in one call, then `performance_start_trace` with reload true; repeat 3 runs and take the median (default). Also run a desktop profile with no throttling.
4. **Read insights.** LCP element and its breakdown (TTFB, load delay, load time, render delay), CLS sources, long tasks > 50 ms, render-blocking requests, third-party cost.
5. **Interactions.** Script the critical journey's main interactions (open menu, filter table, submit form, scrub scroll story) during a trace; record interaction latency as lab INP. If not scripted, INP is NOT_TESTED and TBT is reported as proxy.
6. **Bundle and assets.** Record initial JS/CSS per route and run `../scripts/asset-validation.mjs` for media/GLB budgets.
7. **Immersive.** On each tier (or emulated equivalent) record FPS/frame time over 10 s of interaction, confirm the tier downgrade and the poster fallback under reduced motion, no WebGL and `saveData`.
8. **Field.** If field data exists and the user approved access (CrUX, RUM dashboard), record p75 LCP/INP/CLS per device class. Otherwise state "field: NOT_TESTED — no field data".
9. **Decide.** PASS only when lab results meet the budgets with evidence and no critical finding is open; label the PASS "lab". The Core Web Vitals verdict itself stays pending until field p75 exists. FAIL when any budget is exceeded without a recorded exception. BLOCKED when no measurement tool is available-verified.
10. **Repair loop.** Fix the root cause from the cause → fix table, re-measure on the same profile, record before/after.

Report lines use the form: `LCP 1.8 s (lab, mobile Slow 4G, CPU ×4, median of 3)`; `INP NOT_TESTED (no scripted interactions); TBT 140 ms (lab proxy)`; `CLS 0.02 (lab, load only)`.

## Sources

Installed skills (paraphrased; licence "none found" unless noted): design-taste-frontend (compositor-only animation, grain layer, font policy, CWV targets); impeccable (font fallback metrics, lazy-load rule, image quality; detector Apache-2.0, guidance text none found); make-interfaces-feel-better (transition scope); emil-design-eng and ecc:motion-foundations (compositor-first policy, CSS variable cost); ecc:motion-advanced and transitions-dev (loop hygiene); ecc:react-performance, ecc:react-patterns, ecc:vite-patterns, ecc:seo (waterfalls, barrels, third parties, memo policy, chunking, metric-to-fix map); ecc:browser-qa (lab caveat).

External (retrieved 2026-10, dated research r01):
- https://web.dev/articles/vitals
- https://web.dev/articles/inp
- https://web.dev/articles/lcp
- https://web.dev/articles/cls
- https://web.dev/articles/lab-and-field-data-differences
- https://developer.chrome.com/docs/lighthouse/performance/performance-scoring
- https://web.dev/blog/lcp-and-inp-are-now-baseline-newly-available
- https://web.dev/blog/crux-experimental-soft-navs/
- https://github.com/ChromeDevTools/chrome-devtools-mcp (Apache-2.0; tool reference, upstream 1.12.0 — verify at runtime: npm view chrome-devtools-mcp version)
