# Audio pipelines

When interface sound is justified, how to deliver it (formats, loudness, loops, Web Audio unlock, user control) and how to generate or synthesise it. Sound is always optional enhancement: the interface must be complete and understandable with audio off.

**Load when:** a request mentions sound, audio, music, ambience, UI sounds, sonic branding, voice-over or text-to-speech, or a page embeds `<audio>` or Web Audio. **Owns:** audio formats and encodes, autoplay policy for audio, AudioContext unlock, mute/volume persistence, loudness and clipping checks, loops, procedural Web Audio fallback, sound and voice generation prompt specs.
**Related:** [video-pipelines](video-pipelines.md), [asset-generation](asset-generation.md), [accessibility](accessibility.md), [interaction-design](interaction-design.md), [motion-engineering](motion-engineering.md), [performance](performance.md), [capability-registry](capability-registry.md), [security-and-privacy](security-and-privacy.md), [asset-production workflow](../workflows/asset-production.md)

## Decision rules

1. Add sound only when it does a job: confirming an action the user cannot see, an immersive or game-like experience the user opted into, media playback, or brand storytelling the user starts. Productivity tools, dashboards, forms and checkout get no ambient or decorative sound by default.
2. Never autoplay audio of any kind, including ambience and "welcome" sounds. Sound starts only from an explicit user action on a sound control.
3. Default sound to off. Provide a visible sound toggle (and a volume control for ambience or music) reachable by keyboard, with an accessible name and pressed state.
4. Persist the user's choice (localStorage, try/catch). Even with sound saved as on, expect a fresh gesture after each full page load: show the toggle as "on, tap to resume" until the context is running.
5. Never let audio carry meaning alone. Every sound has a visual and text equivalent (state change, toast, `aria-live` message). Speech content has captions or a transcript (WCAG 1.2.1, 1.2.2).
6. Any audio that plays for more than 3 s needs pause/stop or independent volume control (WCAG 1.4.2); provide both for ambience.
7. Create or resume the AudioContext only inside an activation event handler (click, pointerup/touchend, keydown). Scroll, wheel, mousemove and hover never unlock audio.
8. Before playing any UI sound, check `ctx.state === 'running'`; otherwise skip silently. Never queue sounds for later.
9. Suspend audio when the tab is hidden; resume on return only if the user's preference is on.
10. Ship two encodes for ambience and music: Opus in WebM first, AAC-LC in `.m4a` as fallback. Never ship Opus alone (macOS Safari is still partial). Choose the file with `canPlayType` before fetching for Web Audio.
11. Do not use MP3 for seamless loops; loop decoded buffers with `AudioBufferSourceNode.loop`.
12. Measure loudness and peaks for every asset with a BS.1770 meter when one is `available-verified`; otherwise run the in-browser peak check below and mark loudness NOT_TESTED. Never ship a file whose sample peak reaches 0 dBFS.
13. Normalise a sound set together so UI sounds match each other; ambience sits well under any speech or video audio on the page.
14. If `prefers-reduced-motion: reduce` is set, keep sound off by default and remove non-essential decorative sounds even when the user enables sound (judgement: there is no standard reduced-audio media query). Offer an in-app "reduce sounds" setting when the product has more than a handful of sounds.
15. Treat sound, music and voice generation as paid and as a third-party upload of the prompt or script: get explicit approval (model, duration, count, cost) before each run. Never generate as a "test". Never clone or imitate a real person's voice without their documented consent.
16. If no approved generator or licensed library file exists, synthesise UI sounds procedurally with Web Audio, or omit sound. Never block a task on missing audio.
17. Record every audio asset in the [asset manifest](../templates/asset-manifest.json) with source, licence, prompt (if generated), encodes, loudness result and fallback; validate with [asset-validation](../scripts/asset-validation.mjs) (Gate G).

## Specifications

### Formats (MDN audio codec guide modified 2026-10-13; caniuse 2026-10-24; verify at runtime)

| Codec / container | Support | Min stereo bitrate @ 48 kHz | Latency | Use |
|---|---|---|---|---|
| Opus in WebM (or Ogg) | 97.26% incl. partial; full in Chrome 33+, Edge 14+, Firefox 15+, iOS Safari 18.4+; macOS Safari partial | 96 kbps | 5-66.5 ms | First source for ambience/music; UI sounds where supported |
| AAC-LC in MP4/M4A | All major browsers (Firefox via OS decoder; open-source Chromium lacks it) | 96 kbps | 20-405 ms | Universal fallback; the one format if shipping only one |
| MP3 | Everywhere | 128 kbps | ≥ 100 ms | Non-looping speech/podcast only |
| WAV (PCM) | Everywhere | n/a | n/a | Masters and tiny UI sounds during development only |

Encode targets (defaults — adjust per product): ambience/music Opus 96-128 kbps stereo 48 kHz and AAC ~128 kbps; speech Opus 48-64 kbps mono or AAC 64-96 kbps mono; UI sounds mono, 48 kHz.

### Budgets

| Asset | Budget | Basis |
|---|---|---|
| Any audio file | ≤ 1.5 MB | `asset-validation.mjs` default |
| Ambience loop | 30-90 s; at 96 kbps 60 s ≈ 720 KB | arithmetic; duration default — adjust per product |
| UI sound | ≤ 300 ms, ≤ 30 KB each, whole set ≤ 150 KB | duration from r04 note; sizes default — adjust per product |
| Fade-in on start / fade-out on stop | 1-2 s ambience; 5-20 ms UI de-click | r04 note; UI value default |
| Default ambience gain | GainNode 0.3-0.5 | r04 note (judgement) |

### Loudness (confidence: low unless marked; measured per ITU-R BS.1770)

| Content | Target | Basis |
|---|---|---|
| Dialogue / mixed web or podcast delivery | −16 LUFS integrated, true peak −1.5 dBTP, LRA 11 | video-editing (source default) |
| Streaming window | −16 to −20 LUFS, true peak ≤ −1 dBTP | AES TD1004 via secondary sources |
| Broadcast reference | −23 LUFS (EBU R128); −24 LKFS (ATSC A/85) | standards |
| Web ambience bed | about −30 to −24 LUFS integrated | judgement (r04), not a standard |
| UI sounds | match each other by momentary loudness, start near −30 to −24 LUFS momentary | judgement (r04) |
| Peak ceiling for lossy encodes at 96-128 kbps | true peak ≤ −2 dBTP (≤ −1 otherwise) | judgement (r04) |
| Sample-peak check without a meter | max \|sample\| < 0.89 (≈ −1 dBFS) | default — adjust per product |

Use two-pass loudnorm (measure, then apply) for finals; single-pass is approximate. Audition after export for unintended silence and clicks.

### UI sound character

Short, soft attack, no sharp transients above the rest of the set, no melody that repeats on every click. Map at most 4-6 distinct sound roles (default — adjust per product): confirm, error, notification, open/close, toggle. Frequent actions (typing, scrolling, hovering) get no sound.

## Implementation

Detect the project's stack first. The core is a framework-agnostic module; the React hook wraps it. Feature-detect everything.

### Sound manager (vanilla TypeScript, works in any framework)

```ts
// sound.ts
type Role = 'confirm' | 'error' | 'notify';
const KEY = 'ui-sound-enabled';
const files: Record<Role, { webm: string; m4a: string }> = {
  confirm: { webm: '/audio/confirm.webm', m4a: '/audio/confirm.m4a' },
  error:   { webm: '/audio/error.webm',   m4a: '/audio/error.m4a' },
  notify:  { webm: '/audio/notify.webm',  m4a: '/audio/notify.m4a' },
};
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<Role, AudioBuffer>();
const listeners = new Set<() => void>();

function read(): boolean { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } }
function write(v: boolean) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* private mode */ } }
let enabled = read();
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const pickExt = (): 'webm' | 'm4a' =>
  document.createElement('audio').canPlayType('audio/webm; codecs="opus"') ? 'webm' : 'm4a';

export function isEnabled() { return enabled; }
export function isRunning() { return ctx?.state === 'running'; }
export function subscribe(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => listeners.forEach((fn) => fn());

/** Call ONLY from a click/keydown/pointerup handler. */
export async function setEnabled(on: boolean) {
  enabled = on; write(on);
  if (on) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) { enabled = false; emit(); return; }
    ctx ??= new AC();
    if (!master) { master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination); }
    ctx.onstatechange = emit; // Safari may report 'interrupted'; verify at runtime
    try { await ctx.resume(); } catch { /* stays suspended; play() will skip */ }
    void preload();
  } else {
    await ctx?.suspend().catch(() => {});
  }
  emit();
}

async function preload() {
  if (!ctx) return;
  const ext = pickExt();
  await Promise.all((Object.keys(files) as Role[]).map(async (role) => {
    if (buffers.has(role)) return;
    try {
      const res = await fetch(files[role][ext]);
      if (!res.ok) return;
      buffers.set(role, await ctx!.decodeAudioData(await res.arrayBuffer()));
    } catch { /* missing or undecodable: role stays silent */ }
  }));
}

export function play(role: Role, { decorative = false } = {}) {
  if (!enabled || !ctx || !master || ctx.state !== 'running') return;
  if (decorative && reduced()) return;
  const buf = buffers.get(role); if (!buf) return;
  const src = ctx.createBufferSource(); src.buffer = buf;
  src.connect(master); src.start();
  src.onended = () => src.disconnect();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().catch(() => {});
    else if (enabled) void ctx.resume().catch(() => {}); // may stay suspended without a gesture
  });
}
```

`navigator.getAutoplayPolicy('audiocontext')` exists only in some browsers (absent in Chrome 155 per r04); if present, use it to decide whether to show "tap to resume". On iOS the hardware silent switch can mute Web Audio; `navigator.audioSession.type = 'playback'` changes that in Safari only — feature-detect it, set it only for media the user deliberately started, and test on a real device.

### React 19 toggle (client component)

```tsx
'use client';
import { useSyncExternalStore } from 'react';
import { subscribe, isEnabled, isRunning, setEnabled } from './sound';

export function SoundToggle() {
  const on = useSyncExternalStore(subscribe, isEnabled, () => false);
  const running = useSyncExternalStore(subscribe, isRunning, () => false);
  return (
    <button type="button" aria-pressed={on} onClick={() => void setEnabled(!on)}>
      {on ? (running ? 'Sound on' : 'Sound on, tap to resume') : 'Sound off'}
    </button>
  );
}
```

Place the toggle in a consistent, findable spot (header or settings) per [interaction-design](interaction-design.md). Call `play('confirm')` next to, never instead of, the visual feedback.

### Ambience loop with fade and volume

```ts
let amb: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
export function startAmbience(ctx: AudioContext, buf: AudioBuffer, volume = 0.4) {
  stopAmbience(ctx);
  const gain = ctx.createGain(); gain.gain.value = 0;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  // optional: src.loopStart / src.loopEnd to skip a non-looping intro/tail
  src.connect(gain).connect(ctx.destination); src.start();
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.5);
  amb = { src, gain };
}
export function stopAmbience(ctx: AudioContext) {
  if (!amb) return;
  const { src, gain } = amb; amb = null;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0, t + 1);
  src.stop(t + 1.05); src.onended = () => { src.disconnect(); gain.disconnect(); };
}
```

Bind a volume slider to `gain.gain.setTargetAtTime(v, ctx.currentTime, 0.05)` to avoid zipper noise. Loop preparation: cut at zero crossings, crossfade the tail into the head before export, and check there is no click at the seam.

### Plain `<audio>` for user-started media

```html
<audio controls preload="none">
  <source src="/audio/episode.webm" type='audio/webm; codecs="opus"'>
  <source src="/audio/episode.m4a" type='audio/mp4; codecs="mp4a.40.2"'>
  <a href="/audio/episode.m4a">Download the episode</a>
</audio>
<a href="/audio/episode-transcript">Transcript</a>
```

Never set `autoplay`. Pause other page media when this starts.

### Procedural fallback (no files, no generator)

```ts
/** Short, soft confirmation blip. ctx must be running. */
export function blip(ctx: AudioContext, freq = 660, dur = 0.12) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);   // 10 ms attack, no click
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur); // exponential tail
  osc.connect(g).connect(ctx.destination);
  osc.start(t); osc.stop(t + dur + 0.02);
  osc.onended = () => { osc.disconnect(); g.disconnect(); };
}
/** Soft noise bed: filtered white noise, loop-safe because it is generated. */
export function noiseBed(ctx: AudioContext, seconds = 4) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.25;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
  return { buf, filter: lp }; // feed buf to startAmbience via the filter
}
```

Frequencies, gains and filter values are defaults — adjust per product; tune by ear on laptop speakers and a phone at 50% volume.

### Peak and RMS check in the browser (when no loudness meter exists)

```ts
export async function measure(url: string) {
  const res = await fetch(url); if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ctx = new OfflineAudioContext(1, 1, 48000);
  const buf = await ctx.decodeAudioData(await res.arrayBuffer());
  let peak = 0, sum = 0, n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; n++; }
  }
  const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-9));
  return { duration: buf.duration, peakDbfs: db(peak), rmsDbfs: db(Math.sqrt(sum / n)), clipped: peak >= 0.999 };
}
```

This is sample peak and unweighted RMS, not LUFS or true peak; report loudness as NOT_TESTED when only this check ran.

### Commands when a full ffmpeg is `available-verified`

```bash
# measure (first pass), then apply with the measured_* values (second pass)
ffmpeg -i in.wav -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null -
ffmpeg -i in.wav -af loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=<..>:measured_TP=<..>:measured_LRA=<..>:measured_thresh=<..>:offset=<..> -ar 48000 out.wav
ffmpeg -i out.wav -c:a libopus -b:a 96k amb.webm
ffmpeg -i out.wav -c:a aac -b:a 128k -movflags +faststart amb.m4a
ffmpeg -i in.wav -af silencedetect=noise=-30dB:d=2 -f null -   # dead-air check
```

Swap the loudnorm targets per the table above. Check `ffmpeg -encoders` for `libopus` and `aac` first.

### Sound and voice generation prompt spec

| Field | Content | Example |
|---|---|---|
| Role | Where and when it plays, who starts it | "confirm sound after saving a document" |
| Type | UI sound, ambience loop, music bed, stinger, voice-over | "UI sound" |
| Duration | Exact length; loop length for beds | "180 ms" / "60 s seamless loop" |
| Character | Mood, timbre, instrumentation, dynamics | "soft wooden tap, warm, no reverb tail" |
| Tempo / key | BPM and key for music, so cuts and motion can snap to beats ([video-pipelines](video-pipelines.md)) | "84 BPM, D minor" |
| Envelope | Attack and ending; loop seam rules | "soft attack, ends at silence" / "tail matches head" |
| Technical | Sample rate, channels, peak, no vocals | "48 kHz mono, peaks below −3 dBFS, no vocals" |
| Exclusions | Recognisable melodies, brand jingles, real voices | "no melody quotes, no speech" |
| Voice (TTS) | Script, language, pace, voice ID with consent; starting stability 0.5, similarity boost 0.75 (ElevenLabs example, model ids drift) | "calm, 150 wpm" |
| Licence | Commercial use terms of the generator or library | "generator terms allow commercial use (checked)" |

Process: check the generator's status in [capability-registry](capability-registry.md) (Higgsfield audio is `unknown` there; confirm with a read-only model listing filtered to audio), quote the cost, get approval, generate one item, then check the HTTP status and content type before writing the response to a file so an error payload is never saved as audio. Read API keys from environment variables on the server only ([security-and-privacy](security-and-privacy.md)). Synthetic speech that imitates a real person needs disclosure under EU AI Act Article 50 from 2 August 2026 (research r04 — verify at runtime); provenance fields are owned by [asset-generation](asset-generation.md).

## Failure modes & fallbacks

| Failure | Fallback |
|---|---|
| Context stays `suspended` | It was created or resumed outside an activation handler. Resume inside the toggle's click handler; show "tap to resume". |
| No sound on iPhone | Silent switch or Low Power Mode; test on device; `audioSession` only for user-started media. |
| AAC fails in test browser | Open-source Chromium lacks AAC; test with branded Chrome (Playwright channel `chrome`) or Opus. |
| `decodeAudioData` rejects | Wrong format for this browser; pick by `canPlayType`; keep the role silent and log once. |
| Audible gap at loop seam | MP3 padding or `<audio loop>`; use a buffer loop with a crossfaded seam. |
| Clicks on start/stop | Add 5-20 ms gain ramps; never set gain abruptly. |
| No meter / ffmpeg unavailable (current registry status for `cli:ffmpeg`; Playwright's ffmpeg has no audio encoders or loudness filters) | Use pre-mastered files, run the peak check, mark loudness NOT_TESTED; installing ffmpeg needs approval. |
| Generator unavailable, unknown status or 0 credits | Licensed library sound with recorded licence, procedural Web Audio, or no sound. |
| Sound fires during rapid repeat actions | Throttle per role (default 80 ms minimum gap — adjust per product). |

## Verification

Feeds Gate D (accessibility: no autoplay, controls, text equivalents), Gate G (asset integrity) and Gate H (no console errors, contexts and nodes cleaned up). See [quality-gates](quality-gates.md).

- [ ] Load the page with sound preference on and off: nothing plays until the toggle is activated (check `ctx.state` and that no `AudioContext` is created on load).
- [ ] Toggle is keyboard-operable, has `aria-pressed`, and its state survives a reload.
- [ ] Every sound has a visible/text equivalent; the full journey works with the device muted.
- [ ] Ambience: pause/stop and volume control exist (WCAG 1.4.2); fade-in and fade-out audible without clicks; suspends on hidden tab.
- [ ] Reduced motion: decorative sounds do not play.
- [ ] Each asset: Opus + AAC encodes present, magic bytes valid, within budget, licence recorded, via `node ../scripts/asset-validation.mjs --manifest <manifest>`.
- [ ] Loudness measured with a BS.1770 meter (record tool and values) or marked NOT_TESTED with the peak/RMS result attached; no clipping.
- [ ] Loop seam auditioned on headphones and a phone speaker.
- [ ] Cross-browser playback recorded per browser actually tested; untested browsers listed as NOT_TESTED.

## Sources

- Installed skills (licence: none found locally — ideas paraphrased, numbers credited): `video-editing` (loudnorm targets, silencedetect), `fal-ai-media` (voice settings starting values, response checks), from the ECC plugin.
- Research r04 (media), retrieved 2026-10-23/24: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay ; https://developer.chrome.com/blog/autoplay ; https://w3c.github.io/audio-session/ ; https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs ; https://caniuse.com/opus ; https://productionadvice.co.uk/td1008/ ; https://www.grimmaudio.com/news/aes-td1008-ends-the-loudness-war/ ; https://www.production-expert.com/production-expert-1/aes-update-loudness-recommendations-for-audio-only-streaming ; https://docs.telosalliance.com/docs/understanding-loudness-for-streaming-audio (loudness findings are low confidence).
- Standards: ITU-R BS.1770; EBU R128; ATSC A/85; WCAG 2.2 SC 1.2.1, 1.2.2, 1.4.2 (https://www.w3.org/TR/WCAG22/, retrieved 2026-10-24).
- EU AI Act Article 50 date as stated in the research brief; verify before giving compliance advice.
