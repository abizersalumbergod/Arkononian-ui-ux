# Three-dimensional web

Decide whether 3D earns its place, pick the lightest technology that delivers it, and build scenes that stay within device budgets, clean up after themselves, survive context loss and degrade to a usable non-3D page. Shader authoring and procedural graphics live in [shader-and-creative-coding](shader-and-creative-coding.md).

**Load when:** the request mentions 3D, Three.js, R3F, WebGL, WebGPU, GLB/glTF, product configurators, model viewers, spatial or cinematic scroll scenes, particles, or a CSS-3D carousel. **Owns:** 3D technology selection, Three.js/R3F scene architecture, scene performance budgets, the glTF asset pipeline, disposal, context loss, render-loop pausing, 3D accessibility alternatives and the 3D fallback ladder.
**Related:** [shader-and-creative-coding](shader-and-creative-coding.md), [motion-engineering](motion-engineering.md), [performance](performance.md), [accessibility](accessibility.md), [asset-generation](asset-generation.md), [visual-testing](visual-testing.md), [frontend-architecture](frontend-architecture.md), [capability-registry](capability-registry.md), [cinematic-3d workflow](../workflows/cinematic-3d.md), [quality-gates](quality-gates.md)

## Decision rules

1. Add 3D only when it carries product meaning (inspect a product, explain a spatial idea, a portfolio's signature moment). Apply the removal test: if nobody would notice it gone, cut it. Never add 3D to settings, forms, checkout or dashboards as decoration.
2. Allow at most one extraordinary 3D moment per page (default — adjust per product). For "wow" requests, propose 2-3 directions with support, performance and complexity trade-offs and get a pick before coding.
3. Climb the technology ladder and stop at the first rung that works: CSS 3D → `<model-viewer>` → OGL or a raw WebGL2 quad → Spline runtime → three.js / R3F. Use WebGPURenderer only when TSL compute, GPGPU particles or a WebGPU-only effect is required.
4. Detect the project's stack first ([frontend-architecture](frontend-architecture.md), `scripts/environment-audit.mjs` → `project.3d`). If three or R3F is already installed, reuse the installed version; never add a second 3D engine.
5. Pin `three` to an exact minor (`0.186.x`); three does not follow semver. Pair React 19 with `@react-three/fiber` 9 and `@react-three/drei` 10 only. Never install fiber 10 / drei 11 alpha or canary tags.
6. Content and the primary call to action must render and work before the 3D layer loads. Load 3D after LCP, lazily, behind an IntersectionObserver, and never let it be the LCP element; the poster image can be.
7. Never put essential information only inside the canvas. Every fact, label, price or control shown in 3D must also exist as DOM text or a DOM control.
8. Give every canvas an accessible role: decorative → `aria-hidden="true"`; meaningful → `role="img"` plus an `aria-label` that describes what the scene shows, and a visible text alternative nearby.
9. Every interactive 3D control (rotate, zoom, choose variant, next hotspot) must have a keyboard-operable DOM button equivalent. Never trap page scroll with orbit zoom on a scrolling page; disable wheel zoom unless the canvas is a dedicated full-screen viewer.
10. Under `prefers-reduced-motion: reduce`, render one still frame (or the poster), turn off auto-rotate, camera drift and scroll-scrubbed camera moves, and keep user-initiated rotation.
11. Use `frameloop="demand"` for scenes that are static between interactions; use `"always"` only while something animates continuously, and pause (`"never"` / `setAnimationLoop(null)`) when the canvas is off-screen or the tab is hidden.
12. Cap DPR: `[1, 1.5]` on mobile, up to `2` on desktop. Degrade through `PerformanceMonitor` / `performance.regress()` before cutting content.
13. Stay inside the budgets in Specifications. If `gltf-transform inspect` or `renderer.info` exceeds the mobile budget, optimise or ship a mobile variant; never ship over budget silently.
14. Run every GLB through `gltf-transform optimize` (Meshopt geometry by default, KTX2 textures where KTX-Software exists, else WebP), then `validate`. Self-host decoder and transcoder files; never load them from a third-party CDN by default.
15. Dispose what you create: geometries, materials, textures (disposing a material does not dispose its textures), render targets, controls, passes. Assert `renderer.info.memory` returns to baseline after a route change.
16. Handle context loss: on `webglcontextlost` stop the loop and show the poster; on restore re-render or remount. For WebGPU handle `onDeviceLost`. Never leave a black rectangle.
17. Ship the fallback ladder for every scene: simplify → lower DPR → static render (poster) → non-3D layout. The poster and the non-3D layout are mandatory, not optional.
18. Never claim a scene "works" from source alone. Builds, renders, holds frame rate, falls back, and passes accessibility are separate claims with separate evidence (see Verification).

## Specifications

### Technology ladder (sizes gzip -9 of CDN builds, measured 2026-10-24; real bundles vary with tree-shaking)

| Rung | Use when | Cost | Not for |
|---|---|---|---|
| CSS 3D transforms (`perspective`, `preserve-3d`, `rotate3d`, `backface-visibility`) | Card flips, tilt, parallax, cube/drum/ring carousels of real DOM content | 0 KB JS, Baseline | Lighting, meshes, shaders |
| `<model-viewer>` 4.4 (verify at runtime: `npm view @google/model-viewer version`) | One product/GLB to inspect, AR (Scene Viewer / Quick Look), poster and lazy load built in | ~289 KB gz all-in-one (bundles three); npm peer `three ^0.183.0` | Custom scenes, scroll choreography |
| OGL 1.0.11 or raw WebGL2 quad | One full-screen shader, gradient, noise, small particle field | ~39 KB gz whole lib, less tree-shaken; GLSL only | PBR scenes, GLTF-heavy work |
| Spline runtime 2.0 (`@splinetool/runtime`; React wrapper `@splinetool/react-spline` 4.1) | Designer authors and iterates the scene in Spline; no-code handoff matters more than weight | ~290 KB gz static graph + on-demand chunks + `.splinecode` fetch | Tight budgets, fine control |
| three r186 (WebGLRenderer) + R3F 9.8 / drei 10.7 | Bespoke scenes, post-processing, physics, scroll-linked choreography | ~194 KB gz (three.core + three.module) | Simple tilt or a lone shader |
| three WebGPURenderer (`three/webgpu`) | TSL node materials, compute/GPGPU, WebGPU-only post (SSGI, SSS) | ~309 KB gz; still labelled experimental in the r186 manual | Default portfolio scenes |

Versions above come from dated research (2026-10); verify at runtime with `npm view three version`, `npm view @react-three/fiber version`, `npm view @react-three/drei version`, `npm view @react-three/postprocessing version`.

### Compatible version set (2026-10)

| Package | Version | Peer constraints |
|---|---|---|
| three | 0.186.x | — |
| @react-three/fiber | ^9.8 | react / react-dom `>=19 <19.4`, three `>=0.156` |
| @react-three/drei | ^10.7 | react ^19, fiber ^9.0.0, three `>=0.159` |
| @react-three/postprocessing | ^3.2 | fiber `>=9.7.0`, postprocessing ^6.36 |
| postprocessing | 6.39.x | three `>=0.168 <0.187` (breaks on r187 until updated) |

Before upgrading React to 19.4, confirm a fiber release widens the `<19.4` cap. pmndrs postprocessing is WebGL-only; WebGPURenderer uses the node `RenderPipeline` (alias `PostProcessing`).

### WebGPU support (gpuweb wiki, 2026-10-02; MDN: "Limited availability", HTTPS only)

- Chrome/Edge: Windows, macOS, ChromeOS since 113; Android 12+ since 121 (Qualcomm, Intel; Imagination from 139 on Android 16+); Linux Intel Gen12+ 144, NVIDIA 147. Windows ARM64 behind a flag.
- Firefox: Windows since 141; macOS 145+/147 (re-check); Linux Nightly only; Android behind a pref.
- Safari 26 on macOS/iOS/iPadOS/visionOS 26; anything on 18.x or older has none.
- Consequence: the WebGL2 path plus a static poster is mandatory for every WebGPU scene.

### Budgets

| Metric | Mobile hero | Desktop | Source |
|---|---|---|---|
| Visible triangles | 50k-100k (100k ceiling) | 300k-1M | Scene Viewer: ≤ 100k, ideal 30-50k; desktop is heuristic |
| Draw calls | < ~100 | < ~300-500; ~1000 absolute max | R3F scaling docs: each mesh is a draw call, prefer a few hundred or fewer |
| Materials | ≤ 10 (≤ 2 with alpha) | — | Scene Viewer |
| Texture size | 1024-2048, KTX2 | 2048 (4096 for one hero texture only) | gltf-transform default `--texture-size 2048`; Scene Viewer ≤ 2048 |
| Compressed 3D payload | 2-5 MB | ≤ 10-15 MB | Heuristic; Scene Viewer warns at 10 MB; `asset-validation.mjs` default glb ≤ 5 MB |
| DPR | `[1, 1.5]` | ≤ 2 | Fill rate limits high-DPR phones before triangles |
| Frame rate | target 60 fps, simplify below 50 fps | same | impeccable overdrive |

Budget numbers marked heuristic need checking on a real low-end Android phone and an older iPhone; record them as defaults — adjust per product.

### glTF pipeline defaults (`@gltf-transform/cli` 4.5.1, verify at runtime: `npm view @gltf-transform/cli version`)

`optimize` defaults: `--compress meshopt` (`--meshopt-level high`), `--texture-compress auto` (recompress in original format), `--texture-size 2048`, plus simplify, weld, instance, flatten, join, palette, prune, sparse, resample.

| Choice | Pick when |
|---|---|
| Meshopt (default) | Almost always: tiny fast decoder, covers morph targets and animation, gzip/brotli on the wire |
| Draco | Dense static scans where smallest geometry wins; larger WASM decoder, slower decode, geometry only |
| KTX2 ETC1S | Albedo and flat-colour maps (small, lower quality); stays compressed in VRAM |
| KTX2 UASTC | Normal and ORM maps (larger, high quality) |
| WebP/AVIF | KTX-Software missing; cuts transfer size only, decodes to full RGBA in VRAM |

## Implementation

Detect the stack first. Samples below target Next.js App Router + React 19 + R3F 9; a vanilla three variant follows.

### Lazy-load the scene from a Client Component

```tsx
// app/_components/HeroScene.client.tsx
'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const Scene = dynamic(() => import('./Scene'), { ssr: false, loading: () => null });

function canWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

export default function HeroScene({ poster, alt }: { poster: string; alt: string }) {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(canWebGL2()), []);
  return (
    <div className="relative aspect-[16/9]">
      {/* Poster is the LCP candidate and the fallback; it stays until the first frame is drawn */}
      <img src={poster} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      {ok && <Scene label={alt} />}
    </div>
  );
}
```

`ssr: false` is rejected inside Server Components on Next 15+, so keep it in a `'use client'` file. Decorative backgrounds use a `null` loading fallback; content scenes use a skeleton.

### The scene: demand loop, Suspense, DPR cap, pause, context loss, reduced motion

```tsx
// app/_components/Scene.tsx
'use client';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF, PerformanceMonitor, Environment } from '@react-three/drei';
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

const prefersReduced = () => typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Lifecycle({ host, base }: { host: React.RefObject<HTMLDivElement | null>; base: 'always' | 'demand' }) {
  const { gl, setFrameloop, invalidate } = useThree();
  useEffect(() => {
    const el = host.current; if (!el) return;
    let onScreen = true;
    const apply = () => { setFrameloop(onScreen && !document.hidden ? base : 'never'); invalidate(); };
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; apply(); }, { rootMargin: '100px' });
    io.observe(el);
    document.addEventListener('visibilitychange', apply);
    const canvas = gl.domElement;
    const lost = () => { setFrameloop('never'); el.dataset.contextLost = 'true'; };
    const restored = () => { delete el.dataset.contextLost; apply(); };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', apply);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
  }, [gl, host, base, setFrameloop, invalidate]);
  return null;
}

function Model({ url }: { url: string }) {
  // drei: useGLTF(path, useDraco, useMeshopt, extendLoader). Pass a self-hosted Draco path
  // or false; the default Draco decoder path may point at a Google CDN (verify at runtime).
  const { scene } = useGLTF(url, false, true);
  return <primitive object={scene} dispose={null} />; // cached by useGLTF: do not dispose on unmount
}

class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; } // poster underneath stays visible
}

export default function Scene({ label }: { label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [dpr, setDpr] = useState(1.5);
  const reduced = prefersReduced();
  const base = reduced ? 'demand' : 'always';
  return (
    <div ref={host} className="absolute inset-0 data-[context-lost=true]:invisible">
      <CanvasBoundary>
        <Canvas
          role="img" aria-label={label}
          frameloop={base}
          dpr={[1, Math.min(dpr, 2)]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{ position: [0, 1, 4], fov: 35 }}
          onCreated={() => { if (host.current) host.current.dataset.ready = 'true'; }}
        >
          <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} />
          <Lifecycle host={host} base={base} />
          <Suspense fallback={null}>
            <Model url="/models/product.opt.glb" />
            <Environment files="/env/studio_1k.hdr" />
          </Suspense>
        </Canvas>
      </CanvasBoundary>
    </div>
  );
}
useGLTF.preload('/models/product.opt.glb');
```

Notes:
- The host hides itself on `data-context-lost` so the poster underneath shows (Tailwind v4 data variant; use the project's own CSS hook if it has no Tailwind). `data-ready` is set on renderer creation; for screenshot tests, set it after the model's first rendered frame instead.
- Under `"demand"`, imperative animations must call `invalidate()` each frame; drei controls do it for you.
- Animate with `useFrame((state, delta) => ...)` and mutate refs; never `setState` per frame.
- Instancing: repeated meshes (> ~20 copies, default — adjust) go through `<Instances>`/`InstancedMesh` — one draw call. Use drei `<Detailed distances={[0, 10, 25]}>` for LOD and `<Bvh>` for raycast-heavy scenes.
- Textures: `useTexture` for small sets; KTX2 via `extendLoader: (loader) => loader.setKTX2Loader(new KTX2Loader().setTranscoderPath('/basis/').detectSupport(gl))` (verify at runtime).
- Scroll-linked camera moves: drive a ref from the scroll owner in [motion-engineering](motion-engineering.md) (Lenis/GSAP), read it in `useFrame`, damp it; do not run a second scroll listener.

### Vanilla three (no React)

```ts
import * as THREE from 'three';

export function mountScene(host: HTMLElement, reduced: boolean) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, host.clientWidth / host.clientHeight, 0.1, 100);
  camera.position.set(0, 1, 4);
  const timer = new THREE.Timer(); timer.connect(document); // Timer replaced Clock (r183); verify import path
  const render = (t?: number) => {
    timer.update(t);
    const dt = Math.min(timer.getDelta(), 1 / 30); // clamp the first delta after a pause
    scene.rotation.y += reduced ? 0 : dt * 0.2;
    renderer.render(scene, camera);
  };
  let onScreen = true;
  const sync = () => renderer.setAnimationLoop(onScreen && !document.hidden && !reduced ? render : null);
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); });
  io.observe(host);
  document.addEventListener('visibilitychange', sync);
  const ro = new ResizeObserver(() => {
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); render();
  });
  ro.observe(host);
  renderer.domElement.addEventListener('webglcontextlost', () => { renderer.setAnimationLoop(null); host.dataset.contextLost = 'true'; });
  renderer.domElement.addEventListener('webglcontextrestored', () => { delete host.dataset.contextLost; sync(); render(); });
  reduced ? render() : sync();
  return () => {
    io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', sync);
    renderer.setAnimationLoop(null); timer.dispose?.();
    disposeObject3D(scene); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
  };
}

export function disposeObject3D(root: THREE.Object3D, keep: Set<object> = new Set()) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry && !keep.has(mesh.geometry)) mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const mat of mats) {
      if (keep.has(mat)) continue;
      for (const v of Object.values(mat)) {
        if (v instanceof THREE.Texture && !keep.has(v)) {
          if (typeof ImageBitmap !== 'undefined' && v.image instanceof ImageBitmap) v.image.close();
          v.dispose();
        }
      }
      mat.dispose();
    }
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && !keep.has((o as THREE.SkinnedMesh).skeleton)) (o as THREE.SkinnedMesh).skeleton.dispose();
  });
}
```

Call `forceContextLoss()` only when the canvas itself is torn down. Shared or cached assets go in `keep` (ref-count them). Disposed resources silently re-upload if reused (one-frame hitch); renderers and controls must be recreated.

### Loader wiring (vanilla)

```ts
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const loader = new GLTFLoader()
  .setMeshoptDecoder(MeshoptDecoder)
  .setKTX2Loader(new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer));
// Add setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/')) only for Draco assets.
```

### WebGPU (only when justified)

```ts
import { WebGPURenderer } from 'three/webgpu';
if (!('gpu' in navigator) || !(await navigator.gpu.requestAdapter())) { /* use the WebGL path */ }
const renderer = new WebGPURenderer({ antialias: true }); // auto-falls back to a WebGL2 backend
await renderer.init();                                     // or let setAnimationLoop init on frame 1
console.info('webgpu backend:', renderer.backend.isWebGPUBackend);
renderer.onDeviceLost = () => { /* stop loop, show poster, rebuild or stay static */ };
```

R3F 9: `gl={async (props) => { const r = new WebGPURenderer(props as any); await r.init(); return r; }}`; node materials used as JSX need `extend()` with the `three/webgpu` namespace (verify at runtime). With WebGPURenderer, `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile` and `EffectComposer` do not work: write shading in TSL ([shader-and-creative-coding](shader-and-creative-coding.md)). Test the fallback with `new WebGPURenderer({ forceWebGL: true })`.

### Asset pipeline commands

```bash
# Check status first: capability-registry / environment-audit (gltf-transform, KTX-Software `toktx`).
npx @gltf-transform/cli inspect in.glb
npx @gltf-transform/cli optimize in.glb out.desktop.glb --texture-compress ktx2 --texture-size 2048
npx @gltf-transform/cli optimize in.glb out.mobile.glb  --texture-compress ktx2 --texture-size 1024
# No KTX-Software: --texture-compress webp. Dense static scan: --compress draco (compare sizes).
npx @gltf-transform/cli validate out.mobile.glb && npx @gltf-transform/cli inspect out.mobile.glb
```

Serve `.glb` with brotli/gzip and long-lived immutable cache headers. Pick the variant at runtime (coarse pointer or narrow viewport → mobile). Register each GLB, poster and environment map in the asset manifest ([asset-generation](asset-generation.md)); generated 3D models need approval when the generator is paid.

### CSS-3D rung: drum/ring carousel

For a card ring that folds into a drum (monochrome-editorial-portfolio recipe 7): compose one transform per card from ring state (`rotateZ` + `translateY(-ringR)`) and drum state (`rotateX(step*d)` + `translateZ(drumR)`), mixed by `m ∈ [0,1]`; put `perspective` on the stage and `transform-style: preserve-3d` on the wheel; cull cards beyond ~1.6 steps from the front; lerp toward a target at 0.12 per frame (1 under reduced motion); trap the wheel event only while inside the range; snap 140 ms after the last wheel tick; arrow keys move ±1. Cards stay real DOM (links, text, focus). For the lens-carousel variant (recipe 8: two-pass OGL, SDF card masks, superellipse lens, pixel budget `dpr = min(devicePixelRatio, 2, sqrt(4.5e6 / (w*h)))`), the shader side lives in [shader-and-creative-coding](shader-and-creative-coding.md); its fallback is a CSS scroll-snap carousel below 768 px or without WebGL.

## Failure modes & fallbacks

| Symptom | Cause | Fix / fallback |
|---|---|---|
| Black or empty canvas | WebGL unavailable, shader compile error, asset 404, context lost | Error boundary + poster underneath; check console, network, `data-context-lost` |
| Page janks while canvas is off-screen | Loop never pauses | IntersectionObserver + `visibilitychange` → `frameloop="never"` / `setAnimationLoop(null)` |
| Mobile overheats / < 50 fps | DPR 3, too many draw calls, uncompressed textures | Cap DPR, merge/instance meshes, KTX2, mobile GLB, then static poster |
| Memory climbs per route change | Missing dispose, cached loader results | `disposeObject3D`, check `renderer.info.memory` baseline; clear `useGLTF.clear(url)` when truly done |
| Huge first delta after resume | Clock kept running while paused | Clamp delta (≤ 1/30 s), reset timer on resume |
| Peer-dependency errors | three r187 with postprocessing `<0.187`; model-viewer `^0.183` alongside 0.186 | Pin three 0.186.x; use model-viewer's all-in-one build |
| Page scroll hijacked | OrbitControls zoom on wheel | `enableZoom={false}` on scroll pages; explicit zoom buttons |
| Decoder fetched from a third-party CDN | drei/loader defaults | Self-host `/draco/`, `/basis/`; CSP review in [security-and-privacy](security-and-privacy.md) |
| WebGPU path fails on Firefox Android / Safari < 26 / Win ARM64 | No `navigator.gpu` or no adapter | WebGL2 backend (automatic in WebGPURenderer) → poster |

Fallback ladder, applied in order: (1) simplify (drop post-processing, shadows, particle count); (2) lower DPR to 1; (3) render one still frame or show the pre-rendered poster; (4) non-3D layout with the same content and controls in DOM. Steps 3-4 also serve reduced motion, no-WebGL, Save-Data and context loss.

## Verification

Feeds gates **E** (performance), **D** (accessibility), **F** (responsive), **G** (asset integrity), **H** (reliability: console errors, cleanup) and **C** (visual). Check the browser capability first ([capability-registry](capability-registry.md), ToolSearch for `mcp__Claude_Browser__*` or Chrome DevTools tools, or `scripts/visual-check.mjs`); if none is `available-verified`, mark the render checks NOT_TESTED with the reason.

1. **Build:** the project's build command passes with the 3D route included.
2. **Render:** wait for `[data-ready="true"]`, then screenshot. Freeze time for determinism: expose a `?still` (or test-only) flag that sets `frameloop="never"` after one frame at a fixed time, or step the clock to a fixed value before capture ([visual-testing](visual-testing.md)). Headless Chromium may use software GL (SwiftShader): valid for visuals, never for frame-rate claims.
3. **Budgets:** log `renderer.info.render.calls` and `.triangles` (`useThree(s => s.gl.info)`), and run `gltf-transform inspect` on shipped GLBs; compare with the budget table. Fail CI when the mobile budget is exceeded (default — adjust per product).
4. **Fallbacks:** test with WebGL disabled (or `getContext` stubbed to null) → poster/non-3D layout; call `gl.forceContextLoss()` then `forceContextRestore()` → poster then recovery; for WebGPU, run once with `forceWebGL: true`.
5. **Reduced motion:** `node <skill-dir>/scripts/visual-check.mjs --url <url> --reduced-motion` → no continuous motion, still frame present.
6. **Memory:** navigate away and back 3 times; `renderer.info.memory.geometries/textures` return to baseline (a few env/background textures may remain and are not leaks).
7. **Accessibility:** canvas has `aria-hidden` or `role="img"` + label; every 3D control has a keyboard DOM equivalent; no information exists only in the canvas; focus is visible ([accessibility](accessibility.md)).
8. **Performance:** LCP element is the poster or text, not the canvas; trace on a throttled mobile profile with Chrome DevTools `performance_start_trace` if verified; label lab results as lab ([performance](performance.md)).
9. **Animated assets:** before judging motion visually, extract facts with three (`AnimationMixer.setTime` per sampled frame, `Box3.setFromObject`): sample first, middle, contact, airborne and extreme frames; flag ground penetration > 1-2 cm, scale change > 5%, root heading jumps > 30°/frame (unless a snap turn); assume metres; glTF is Y-up. Never accept one camera angle as proof.
10. **Assets:** `node <skill-dir>/scripts/asset-validation.mjs --manifest <manifest>` passes for GLBs, posters and environment maps (Gate G).

## Sources

- impeccable — `reference/overdrive.md` (removal test, one extraordinary moment, 60/50 fps, progressive enhancement, propose 2-3 directions). Licence: none found locally; paraphrased.
- frontend-patterns and react-performance (ecc plugin skills) — code-splitting heavy 3D, `ssr:false` only in Client Components. Licence: see [LICENSES_AND_PROVENANCE](../LICENSES_AND_PROVENANCE.md); paraphrased.
- blender-motion-state-inspection (ecc) — structured 3D motion QA thresholds. remotion-video-creation (ecc, rules/3d.md) — deterministic, frame-driven 3D capture. Licences: see LICENSES_AND_PROVENANCE; paraphrased.
- monochrome-editorial-portfolio — `references/recipes.md` §7 (CSS-3D drum wheel) and §8 (OGL lens carousel); sibling style skill by the same owner: [SKILL](../../monochrome-editorial-portfolio/SKILL.md).
- three.js (MIT): releases https://github.com/mrdoob/three.js/releases; WebGPURenderer manual https://threejs.org/manual/pages/webgpurenderer.html; disposal https://threejs.org/manual/pages/how-to-dispose-of-objects.html; r186 builds on jsDelivr. Retrieved 2026-10-24.
- R3F scaling performance https://r3f.docs.pmnd.rs/advanced/scaling-performance; npm registry entries for @react-three/fiber, drei, postprocessing, react (MIT). Retrieved 2026-10-24.
- gpuweb Implementation Status https://github.com/gpuweb/gpuweb/wiki/Implementation-Status (edited 2026-10-02); MDN WebGPU API https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API. Retrieved 2026-10-24.
- glTF Transform (MIT) https://gltf-transform.dev/cli and `packages/cli/src/cli.ts`; meshoptimizer on npm. Retrieved 2026-10-24.
- Google Scene Viewer requirements https://developers.google.com/ar/develop/scene-viewer. Retrieved 2026-10-24.
- npm registry: ogl, @google/model-viewer (Apache-2.0), @splinetool/runtime, @splinetool/react-spline; sizes measured from jsDelivr with gzip -9 on 2026-10-24.
