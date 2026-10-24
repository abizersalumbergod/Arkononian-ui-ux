# Video pipelines

How to plan, encode, embed, caption, generate and validate video for interfaces: hero and background loops, product demos and explainers. Encoding and embedding choices here decide LCP, data cost and whether autoplay works at all.

**Load when:** a page uses `<video>`, a background or hero loop, a product demo or screen recording, an explainer, social cut-downs, or a request to generate or edit video. **Owns:** codec and container choice, the encoding ladder, faststart, poster frames, video size budgets, background/hero/loop/demo patterns, WebVTT tracks for video, video generation prompt specs, ffmpeg-less fallbacks.
**Related:** [asset-generation](asset-generation.md), [image-pipelines](image-pipelines.md), [audio-pipelines](audio-pipelines.md), [motion-engineering](motion-engineering.md), [accessibility](accessibility.md), [performance](performance.md), [capability-registry](capability-registry.md), [skill-delegation](skill-delegation.md), [security-and-privacy](security-and-privacy.md), [asset-production workflow](../workflows/asset-production.md)

## Decision rules

1. Justify every video before producing it: name the job it does (show the product working, set mood in one hero, explain a state change). If a poster image or a CSS/canvas animation does that job, use that instead ([motion-engineering](motion-engineering.md)). Never add background video by default.
2. Check capabilities before any encode, probe or generation: read [capability-registry](capability-registry.md) or run `node ../scripts/environment-audit.mjs`. Treat `cli:ffmpeg` as unusable unless its status is `available-verified`. The Playwright-bundled ffmpeg is never a general ffmpeg.
3. Ship sources in this order: AV1 (MP4 or WebM), then VP9 WebM (optional), then H.264 MP4. Every `<source>` carries a `type` with a `codecs` string. H.264 MP4 is always present; never ship AV1, VP9 or HEVC as the only source.
4. Add HEVC only for alpha video on Apple devices or HDR, and only alongside an H.264 or VP9 fallback.
5. Strip audio (`-an`) from decorative video, and always set `muted playsinline` on anything that autoplays. Never autoplay video with sound.
6. Give every video a poster. If the video is above the fold, the poster is the LCP candidate: preload it with `fetchpriority="high"`, never lazy-load that video, and never add a poster only to game LCP.
7. Write MP4 with the `moov` atom before `mdat` (faststart). Verify it with the box-order check below; a file that fails it is not shippable for progressive playback.
8. Stay inside the size budgets in Specifications. If an encode exceeds the budget, shorten, lower resolution or raise CRF before shipping; never raise the budget silently.
9. If `prefers-reduced-motion: reduce`, Save-Data, or a slow connection (`effectiveType` `slow-2g`/`2g`/`3g` where the API exists) is detected, do not autoplay: show the poster and a play control.
10. Any moving video that starts automatically and lasts more than 5 s needs a visible, keyboard-operable pause control (WCAG 2.2.2). Pause off-screen and hidden-tab video.
11. If video carries speech or meaningful sound, ship a WebVTT captions track (WCAG 1.2.2) and a transcript; if it carries meaning without sound (demos), provide a text alternative that states what it shows (WCAG 1.2.1). Never rely on burned-in captions alone.
12. If `play()` rejects (`NotAllowedError`, iOS Low Power Mode, iframe without `allow="autoplay"`), fall back to the poster plus a play button. Never retry play in a loop.
13. Never flash more than three times in any one-second period (WCAG 2.3.1), including generated bloom/flash transitions.
14. Generation (Higgsfield or any other generator) is paid and sends prompts and references to a third party: get explicit approval with the model, duration, count and cost before each run. Never generate as a "test". Download outputs immediately (URLs expire) and validate them like any other asset.
15. Record every video in the asset manifest ([template](../templates/asset-manifest.json)) with source, licence, prompt (if generated), encodes, sizes, poster and fallback, then run [asset-validation](../scripts/asset-validation.mjs) (Gate G).
16. For frame-rendered video (Remotion, headless capture), derive every animated value from the frame number; never from CSS transitions, `requestAnimationFrame` time or self-running animations.
17. Re-encode for frame-accurate cuts. Stream copy (`-c copy`) snaps cuts to keyframes; use it only to concatenate segments that share identical codec parameters.
18. Keep faces and readable type inside every crop; force even pixel dimensions for H.264 `yuv420p`.

## Specifications

### Codec support (research r04, caniuse retrieved 2026-10-24; verify at runtime)

| Codec | Support | Use |
|---|---|---|
| H.264/AVC in MP4 | Universal baseline | Always ship as final fallback |
| AV1 | ~96% global; Chrome 70+, Edge 121+, Firefox 67+; Safari 17+ partial (needs AV1 hardware) | First source; `codecs` string lets non-AV1 Safari skip it |
| VP9 WebM | Chrome, Firefox, Edge full; Safari historically limited | Optional middle source |
| HEVC/H.265 | ~95% incl. partial; Safari full, Chrome 107+/Edge/Firefox 137+ partial (OS/hardware) | Only alpha-on-Apple or HDR, never alone |

Browsers play the first `<source>` they can decode, not the smallest. `canPlayType()` without a `codecs` parameter is not a reliable check.

Codec strings (defaults — adjust to the actual encode profile/level):

| File | `type` |
|---|---|
| AV1 MP4, Main 8-bit, level 4.0 | `video/mp4; codecs="av01.0.08M.08"` |
| AV1 WebM | `video/webm; codecs="av01.0.08M.08"` |
| VP9 WebM, profile 0, 8-bit | `video/webm; codecs="vp09.00.40.08"` |
| H.264 High, level 4.0 | `video/mp4; codecs="avc1.640028"` |

### Encoding ladder (defaults — adjust per product; check output size against the budget, not the CRF)

| Rung | Resolution | AV1 (libsvtav1) | VP9 (libvpx-vp9) | H.264 (libx264) |
|---|---|---|---|---|
| Hero desktop | 1920×1080 | CRF 34-38, preset 6 | CRF 32-36, `-b:v 0` | CRF 23-26, preset slow |
| Hero mobile / default | 1280×720 | CRF 34-38 | CRF 32-36 | CRF 24-27 |
| Small card loop | 640-960 wide | CRF 36-40 | CRF 34-38 | CRF 26-28 |

- Frame rate: keep source fps; 24 or 30 for loops (default); 60 only for UI demos where motion smoothness is the point.
- GOP: keyframe every 2-4 s (default) so seeking and loop restarts are quick.
- Pixel format `yuv420p`, even dimensions (`scale=W:-2`).
- Proxy for editing: `scale=960:-2`, x264 ultrafast, CRF 28 (video-editing).

### Size and duration budgets

| Asset | Budget | Basis |
|---|---|---|
| Any video file (validator default) | ≤ 6 MB | `asset-validation.mjs` default |
| Background/hero loop, per encode | ≤ 2.5 MB desktop, ≤ 1.2 MB mobile rung | default — adjust per product |
| Background loop duration | 6-15 s | default — adjust per product |
| Card/inline loop (GIF replacement) | ≤ 500 KB, 2-6 s | default — adjust per product |
| Poster image | follows image budgets | [image-pipelines](image-pipelines.md) |
| Product demo | split into ≤ 60 s chapters; `preload="none"` | default — adjust per product |

### Platform aspect ratios (video-editing, tasteforge-video)

| Ratio | Size | Note |
|---|---|---|
| 16:9 | 1920×1080 | default master |
| 9:16 | 1080×1920 | vertical crop `crop=ih*9/16:ih,scale=1080:1920`, subject-aware |
| 1:1 | 1080×1080 | feeds, cards |

### Product demo pacing (ui-demo)

Viewport and video 1280×720. Pauses: 4 s after login, 3 s after navigation, 2 s after a click, 1.5-2 s between steps, 3 s at the end. Typing 25-40 ms per character (default 35). Cursor moves in 10 steps, hovers 400 ms, clicks, then waits 800 ms. Smooth-scroll then wait 1.5 s. Step subtitles under 60 characters ("Step N - Action"), 0.3 s fade.

### Explainer structure (manim-video, remotion-video-creation)

- One-sentence visual thesis, 3-6 scenes, one claim per scene, storyboard before code; smoke render at low quality first.
- Overlapping transitions shorten the timeline: total = sum of scenes − sum of transitions (60 + 60 − 15 = 105 frames). Transitions 15-25 frames at 30 fps. Premount sequences 1 s (1 × fps) early.
- Beat-locked cuts: seconds per beat = 60 / BPM; frames per beat = fps × 60 / BPM; snap cuts to round(n × 60 / BPM × fps). At 138 BPM: 0.43478 s/beat, 13.04 frames at 30 fps (taste).
- Generate ~5 s takes and cut inside them rather than one call per sub-second shot (taste-application: 3 calls/13 s generated at 77% use vs 12 calls/48 s at 21%).

## Implementation

Detect the project's stack first ([frontend-architecture](frontend-architecture.md)). The patterns below are Next.js App Router + React 19; the vanilla variant works anywhere.

### Encode commands (only when `cli:ffmpeg` is `available-verified`)

```bash
# AV1 MP4 (no audio, faststart)
ffmpeg -i master.mov -an -vf "scale=1920:-2,fps=30" -c:v libsvtav1 -preset 6 -crf 36 -g 120 \
  -pix_fmt yuv420p -movflags +faststart hero-1080.av1.mp4
# VP9 WebM (optional)
ffmpeg -i master.mov -an -vf "scale=1920:-2,fps=30" -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 \
  -deadline good -cpu-used 2 -g 120 -pix_fmt yuv420p hero-1080.vp9.webm
# H.264 MP4 fallback
ffmpeg -i master.mov -an -vf "scale=1920:-2,fps=30" -c:v libx264 -preset slow -crf 24 \
  -profile:v high -level 4.0 -g 120 -pix_fmt yuv420p -movflags +faststart hero-1080.h264.mp4
# Poster from the first frame, then convert per image-pipelines (AVIF/WebP + JPEG)
ffmpeg -i hero-1080.h264.mp4 -frames:v 1 -q:v 2 hero-poster.jpg
# Frame-accurate trim (re-encode, never -c copy for cuts)
ffmpeg -ss 2.0 -i master.mov -t 8.0 -an -c:v libx264 -crf 18 -pix_fmt yuv420p trim.mp4
```

Use `-fps_mode vfr` instead of the deprecated `-vsync vfr`. Scene detection: `select='gt(scene,0.3)'`. Sanitize any label used in an output filename. Encoder names and flags drift between builds: run `ffmpeg -hide_banner -encoders` and check for `libsvtav1`, `libvpx-vp9`, `libx264` first; if missing, drop that rung.

### Seamless loops

- Make the last frame match the first: shoot or generate with a loop ending, or crossfade the final 0.5-1 s (default) into the opening frames before encoding.
- Avoid camera moves that cannot return to the start; prefer slow drift, parallax or ambient motion.
- Encode the loop as a closed GOP starting on a keyframe so the restart does not stutter.

### Faststart check without ffmpeg (Node ≥ 18)

```js
// node check-faststart.mjs file.mp4 -> exit 1 if mdat precedes moov
import { openSync, readSync, fstatSync, closeSync } from 'node:fs';
const fd = openSync(process.argv[2], 'r'); const size = fstatSync(fd).size;
const buf = Buffer.alloc(16); let pos = 0; const order = [];
try {
  while (pos + 8 <= size) {
    readSync(fd, buf, 0, 16, pos);
    let len = buf.readUInt32BE(0); const type = buf.toString('latin1', 4, 8);
    if (len === 1) len = Number(buf.readBigUInt64BE(8)); else if (len === 0) len = size - pos;
    if (len < 8) throw new Error(`corrupt box at ${pos}`);
    order.push(type); pos += len;
  }
} finally { closeSync(fd); }
const ok = order.indexOf('moov') !== -1 && order.indexOf('moov') < order.indexOf('mdat');
console.log(JSON.stringify({ order, faststart: ok }));
process.exit(ok ? 0 : 1);
```

### Hero/background video (React 19, client component)

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';

type Props = { av1: string; h264: string; poster: string; label: string };

export function BackgroundVideo({ av1, h264, poster, label }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [allowed, setAllowed] = useState(false);   // decided on the client only
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const conn = (navigator as any).connection;
    const slow = conn?.saveData || /(^|-)2g|3g/.test(conn?.effectiveType ?? '');
    setAllowed(!reduce.matches && !slow);
    const onChange = () => { if (reduce.matches) ref.current?.pause(); };
    reduce.addEventListener('change', onChange);
    return () => reduce.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const v = ref.current; if (!v || !allowed) return;
    const tryPlay = () => v.play().catch((e: DOMException) => {
      if (e.name === 'NotAllowedError' || e.name === 'NotSupportedError') setPlaying(false);
    });
    const io = new IntersectionObserver(([en]) => (en.isIntersecting ? tryPlay() : v.pause()),
      { threshold: 0.25 });
    const onVis = () => (document.hidden ? v.pause() : undefined);
    io.observe(v); document.addEventListener('visibilitychange', onVis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis); v.pause(); };
  }, [allowed]);

  return (
    <div className="relative">
      <video ref={ref} muted loop playsInline preload={allowed ? 'metadata' : 'none'}
        poster={poster} aria-hidden="true" disablePictureInPicture
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        className="h-full w-full object-cover">
        <source src={av1} type='video/mp4; codecs="av01.0.08M.08"' />
        <source src={h264} type='video/mp4; codecs="avc1.640028"' />
      </video>
      <button type="button" className="absolute bottom-4 right-4"
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        onClick={() => { const v = ref.current; if (!v) return;
          v.paused ? v.play().catch(() => setPlaying(false)) : v.pause(); }}>
        {playing ? 'Pause' : 'Play'}
      </button>
    </div>
  );
}
```

Notes: no `autoplay` attribute, so reduced-motion and slow-connection users never start playback; the observer starts it when allowed. A user's explicit Play overrides the reduced-motion default. Style the button through tokens and the focus rules in [interaction-design](interaction-design.md). Preload the poster in the document head when it is the LCP element:

```html
<link rel="preload" as="image" href="/media/hero-poster.avif" type="image/avif" fetchpriority="high">
```

### Vanilla / below-the-fold loop (GIF replacement)

```html
<video class="loop" muted loop playsinline preload="none" loading="lazy"
       poster="/media/card-poster.webp" aria-hidden="true">
  <source data-src="/media/card.av1.mp4" type='video/mp4; codecs="av01.0.08M.08"'>
  <source data-src="/media/card.h264.mp4" type='video/mp4; codecs="avc1.640028"'>
</video>
<script type="module">
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const io = new IntersectionObserver((entries) => {
    for (const { target: v, isIntersecting } of entries) {
      if (!isIntersecting) { v.pause(); continue; }
      if (!v.dataset.loaded) {
        v.querySelectorAll('source[data-src]').forEach((s) => (s.src = s.dataset.src));
        v.load(); v.dataset.loaded = '1';
      }
      if (!reduce) v.play().catch(() => {}); // poster stays visible on rejection
    }
  }, { rootMargin: '200px' });
  document.querySelectorAll('video.loop').forEach((v) => io.observe(v));
</script>
```

`loading="lazy"` on `<video>` shipped in Chrome 148 (May 2026); other browsers ignore it, so keep the observer (research r04). Loops of 2-6 s are under the 5 s threshold only if they stop; an infinite loop counts as moving content longer than 5 s, so add a pause control when it sits beside other content.

### Captions (WebVTT)

```html
<video controls preload="metadata" poster="/media/demo-poster.jpg">
  <source src="/media/demo.av1.mp4" type='video/mp4; codecs="av01.0.08M.08"'>
  <source src="/media/demo.h264.mp4" type='video/mp4; codecs="avc1.640028"'>
  <track kind="captions" src="/media/demo.en.vtt" srclang="en" label="English" default>
</video>
```

```text
WEBVTT

00:00:00.000 --> 00:00:03.200
Step 1 - Create a project

00:00:03.200 --> 00:00:06.000
Step 2 - Invite your team
```

Serve `.vtt` as `text/vtt`; cross-origin tracks need CORS and `crossorigin` on the video. Caption pages for word-highlighted burn-ins switch every ~1200 ms; a word is active when start ≤ t < end; clamp each page to the next page's start (remotion-video-creation). Transcription: local whisper.cpp or in-browser WASM whisper are free; a cloud API uploads audio to a third party and needs approval ([security-and-privacy](security-and-privacy.md)).

### Product demo recording (Playwright, when `available-verified`)

```js
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: 'out/video', size: { width: 1280, height: 720 } },
});
await context.addInitScript({ path: 'overlays.js' }); // cursor + subtitles survive navigation
const page = await context.newPage();
try { /* scripted steps with the pacing table above */ }
finally { await context.close(); } // the WebM (VP8) is written on close
const file = await page.video()?.path(); // copy to a stable name afterwards
```

The output is VP8 WebM. Converting to MP4/H.264 needs a full ffmpeg or the in-browser route below. For rendered explainers, delegate to `remotion-video-creation` or `manim-video` if installed ([skill-delegation](skill-delegation.md)).

### Video generation prompt spec

Write the prompt as these fields, then compose them into the generator's format. Store the final text in the manifest.

| Field | Content | Example |
|---|---|---|
| Purpose | Job on the page, placement, what sits on top | "hero background behind left-aligned headline" |
| Subject | One subject, materials, scale | "brushed-aluminium device on slate" |
| Composition | Framing, negative space for UI, safe zones | "subject in right third, left 45% calm for text" |
| Camera | Lens feel, height, one move | "50 mm, eye level, slow 10% dolly-in" |
| Motion | Speed and amount; nothing busy behind text | "slow light sweep, no fast motion, no flashes" |
| Light and palette | From the token palette ([visual-systems](visual-systems.md)) | "soft key from left, cool shadows" |
| Duration | Generator range (4-12 s typical per brief) | "8 s" |
| Aspect / size | Master ratio, then crops | "16:9 1920×1080; safe for 9:16 centre crop" |
| Loop / ending | Loop seamlessly, or end on a hold frame | "last frame matches first; static hold 1 s" |
| Exclusions | Text, logos, real people, brands, artefacts | "no text, no logos, no faces, no watermark" |
| Reference | Start image (if any) and its licence | "own render poster.png (approved for upload)" |

Process: 1) write the spec; 2) quote model, duration, count and cost (read-only balance/model listing); 3) wait for approval; 4) generate one take; 5) download, encode and validate; 6) iterate with one change per attempt.

## Failure modes & fallbacks

| Failure | Fallback |
|---|---|
| `cli:ffmpeg` unavailable (current registry status) | 1) Ask for files already encoded to the ladder; 2) in-browser encode on `http://localhost`: `MediaRecorder` or WebCodecs + Mediabunny (1.62.1 per r04 — verify at runtime: `npm view mediabunny version`); 3) `@ffmpeg/ffmpeg` (0.12.15 per r04, browser-only, ~2 GB input cap, slow — `npm view @ffmpeg/ffmpeg version`); 4) installing ffmpeg (winget or `ffmpeg-static`, which downloads GPL binaries) needs approval; 5) replace the video with a poster plus CSS/canvas motion. Record durations as NOT_TESTED. |
| Only Playwright's ffmpeg exists | Usable only for MJPEG/JPEG frames → VP8 WebM, PNG frame extraction, crop/scale/pad/trim (verified 2026-10-23). It cannot decode H.264/AV1/VP9, write MP4, encode audio or add faststart. |
| Autoplay rejected / iOS Low Power Mode | Poster + play button; `navigator.getAutoplayPolicy` is experimental and absent in Chrome 155 — feature-detect, rely on the `play()` promise. |
| iPhone goes fullscreen | Missing `playsinline`. |
| Video stalls before first frame | Missing faststart, or huge first GOP. Re-mux with `+faststart`; shorten GOP. |
| Safari plays nothing | AV1 source without `codecs`, or HEVC-only. Add typed sources and H.264. |
| Poster flashes then layout shifts | Reserve the box with `aspect-ratio` or width/height; see [performance](performance.md). |
| Generator: 0 credits / URL expired / artefacts (warped hands, text) | Do not retry silently; report, propose poster-only or a procedural loop ([shader-and-creative-coding](shader-and-creative-coding.md)). |
| Odd width with `yuv420p` | Use `scale=W:-2`. |

Generated video that depicts realistic people, places or events: label it as AI-generated where shown and keep machine-readable provenance (C2PA Content Credentials) when the tool provides it; EU AI Act Article 50 transparency duties apply from 2 August 2026 (research r04 — verify at runtime). Provenance fields live in [asset-generation](asset-generation.md).

## Verification

Feeds Gate G (asset integrity), Gate E (LCP/CLS), Gate D (captions, pause, flashes), Gate F (crops on the viewport matrix) and Gate H (no console errors from media). Report each separately ([quality-gates](quality-gates.md)).

- [ ] `node ../scripts/asset-validation.mjs --manifest <manifest>`: files exist, magic bytes match (mp4 ftyp / webm), size within budget, licence set, fallback set. Durations: ffprobe if verified, otherwise NOT_TESTED.
- [ ] Faststart check exits 0 for every MP4.
- [ ] Each `<source>` has `type` with `codecs`; H.264 present; order AV1 → VP9 → H.264.
- [ ] In the browser (via [visual-testing](visual-testing.md) tools if verified): `video.currentSrc` shows the expected rung; `play()` resolves or the poster + button appear; no console errors.
- [ ] Reduced motion: run `scripts/visual-check.mjs --reduced-motion`; video must not play.
- [ ] Pause control reachable by keyboard, has an accessible name, and works for every auto-playing video > 5 s.
- [ ] Captions track loads (`video.textTracks[0].cues.length > 0`) and text matches speech.
- [ ] LCP element is the poster (or not the video at all); no CLS from the video box.
- [ ] Network panel: below-fold videos do not download before scroll; Save-Data path downloads none.
- [ ] Crops keep faces and type inside frame at 375 and 1920 px.
- [ ] Flash check: no more than 3 flashes in any second (inspect bloom/flash transitions frame by frame).

If no browser tool is verified, mark the runtime checks NOT_TESTED with the reason.

## Sources

- Installed skills (licence: none found locally — ideas paraphrased, numbers credited): `video-editing` (ffmpeg recipes, corrected), `remotion-video-creation` (frame-deterministic animation, captions, transitions, media probing), `ui-demo` (demo pacing), `manim-video` (explainer planning), `taste` and `taste-application` (beat math, takes-not-shots, verification tolerances), `tasteforge-video` (face/type-safe reframing), all from the ECC plugin.
- Research r04 (media), retrieved 2026-10-23/24: https://caniuse.com/av1 ; https://caniuse.com/hevc ; https://developer.chrome.com/blog/autoplay ; https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay ; https://webkit.org/blog/6784/new-video-policies-for-ios/ ; https://developer.chrome.com/blog/new-in-chrome-148 ; https://web.dev/articles/lazy-loading-video ; https://web.dev/articles/replace-gifs-with-videos ; local probe of the Playwright ffmpeg build (2026-10-23).
- WCAG 2.2 success criteria 1.2.1, 1.2.2, 2.2.2, 2.3.1: https://www.w3.org/TR/WCAG22/ (retrieved 2026-10-24).
- EU AI Act Article 50 and C2PA: dates as stated in the research brief; verify at runtime before giving compliance advice.
