# Shader and creative coding

Write fragment shaders, full-screen passes, procedural textures and generative backgrounds that look intentional, stay cheap on mobile GPUs, respect reduced motion and can be screenshot-tested deterministically. Scene architecture, renderer choice, budgets and disposal live in [three-dimensional-web](three-dimensional-web.md).

**Load when:** the request mentions shaders, GLSL, WGSL, TSL, node materials, noise, gradients, grain, SDFs, procedural textures, post-processing looks (bloom, chromatic fringe, halo), generative or animated backgrounds, Canvas 2D or SVG generative art, cursor reveals or lens/distortion effects. **Owns:** GLSL vs TSL choice, full-screen pass patterns, noise/SDF/procedural techniques, uniform and time management, shader precision and mobile GPU pitfalls, Canvas 2D/SVG generative fallbacks, shader reduced-motion handling and deterministic shader testing.
**Related:** [three-dimensional-web](three-dimensional-web.md), [motion-engineering](motion-engineering.md), [visual-systems](visual-systems.md), [performance](performance.md), [accessibility](accessibility.md), [visual-testing](visual-testing.md), [capability-registry](capability-registry.md), [cinematic-3d workflow](../workflows/cinematic-3d.md), [quality-gates](quality-gates.md)

## Decision rules

1. Pick the cheapest medium that achieves the look: CSS gradients/masks → static SVG or a pre-rendered texture → Canvas 2D → one WebGL2 full-screen pass (raw or OGL) → three.js `ShaderMaterial` → TSL on WebGPURenderer. Escalate only when the cheaper rung visibly fails the art direction.
2. Never default a product to an animated shader background. The background must serve the direction chosen in [design-intelligence](design-intelligence.md); text over it must still meet contrast ([accessibility](accessibility.md)).
3. Write GLSL ES 3.00 when the renderer is WebGLRenderer, OGL or raw WebGL2. Write TSL when the renderer is WebGPURenderer; never use `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile` or `EffectComposer` there.
4. Draw full-screen effects with a single oversized triangle (3 vertices, no buffers), not a two-triangle quad and never a DOM-sized plane mesh in a perspective scene.
5. Drive all time from one clock. Pass time in seconds as a uniform, wrap it to the effect's loop period (or ≤ 3600 s, default — adjust), and clamp per-frame delta to ≤ 1/30 s after pauses.
6. Declare `precision highp float;` in every GLSL ES 3.00 fragment shader. Never rely on `fract(sin(x) * 43758.5453)` hashes; use an arithmetic hash (hash-without-sine) or an integer hash in WebGL2.
7. Set resolution uniforms in device pixels and derive coordinates from `gl_FragCoord.xy / uRes`. Correct for aspect ratio before any distance or noise lookup.
8. Cap the drawing buffer: DPR ≤ 1.5 for full-screen effects on any device (default — adjust), or use a pixel budget `dpr = min(devicePixelRatio, 2, sqrt(4.5e6 / (w*h)))` (monochrome-editorial recipe 8). Render blurs, glows and feedback passes at half resolution.
9. Limit noise to 4-6 fBm octaves (default — adjust) and at most one level of domain warping per pixel on mobile. Prefer a precomputed noise texture when the same noise is sampled more than twice.
10. Add ±0.5/255 dither to every smooth gradient and dark noise field to prevent banding.
11. Antialias SDF edges with `fwidth` or a pixel-sized `smoothstep` width; never use hard `step` edges on visible shapes.
12. Keep post-processing restrained: bloom only above a high luminance threshold (start at 0.70) with no exposure or contrast gain; chromatic fringe as opposing red/blue spatial offsets of about ±1 px per 1000 px width, green and alpha untouched; halos from a per-frame luminance edge mask, never by translating the frame.
13. Under `prefers-reduced-motion: reduce`, render one frame at a chosen representative time and stop the loop; pointer-driven reveals become static. Re-check the media query on `change`.
14. Pause every loop when the canvas is off-screen (IntersectionObserver) or the tab is hidden; resume without a time jump.
15. Every shader effect ships a non-WebGL fallback that keeps the layout and contrast: a CSS gradient, a static poster, or a Canvas 2D/SVG version. A shader compile or link failure must fall back silently to it, with the error logged in development.
16. Make every generative piece deterministic for tests: seeded PRNG, a fixed-time override (`?t=` or a test hook) and a ready flag after the first frame.
17. Mark generative canvases `aria-hidden="true"` unless they convey information; if they do, the information must also exist as DOM text.

## Specifications

### Medium selection

| Look | First choice | Escalate to |
|---|---|---|
| Static gradient, mesh-like blend | CSS `radial-gradient`/`conic-gradient` layers | Pre-rendered AVIF/WebP |
| Film grain | Static SVG `feTurbulence` tile or a small noise PNG (opacity 0.04-0.08, default — adjust) | WebGL grain in an existing pass |
| Cursor spotlight / reveal | CSS `mask-image` radial gradient on a lerped cursor (noir recipe 7) | Shader mask with distortion |
| Slow flowing noise background | WebGL2 full-screen pass (~0 KB lib) or OGL (~39 KB gz) | three only if a scene already exists |
| Particles < ~2k (default — adjust) | Canvas 2D | `THREE.Points`/instancing |
| Particles 10k+ with simulation | GPGPU: TSL compute (WebGPURenderer) or ping-pong float render targets (WebGL2) | — |
| Lens / refraction carousel | Two passes: content to a render target, lens pass to screen (monochrome-editorial recipe 8) | — |

### GLSL vs TSL

| | GLSL ES 3.00 | TSL (`three/tsl`) |
|---|---|---|
| Renderer | WebGLRenderer, OGL, raw WebGL2 | WebGPURenderer (WebGPU or its WebGL2 backend) |
| Output | GLSL | Transpiled to WGSL or GLSL per active backend |
| Materials | `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile` | `*NodeMaterial` with `colorNode`, `positionNode`, etc. |
| Post | pmndrs `postprocessing` / `EffectComposer` | `RenderPipeline` (alias `PostProcessing`) node stack |
| Compute | Ping-pong render targets | Native compute nodes |
| Status (r186, 2026-10) | Stable | Renderer still "experimental" in the manual; r184 claims ~3x faster TSL compile |

### Precision and mobile GPU limits

| Issue | Detail | Mitigation |
|---|---|---|
| mediump = fp16 on many mobile GPUs | ~10-bit mantissa: large `uTime`, big UVs and `sin(large)` lose precision, noise shimmers or bands | `highp`, wrap time, keep coordinates small, `mod` before `sin` |
| `sin`-based hashes | Results differ across GPUs and break at low precision | Hash-without-sine / integer hash |
| Float render targets | WebGL2 needs `EXT_color_buffer_float` to render to float; linear filtering of float textures needs `OES_texture_float_linear` | Feature-check; fall back to half-float or 8-bit with encoding |
| Texture size | `MAX_TEXTURE_SIZE` can be 4096 on low-end devices | Query it; keep effect textures ≤ 2048 |
| Fill rate | Cost scales with pixels × passes; high-DPR phones hit this first | DPR cap, half-res passes, fewer passes |
| Overdraw and `discard` | Full-screen alpha layers and `discard` defeat early-z | One opaque pass; composite effects in one shader |
| Loops and branches | Data-dependent loops are slow on older GPUs | Constant loop bounds; unroll small loops |
| Shader compile jank | Large programs stall the first frame | Compile before reveal (`renderer.compileAsync`, non-blocking since r184); keep the poster up until ready |

### Post-processing starting values (video-editing skill; tuned for 1920 px, scale by width)

| Effect | Start | Known failure |
|---|---|---|
| Bloom | threshold 0.70, gain 0.12, size 6 px, blend 22% | gain 1.22 + contrast 1.16 + bloom gain 0.72 at size 18 blew out highlights |
| Chromatic fringe | R −0.001, B +0.001 normalised (≈ ±1.92 px at 1920 px) | Channel remapping instead of spatial offset tinted the image green |
| Edge halo | size 2 px, gain 0.10, blend 25%, edge mask luminance 0.07-0.35 | Translating the full frame exposed a border |

### Time and uniform conventions (defaults — adjust per product)

- `uTime`: seconds, wrapped to the loop period; `uRes`: drawing-buffer pixels; `uPointer`: 0-1 in canvas space, damped on the CPU (lerp 0.1-0.15 per frame; noir recipe 7 uses 0.15).
- Update uniforms once per frame in one place; never allocate vectors or arrays per frame.
- Speed: ambient background drift completes a visible cycle in ≥ 20 s (default — adjust); faster motion competes with content and triggers vestibular discomfort ([motion-engineering](motion-engineering.md)).

## Implementation

Detect the stack first: if three/R3F is already in the project, write the effect as a material on its renderer; otherwise use the raw WebGL2 pass below (framework-agnostic; wrap in a React `useEffect` that returns the cleanup).

### Raw WebGL2 full-screen pass (vanilla, with pause, context loss, reduced motion and fixed-time testing)

```js
const VS = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);   // (0,0) (2,0) (0,2)
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);              // one triangle covers the screen
}`;

export function mountShader(canvas, fragment, { fixedTime = null, maxDpr = 1.5, period = 3600 } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power' });
  if (!gl) return null;                                       // caller keeps the CSS fallback
  const reducedMq = matchMedia('(prefers-reduced-motion: reduce)');
  let prog = null, uRes, uTime, raf = 0, onScreen = true, elapsed = 0, last = 0;

  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'compile failed');
    return s;
  };
  const build = () => {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link failed');
    gl.useProgram(prog);
    gl.bindVertexArray(gl.createVertexArray());
    uRes = gl.getUniformLocation(prog, 'uRes'); uTime = gl.getUniformLocation(prog, 'uTime');
  };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, maxDpr);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
  };
  const draw = (t) => { resize(); gl.uniform2f(uRes, canvas.width, canvas.height); gl.uniform1f(uTime, t % period); gl.drawArrays(gl.TRIANGLES, 0, 3); };
  const still = () => fixedTime !== null || reducedMq.matches;
  const tick = (now) => {
    elapsed += Math.min((now - last) / 1000, 1 / 30); last = now;   // clamped delta: no jump after pause
    draw(elapsed); raf = requestAnimationFrame(tick);
  };
  const sync = () => {
    cancelAnimationFrame(raf); raf = 0;
    if (!prog || gl.isContextLost()) return;
    if (still()) { draw(fixedTime ?? 4.0); canvas.dataset.ready = 'true'; return; } // representative frame
    if (onScreen && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); }
  };

  try { build(); } catch (err) { console.error('[shader]', err); return null; }
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); });
  const ro = new ResizeObserver(() => { if (!raf && prog) sync(); });
  const lost = (e) => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; prog = null; canvas.dataset.contextLost = 'true'; };
  const restored = () => { delete canvas.dataset.contextLost; try { build(); sync(); } catch (err) { console.error('[shader]', err); } };
  io.observe(canvas); ro.observe(canvas);
  document.addEventListener('visibilitychange', sync);
  reducedMq.addEventListener('change', sync);
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  sync(); requestAnimationFrame(() => { canvas.dataset.ready = 'true'; });

  return () => {
    cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', sync);
    reducedMq.removeEventListener('change', sync);
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
    if (prog) gl.deleteProgram(prog);
  };
}
```

Read `fixedTime` from a test-only hook (for example `new URLSearchParams(location.search).get('t')` in non-production builds). Put the CSS fallback gradient on the canvas's parent so it shows whenever the canvas is not drawn.

### Fragment: aspect-correct fBm with domain warp and dither

```glsl
#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
out vec4 outColor;

float hash12(vec2 p) {                       // arithmetic hash (after Dave Hoskins, "Hash without Sine", MIT)
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * valueNoise(p); p = p * 2.02 + 17.0; a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 3.0;   // aspect-correct, small coordinates
  float t = uTime * 0.03;                                    // slow drift
  float n = fbm(p + vec2(fbm(p + t), fbm(p - t)));           // one level of domain warp
  vec3 col = mix(vec3(0.04, 0.04, 0.06), vec3(0.23, 0.25, 0.35), n); // take colours from tokens
  col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;            // dither against banding
  outColor = vec4(col, 1.0);
}
```

Feed palette values from the design tokens ([design-tokens](design-tokens.md)) as uniforms instead of hard-coding them in production.

### SDF building blocks (GLSL)

```glsl
float sdCircle(vec2 p, float r) { return length(p) - r; }
float sdRoundBox(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float fill(float d) { float w = fwidth(d); return 1.0 - smoothstep(-w, w, d); } // pixel-width AA
// union: min(a, b); intersection: max(a, b); subtraction: max(a, -b); smooth union via a polynomial smin
```

Use the rounded-box SDF for image cards drawn in a shader (mask edges, borders, soft shadows via `smoothstep` on the distance).

### three.js material variants

```ts
// WebGLRenderer: GLSL ShaderMaterial (reuse the fragment above minus #version/out; three injects them)
const material = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uRes: { value: new THREE.Vector2() } },
  vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }', // with a 2x2 PlaneGeometry
  fragmentShader, depthTest: false, depthWrite: false,
});
// In R3F: useFrame((_, dt) => { material.uniforms.uTime.value += Math.min(dt, 1 / 30); });
```

```ts
// WebGPURenderer: TSL node material (verify names at runtime against the installed three)
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uv, time, sin, mix, color, uniform } from 'three/tsl';
const speed = uniform(0.2);                              // set 0 under reduced motion
const material = new MeshBasicNodeMaterial();
material.colorNode = mix(color('#0b0b10'), color('#3a3f58'),
  sin(uv().x.mul(6.0).add(time.mul(speed))).mul(0.5).add(0.5));
```

In R3F, `<Canvas frameloop="demand">` plus `invalidate()` only while animating keeps idle cost at zero; pausing and context loss follow [three-dimensional-web](three-dimensional-web.md).

### Cheap fallbacks: CSS, SVG, Canvas 2D

```html
<!-- Static grain: one filter render, never animated on large surfaces (feTurbulence is CPU-expensive) -->
<svg class="pointer-events-none fixed inset-0 h-full w-full opacity-[0.06]" aria-hidden="true">
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter>
  <rect width="100%" height="100%" filter="url(#grain)"/>
</svg>
```

```js
// Seeded Canvas 2D field: deterministic, DPR-capped, pausable
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export function drawField(canvas, seed = 7, count = 600) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const dpr = Math.min(devicePixelRatio || 1, 2), rand = mulberry32(seed);
  canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.fillStyle = getComputedStyle(canvas).color;          // colour from CSS tokens
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.15 + rand() * 0.5;
    ctx.fillRect(rand() * canvas.clientWidth, rand() * canvas.clientHeight, 1.5, 1.5);
  }
}
```

Animate a Canvas 2D field with the same `sync()` pattern as the WebGL pass (IntersectionObserver, `visibilitychange`, reduced-motion still frame).

### Cursor spotlight reveal without a shader (cinematic-noir recipe 7, adapted)

Stack two aligned images (make the reveal image by editing the base so they register exactly). Each frame, lerp a smoothed point toward the pointer at 0.15 and set `mask-image` (plus `-webkit-mask-image`) on the reveal layer to a soft radial gradient (~260 px circle with stepped alpha falloff). Pause when the IntersectionObserver reports the wrapper off-screen; remove listeners and cancel the frame on cleanup. On coarse pointers or reduced motion, show the base image with a static centred reveal or none; never hide content only inside the reveal.

### Lens pass (monochrome-editorial recipe 8, shader side)

Render cards to a render target (SDF rounded-box masks, cover-fit with ~1.08x over-scan), then a full-screen lens pass: transform to lens space, compute a superellipse distance (`pow(pow(k.x,e)+pow(k.y,e),1/e)`), smootherstep a ramp across the rim, bend UVs outside the lens, and split R/B by a small displacement for dispersion. Keep the dispersion within the fringe limits above. Fallback: CSS scroll-snap carousel below 768 px or without WebGL.

## Failure modes & fallbacks

| Symptom | Cause | Fix |
|---|---|---|
| Black canvas, console shader log | Compile/link error (missing precision, GLSL 1.00 vs 3.00 syntax, `texture2D` in 3.00) | Read `getShaderInfoLog`; in three, keep `renderer.debug.checkShaderErrors` on in dev; fall back to CSS |
| Banding in dark gradients | 8-bit output, no dither | ±0.5/255 dither; avoid very low-contrast long ramps |
| Noise shimmers or freezes after minutes | Time precision loss at mediump / large values | Wrap time; `highp`; small coordinates |
| Pattern differs per device | `sin` hash, driver precision | Arithmetic or integer hash |
| Effect stretched on resize | Missing aspect correction or stale `uRes` | Aspect-correct coordinates; update `uRes` on resize |
| Battery drain, fan noise | Loop runs off-screen, full DPR, many passes | Pause, DPR cap, half-res passes, `frameloop="demand"` |
| Green tint / exposed border in post | Channel remap; translated frame | Spatial channel offsets; edge-mask halos |
| Text over the effect fails contrast | Animated brightness peaks | Clamp the palette range; add a scrim; measure worst-case frame |
| Works in Chrome, blank in Safari/Firefox | Float render target or extension missing | Feature-check extensions; half-float or 8-bit path |

Fallback order: reduce octaves/passes → lower DPR → render one still frame → CSS gradient or static poster.

## Verification

Feeds gates **C** (visual), **E** (performance), **D** (accessibility: contrast over the effect, reduced motion), **H** (no console errors, listeners and GL objects released). Check browser capability first ([capability-registry](capability-registry.md), ToolSearch for browser tools, or `scripts/visual-check.mjs`); without one, mark visual checks NOT_TESTED with the reason.

1. **Deterministic screenshot:** load with the fixed-time hook (for example `?t=4`) and wait for `[data-ready="true"]`; capture at each viewport ([visual-testing](visual-testing.md)). Repeat twice; the two captures must match exactly on the same machine. Across machines or software GL (SwiftShader in headless Chromium), compare with a pixel tolerance, because GPU precision differs.
2. **Reduced motion:** `node <skill-dir>/scripts/visual-check.mjs --url <url> --reduced-motion` → no running loop (two captures 1 s apart are identical), still frame present.
3. **Fallback:** stub `HTMLCanvasElement.prototype.getContext` to return null, or force a compile error in a test build → CSS fallback visible, no uncaught errors, layout unchanged.
4. **Context loss:** `gl.getExtension('WEBGL_lose_context').loseContext()` then `restoreContext()` → fallback then recovery without a reload.
5. **Pause:** scroll the canvas off-screen and hide the tab; confirm no rAF callbacks fire (Performance panel or a counter in dev).
6. **Contrast:** check text contrast against the brightest and darkest frames of the effect, not one frame ([accessibility](accessibility.md)).
7. **Cost:** record frame time on a throttled mobile profile in lab conditions and label it lab; the effect must not push INP or LCP over gate E ([performance](performance.md)).
8. **Cleanup:** unmount and remount 3 times; no duplicate listeners, no growing GL object count.

## Sources

- video-editing (ecc plugin skill; Fusion production presets) — bloom, chromatic fringe and halo starting values and failing set. Licence: see [LICENSES_AND_PROVENANCE](../LICENSES_AND_PROVENANCE.md); paraphrased.
- monochrome-editorial-portfolio — `references/recipes.md` §8 (OGL lens carousel, pixel budget, scroll-snap fallback); [SKILL](../../monochrome-editorial-portfolio/SKILL.md). Sibling style skill by the same owner.
- cinematic-noir-studio — `references/recipes.md` §7 (cursor spotlight reveal: lerp 0.15, 260 px mask, IntersectionObserver pause); [SKILL](../../cinematic-noir-studio/SKILL.md). Sibling style skill by the same owner.
- three.js (MIT) WebGPURenderer and TSL manual https://threejs.org/manual/pages/webgpurenderer.html and releases https://github.com/mrdoob/three.js/releases (r184 compileAsync, TSL compile speed). Retrieved 2026-10-24 via the three-dimensional-web research brief.
- Dave Hoskins, "Hash without Sine" (MIT, Shadertoy 4djSRW) — arithmetic hash pattern; from knowledge, not re-fetched this session.
- Khronos WebGL 2.0 / GLSL ES 3.00 specifications (precision qualifiers, `EXT_color_buffer_float`, `OES_texture_float_linear`, `WEBGL_lose_context`) and MDN "WebGL best practices" https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices — from knowledge, not re-fetched this session; verify specific limits at runtime with `gl.getParameter`.
- mulberry32 PRNG (public domain, Tommy Ettinger) — from knowledge.
