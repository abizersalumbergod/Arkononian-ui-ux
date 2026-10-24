# Motion engineering

Rules, tokens and code for interface motion: when to animate, how long, which curve, which library, how to choreograph scroll without hijacking it, and how reduced motion, performance and testing are handled. Motion is added in stage 7 of [SKILL.md](../SKILL.md), only after content and function work.

**Load when:** a task mentions animation, motion, transitions, micro-interactions, scroll effects, parallax, pinned or scroll-story sections, page transitions, smooth scrolling, Motion/Framer Motion, GSAP, Lenis or View Transitions. **Owns:** motion purpose and budget, duration/easing/spring tokens, library selection, scroll choreography, the reduced-motion contract, motion performance hygiene, motion testing.
**Related:** [interaction-design](interaction-design.md), [accessibility](accessibility.md), [performance](performance.md), [design-tokens](design-tokens.md), [three-dimensional-web](three-dimensional-web.md), [responsive-design](responsive-design.md), [visual-testing](visual-testing.md), [frontend-architecture](frontend-architecture.md), [skill-delegation](skill-delegation.md), [quality-gates](quality-gates.md), [cinematic-3d workflow](../workflows/cinematic-3d.md)

## Decision rules

1. Justify every animation in one sentence as hierarchy, storytelling, feedback or state transition. If the only reason is "looks good", delete it.
2. Gate by frequency of use: actions triggered 100+ times a day (command palette, keyboard shortcuts) get no animation; tens of times a day get none or a minimal one; occasional surfaces (modal, drawer, toast) get standard motion; rare moments (onboarding, success) may carry delight.
3. Pick a motion intensity band (1-3 static, 4-7 transitions, 8-10 choreography) from the design direction before writing code. If working, cleaned-up motion cannot be shipped at the chosen band, drop to band 3 and ship a clean static page.
4. Climb the library ladder and stop at the first rung that does the job: CSS transitions/keyframes/`@starting-style` and View Transitions → `motion/react` → GSAP + ScrollTrigger → Lenis (scroll-story sites only). Detect the project's stack first ([frontend-architecture](frontend-architecture.md)) and reuse an already-installed library.
5. Use one JS animation library per page. Never mix Motion and GSAP on the same element, and never add a second library for one effect the first can do.
6. Animate `transform` and `opacity` by default. Animate `filter`, `clip-path`, `mask` or `box-shadow` only on small bounded areas after checking smoothness. Never animate `width`, `height`, `top`, `left` or `margin`; use FLIP, Motion `layout`, or `grid-template-rows: 0fr → 1fr`.
7. Name transitioned properties explicitly. Never write `transition: all`.
8. Make content visible by default. A reveal only enhances it: hide pre-reveal state only behind a JS-ready class or an `@supports` block, so a JS failure, a hidden tab or a headless renderer never ships a blank section.
9. Never put the LCP element (hero heading, hero image) behind an opacity-0 entrance. Animate secondary elements around it instead.
10. Use ease-out for entering/exiting, ease-in-out for on-screen moves, plain `ease` for colour/hover, linear only for constant motion (marquee, progress, spinner). Never use ease-in for UI.
11. Close faster than open (exit ≈ 75% of enter, or the asymmetric pairs in Specifications). Exit lists with one quick fade, never a reversed stagger.
12. Never enter surfaces from `scale(0)`. Floor 0.9; use the scale tokens below.
13. Implement the reduced-motion contract for every animation: under `prefers-reduced-motion: reduce`, substitute (opacity fade ≤ 200 ms or instant change) instead of deleting feedback; do not start Lenis, parallax, pins, auto-playing carousels or background video.
14. Give any auto-starting motion that lasts more than 5 s and runs alongside other content a visible pause/stop control (WCAG 2.2.2, Level A), regardless of the media query.
15. Never hijack scroll: no wheel `preventDefault` outside a bounded, keyboard-operable widget, no scroll snapping of the whole document, no pins that trap the user, and every pinned or horizontal sequence must have a plain vertical layout under reduced motion and on narrow or touch screens when it does not work there.
16. Keep continuous values (scroll progress, pointer position) out of React state: use motion values, ScrollTrigger callbacks writing styles or CSS custom properties, or a passive listener batched with `requestAnimationFrame`.
17. Clean up everything you start: tweens, ScrollTriggers, Lenis instances, rAF loops, observers and listeners, on unmount and on route change. Pause off-screen loops with IntersectionObserver and `visibilitychange`.
18. Treat installed motion skills (emil-design-eng, transitions-dev, ecc:motion-*) as level-7 heuristics per [skill-delegation](skill-delegation.md); they never override rules 8, 13, 14 or 15.

## Specifications

### Intensity bands (from design-taste-frontend, corrected)

| Band | What is allowed | Default |
|---|---|---|
| 1-3 | No automatic animation. `:hover`, `:active`, `:focus-visible` state changes only. | dashboards, dense tools |
| 4-7 | Short CSS transitions on transform/opacity, one orchestrated load-in, staggered list entrances. | most product and marketing UI |
| 8-10 | Scroll-driven choreography, pins, parallax, scroll-linked media. | portfolios, launches, scroll stories |

Ambient budget: one orchestrated non-user-triggered moment per page (one load sequence or one signature reveal), at most one marquee per page. Identical fade-and-rise on every section is a generic pattern; vary or remove it (impeccable, frontend-design-direction).

### Duration tokens (impeccable, emil-design-eng, transitions-dev)

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 100-150 ms (default 120 ms) | press, toggle, colour change |
| `--dur-fast` | 200-300 ms (default 200 ms) | menus, tooltips, hover |
| `--dur-base` | 300-500 ms (default 350 ms) | accordion, modal, drawer |
| `--dur-slow` | 500-800 ms (default 600 ms) | page/hero entrances |
| product UI ceiling | 150-250 ms | app chrome |
| feedback ceiling | 500 ms | any response to user input |
| perceived instant | < ~80 ms | response latency target |

Asymmetric pairs (transitions-dev + emil-design-eng): dropdown 250 ms open from scale 0.97 / 150 ms close to 0.99; modal 250 / 150 ms at scale 0.96; tooltip 80 ms delay, 150 ms in, 50 ms out with no delay; panel 400 / 350 ms; hold-to-confirm fill 2000 ms linear, release 200 ms ease-out.

### Easing tokens

| Token | Value | Source |
|---|---|---|
| `--ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` | impeccable |
| `--ease-out-quint` | `cubic-bezier(0.22, 1, 0.36, 1)` | impeccable |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` (default entrance) | impeccable, design-taste-frontend |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | default — adjust per brand |
| `--ease-overshoot` | `cubic-bezier(0.34, 1.35, 0.64, 1)` (success check only; no bounce/elastic on UI surfaces) | transitions-dev |

### Springs (motion/react; remotion-video-creation presets, approximate mapping)

| Name | Config | Use |
|---|---|---|
| smooth | `{ type: "spring", stiffness: 100, damping: 20 }` (critically damped at mass 1, no overshoot) | reveals, pointer-follow |
| snappy | `{ type: "spring", stiffness: 200, damping: 20 }` | UI elements |
| heavy | `{ type: "spring", stiffness: 80, damping: 15, mass: 2 }` | large weighty moves |
| bouncy | `{ type: "spring", damping: 8 }` | deliberately playful only |

The unconfigured default (stiffness 100, damping 10, mass 1) overshoots; always configure.

### Geometry and stagger

- Entry scales: modal 0.96, dropdown 0.97 (closes to 0.99), tooltip 0.98, floor 0.9 (emil-design-eng, transitions-dev). Press feedback `scale(0.96)`-`0.97` with an opt-out for large surfaces.
- Reveal: opacity 0 → 1, `translateY(24px)` → 0, 0.6 s, ease-out-expo, trigger once at 30% visible (design-taste-frontend).
- Stagger: 30-80 ms per item (emil-design-eng); default 50 ms; the last item starts within ~400-500 ms total (impeccable; auditor synthesis). Text lines 40 ms; words 50 ms. Never block interaction while a stagger plays.
- Blur bridges for crossfades: 2 px (icon/text swap, panel), 3 px (page slide), 8-10 px one-off success check, hard cap 20 px; blur is paint-expensive, worst in Safari (emil-design-eng, transitions-dev). WCAG errata count blur as motion, so drop it under reduced motion.
- Short-travel slides: panel travels ~100 px or half its height with 2 px blur; side-by-side page swap 8 px + 3 px blur, 250 ms; park off-screen surfaces with `translateY(100%)` (self-sizing) rather than pixel offsets.
- Hover tilt ≤ ~5° with 1000 px perspective; disable heavy decorative effects (particles, tilt, cursor followers) below 768 px and on `(hover: none)` (frontend-slides, MIT; default — adjust per product).

### Platform status (webstatus.dev, retrieved 2026-10-24)

| Feature | Status | Use as |
|---|---|---|
| `prefers-reduced-motion` | Baseline widely available since 2020-01 | required |
| Same-document View Transitions | Baseline newly available 2025-10-14 | enhancement, feature-detect |
| Cross-document View Transitions | Limited (Chromium 126, Safari 18.2; no Firefox) | enhancement; non-supporting browsers just navigate |
| CSS scroll-driven animations | Limited (Chromium 115, Safari 26; no Firefox) | enhancement inside `@supports` |
| `@starting-style` | Baseline newly available 2024-08-06 | enhancement; skipped gracefully |
| `popover` | Baseline newly available 2025-01-27 | menus/toasts in vanilla builds |

### Library versions (npm, retrieved 2026-10-24; verify at runtime with `npm view <pkg> version`)

- `motion` 14.6.0 (MIT). Import from `motion/react` (React) or `motion` (vanilla). `framer-motion` is still published in lockstep but do not list both in `package.json`; rewrite `framer-motion` imports to `motion/react`.
- `gsap` 3.15.0 and `@gsap/react` 2.1.2. All plugins (ScrollTrigger, SplitText, others) are in the public package and free for commercial use under GSAP's Standard "no charge" licence, which is proprietary, not OSI. Recalled (not re-read 2026-10-24): it bars building a competing no-code/visual animation or site builder; get legal review for that case. Remove old private-registry `.npmrc` entries.
- `lenis` 1.3.27 (MIT). `@studio-freight/lenis` is deprecated. React wrapper `lenis/react`; stylesheet `lenis/dist/lenis.css`.

## Implementation

Detect the stack first: read `package.json` for `motion`, `framer-motion`, `gsap`, `lenis`, `@react-three/fiber`; check `capability-registry.md` status or run `node ../scripts/environment-audit.mjs --project <dir>` (it reports animation libs). Installing an ordinary dependency is autonomous; adding a second animation library is not, because of rule 5.

### 1. Tokens and the global reduced-motion layer

Put tokens in the token pipeline owned by [design-tokens](design-tokens.md). Tailwind v4 has an `--ease-*` theme namespace; durations stay plain custom properties.

```css
@theme {
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-in-out-ui: cubic-bezier(0.65, 0, 0.35, 1);
}
:root { --dur-instant: 120ms; --dur-fast: 200ms; --dur-base: 350ms; --dur-slow: 600ms; }

.btn { transition: transform var(--dur-instant) var(--ease-out-quart), background-color var(--dur-fast) ease; }
.btn:active { transform: scale(0.97); }

/* Safety net only. Each component still designs its own substitute (rule 13). */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; }
  .btn:active { transform: none; }
}
```

Avoid the blanket `animation-duration: 0.01ms !important` override as the only strategy: it removes feedback and can skip `animationend`-driven logic.

### 2. Reveal-safe scroll reveal (CSS-first)

```css
/* Visible by default. Pre-reveal state exists only where supported and allowed. */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .reveal { animation: reveal linear both; animation-timeline: view(); animation-range: entry 0% entry 40%; }
    @keyframes reveal { from { opacity: 0; transform: translateY(24px); } }
  }
}
```

Fallback for Firefox or when the effect must run everywhere (vanilla IntersectionObserver, unobserve after first fire):

```js
export function initReveals(root = document) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return () => {};
  document.documentElement.classList.add('js-reveal');           // CSS: .js-reveal .reveal:not(.in){opacity:0;transform:translateY(24px)}
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { threshold: 0.3 });
  root.querySelectorAll('.reveal').forEach((el, i) => { el.style.setProperty('--i', i % 8); io.observe(el); });
  return () => io.disconnect();
}
/* .reveal { transition: opacity 600ms var(--ease-out-expo), transform 600ms var(--ease-out-expo); transition-delay: calc(var(--i, 0) * 50ms); } */
```

### 3. motion/react (React 19, Next.js App Router)

Motion components are client-only: put them in a `"use client"` file. Set the global policy once.

```tsx
"use client";
import { MotionConfig, motion, AnimatePresence, useReducedMotion } from "motion/react";

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;   // disables transform/layout animation under reduce
}

const ease = [0.16, 1, 0.3, 1] as const;
export function RevealList({ items }: { items: { id: string; label: string }[] }) {
  const reduce = useReducedMotion();
  return (
    <ul>
      {items.map((it, i) => (
        <motion.li key={it.id}
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease, delay: Math.min(i * 0.05, 0.4) }}>
          {it.label}
        </motion.li>
      ))}
    </ul>
  );
}

export function Popover({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="popover" role="dialog"
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1, transition: { duration: 0.25, ease } }}
          exit={{ opacity: 0, scale: 0.99, transition: { duration: 0.15 } }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

Notes: `whileInView` with `initial` renders the hidden state in SSR HTML, so use it only below the fold (rule 9). Exit animations need all three: `AnimatePresence`, a stable `key` on the direct child, an `exit` prop. `mode="wait"` for one-at-a-time swaps, `"popLayout"` when removing from a reflowing list. Use `layout`/`layoutId` only for real reorder or shared-element changes and keep layout subtrees small (~5 children, ecc:motion-patterns). Derive per-frame values with `useMotionValue` + `useTransform`; never create motion values during render.

### 4. GSAP + ScrollTrigger with `useGSAP` and `gsap.matchMedia`

```tsx
"use client";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);

export function HorizontalTrack({ children }: { children: React.ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px) and (hover: hover)", () => {
      const el = track.current!;
      const distance = () => Math.max(0, el.scrollWidth - window.innerWidth);
      gsap.to(el, {
        x: () => -distance(), ease: "none",
        scrollTrigger: { trigger: section.current, pin: true, start: "top top", end: () => `+=${distance()}`,
                         scrub: 1, invalidateOnRefresh: true },
      });
    });
    return () => mm.revert();
  }, { scope: section });
  // Default markup (reduced motion, narrow, touch): native horizontal scroll-snap row, fully reachable.
  return (
    <section ref={section} aria-label="Selected work">
      <div ref={track} className="flex gap-6 overflow-x-auto snap-x snap-mandatory md:overflow-visible">{children}</div>
    </section>
  );
}
```

Pin rules: start pins at `"top top"` (later starts show half a slide); never combine CSS `position: sticky` and a GSAP pin on the same element; use function values plus `invalidateOnRefresh` for anything measured; call `ScrollTrigger.refresh()` after fonts and images that change layout load. Sticky-stack variant: pin every card but the last with `pinSpacing: false` and scrub each card's `scale → 0.92, opacity → 0.55` from the next card's trigger (`"top bottom"` → `"top top"`) (design-taste-frontend, corrected). Vanilla GSAP: same code inside an init function using `gsap.context(() => {...}, rootEl)`; return `() => ctx.revert()`.

### 5. Lenis (scroll-story sites only)

Use Lenis only when the brief is a scroll story (band 8-10) and GSAP already drives the scenes. One clock: either `autoRaf: true` or the GSAP ticker, never both.

```tsx
"use client";
import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: Lenis | null = null;
    const tick = (t: number) => lenis?.raf(t * 1000);
    const start = () => {
      if (mq.matches || lenis) return;
      lenis = new Lenis({ autoRaf: false, anchors: true });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(tick); gsap.ticker.lagSmoothing(0);
    };
    const stop = () => { gsap.ticker.remove(tick); lenis?.destroy(); lenis = null; ScrollTrigger.refresh(); };
    const onChange = () => (mq.matches ? stop() : start());
    start(); mq.addEventListener("change", onChange);
    return () => { mq.removeEventListener("change", onChange); stop(); };
  }, []);
  return <>{children}</>;
}
```

Mark nested scroll areas (menus, modals, code blocks) with `data-lenis-prevent` (recalled from the Lenis README; verify there). Never use Lenis on dashboards, forms-heavy apps or documentation. The sibling style skills [cinematic-noir-studio](../../cinematic-noir-studio/SKILL.md) and [monochrome-editorial-portfolio](../../monochrome-editorial-portfolio/SKILL.md) contain full scroll-room and hero-morph recipes built on this clock; follow this file's rules when adapting them.

### 6. Scroll rooms without a library

A sticky "room" (`height: 200vh` section, `position: sticky; top: 0; height: 100dvh` stage) driven by one passive, rAF-batched listener; finish the effect at 90% of the travel so it never ends mid-transition (adapted from monochrome-editorial-portfolio).

```js
export function room(section, apply, { finishAt = 0.9 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(1); return () => {}; }  // CSS also unsticks the stage
  let queued = false, visible = false;
  const frame = () => {
    queued = false;
    const travel = section.offsetHeight - innerHeight; if (travel <= 0) return;
    const p = Math.min(Math.max(-section.getBoundingClientRect().top / travel, 0), 1);
    apply(Math.min(p / finishAt, 1));
  };
  const onScroll = () => { if (visible && !queued) { queued = true; requestAnimationFrame(frame); } };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) onScroll(); });
  io.observe(section);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  return () => { io.disconnect(); removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); };
}
```

`apply(p)` writes only transforms, opacity or a CSS custom property. To "unblur" media, crossfade a pre-blurred twin instead of animating `filter`.

### 7. View Transitions

```ts
export function transition(update: () => void) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("startViewTransition" in document)) { update(); return; }
  document.startViewTransition(update);
}
```

```css
@media (prefers-reduced-motion: no-preference) {
  @view-transition { navigation: auto; }          /* MPA cross-document; unsupported browsers navigate normally */
}
::view-transition-old(root), ::view-transition-new(root) { animation-duration: 250ms; }
.product-hero { view-transition-name: product-hero; }   /* name only elements that must morph; names must be unique per page */
```

Keep view transitions at ~200-400 ms. In Next.js, check the installed React/Next versions for a `<ViewTransition>` component before using it (the brief cites React 19.3; verify at runtime with `npm view react version` and the React docs); otherwise use the function above in a client component.

### 8. Entry without JS: `@starting-style` and popover

```css
[popover] { transition: opacity 200ms ease-out, transform 200ms var(--ease-out-quart), display 200ms allow-discrete, overlay 200ms allow-discrete; }
[popover]:popover-open { opacity: 1; transform: none; }
@starting-style { [popover]:popover-open { opacity: 0; transform: scale(0.97); } }
[popover]:not(:popover-open) { opacity: 0; transform: scale(0.99); transition-duration: 150ms; }
@media (prefers-reduced-motion: reduce) { [popover], [popover]:not(:popover-open) { transform: none; } }
```

Popover positioning relative to a trigger still needs JS (Floating UI) because anchor positioning is Limited availability (webstatus.dev, 2026-10-24). Component behaviour (focus, dismissal) is owned by [interaction-design](interaction-design.md).

### 9. Performance hygiene

- `will-change: transform` only while animating (add on `pointerenter` or an `.animating` class, remove on `transitionend`); never on dozens of elements permanently.
- One rAF loop per scene; stop it when the target is reached (`Math.abs(target - current) < epsilon`), when off-screen (IntersectionObserver) and when `document.hidden`.
- Batch DOM reads before writes inside a frame; never read layout (`getBoundingClientRect`) after writing styles in the same frame.
- Prefer CSS scroll-driven animations and CSS transitions where supported; they can run off the main thread.
- Budgets and INP/CLS thresholds are owned by [performance](performance.md); 3D render loops by [three-dimensional-web](three-dimensional-web.md).

## Failure modes & fallbacks

| Symptom | Cause | Fix |
|---|---|---|
| Sections blank in screenshots or with JS off | pre-reveal `opacity: 0` set unconditionally | gate behind `.js-reveal`/`@supports` (Implementation 2); never on LCP |
| Pinned section shows half a slide | `start: "top center"` or similar | `start: "top top"` |
| Horizontal track wrong after resize | distance computed once | function values + `invalidateOnRefresh: true` |
| Pins jump with Lenis | two rAF clocks or missing `ScrollTrigger.update` | GSAP ticker only, `autoRaf: false`, `lenis.on("scroll", ScrollTrigger.update)` |
| Modal/menu cannot scroll under Lenis | wheel captured by Lenis | `data-lenis-prevent` on the scroll container |
| Exit animation never runs | missing `AnimatePresence`, `key` or `exit` | add all three |
| Stutter on mid-range phones | animating layout or large blur/filter, permanent `will-change` | transform/opacity only, crossfade pre-blurred twin, scoped `will-change` |
| Memory or CPU grows across routes | ScrollTriggers/rAF/observers not cleaned up | `useGSAP`/`ctx.revert()`, `cancelAnimationFrame`, `disconnect()` |
| Hydration mismatch | reading `matchMedia` during render | read in effects/hooks (`useReducedMotion`), default to "no motion" on the server |
| GSAP install fails with auth error | stale `npm.greensock.com` `.npmrc` entry | remove it; install `gsap` from the public registry |
| Library unavailable or install blocked | offline, policy | fall back one rung down the ladder (rule 4), down to CSS-only; escalate others to [troubleshooting](troubleshooting.md) |

## Verification

Feeds Gate D (reduced motion, 2.2.2 pause control, 2.3.1 flashes), Gate E (frame cost, INP, CLS), Gate C (motion quality in critique), Gate B (content and CTAs work with motion off or JS failing) and Gate H (cleanup, no console errors). Definitions in [quality-gates](quality-gates.md).

1. **Static review (always possible):** grep the diff for `transition: all`, animated `width|height|top|left|margin`, `scale(0)`, `ease-in` on UI, `framer-motion` imports, `@studio-freight/lenis`, unconditional `opacity: 0` on reveal classes, listeners without removal, rAF without `cancelAnimationFrame`. Each hit is a finding.
2. **Reduced motion:** run `node ../scripts/visual-check.mjs --url <url> --reduced-motion --out <dir>` (exit 4 = BLOCKED, Playwright not resolvable). In Playwright directly: `await page.emulateMedia({ reducedMotion: 'reduce' })`, then assert no pin spacers (`.pin-spacer`), no Lenis class on `html`, all sections visible and in normal flow.
3. **Content without motion:** screenshot with JS disabled (`javaScriptEnabled: false`) or immediately after load; every section must have content.
4. **Frame cost:** check the capability registry or probe with ToolSearch for Chrome DevTools MCP (`performance_start_trace`, `performance_analyze_insight`). If `available-verified`, record a trace while scrolling the heaviest section and report long tasks and layout shifts. Otherwise mark frame-rate checks NOT_TESTED with the reason; never claim "60 fps" without a trace.
5. **Pause controls:** for every autoplaying element longer than 5 s, confirm a visible, keyboard-operable pause control exists and works.
6. **Cleanup:** navigate between routes 5 times in the dev build and check the console and `ScrollTrigger.getAll().length` (should not grow).
7. Report each check separately (source written, renders, reduced-motion verified, performance traced). Untested items are NOT_TESTED, not PASS.

## Sources

Installed skills (ideas paraphrased; numbers credited inline):
- design-taste-frontend: intensity bands, reveal and spring specs, pin patterns (licence: none found; paraphrased, corrections by the audit).
- impeccable: duration and easing tokens, reveal-safe rules, stagger caps (prose licence: none found; Apache-2.0 SPDX headers on its detector scripts only; paraphrased).
- emil-design-eng: frequency gate, easing decision tree, asymmetric timing, entry scales, blur bridges, clip-path techniques (licence: none found; paraphrased).
- transitions-dev: asymmetric timings, blur tokens, panel/page slides, success-check composition (licence: none found; paraphrased).
- ECC plugin skills: frontend-slides (MIT) animation-feel timings and 768 px heavy-effect cutoff; frontend-design-direction, make-interfaces-feel-better, motion-patterns, motion-advanced, react-performance, frontend-a11y, remotion-video-creation (ECC; MIT recorded in the audit for frontend-slides, verify per skill).
- Anthropic frontend-design: ambient motion budget (paraphrased).
- Sibling skills cinematic-noir-studio and monochrome-editorial-portfolio (this repository): Lenis+GSAP clock, scroll room pattern, pinned track; adapted.

External (all retrieved 2026-10-24): MDN https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion · WCAG https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html, https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html · Motion https://www.npmjs.com/package/motion, https://github.com/motiondivision/motion/blob/main/CHANGELOG.md · GSAP https://www.npmjs.com/package/gsap, https://gsap.com/standard-license, https://webflow.com/blog/gsap-becomes-free, https://www.npmjs.com/package/@gsap/react · Lenis https://www.npmjs.com/package/lenis, https://github.com/darkroomengineering/lenis · Baseline https://webstatus.dev/features/view-transitions, https://webstatus.dev/features/cross-document-view-transitions, https://webstatus.dev/features/scroll-driven-animations, https://webstatus.dev/features/starting-style, https://webstatus.dev/features/popover
