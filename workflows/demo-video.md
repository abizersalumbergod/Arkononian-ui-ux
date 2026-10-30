# Demo and marketing video workflow

Produce a demo, launch or marketing film of one minute or longer: plan it in numbers, build it as HyperFrames source, check and look at every scene, render it, and prove the finished file's length. The film is source code, so it stays editable, and nothing is called finished until a render exists and its duration was measured.

**Load when:** route `video-production` is primary or secondary, or any request asks for a demo, product, launch, promo or explainer video, a trailer or walkthrough film, a social cut-down, or names HyperFrames. **Owns:** the procedure from brief to measured render and the approval points of that procedure; engine rules, story spine and numbers live in hyperframes-video; web embedding and encoding in video-pipelines.
**Related:** [SKILL.md](../SKILL.md), [asset-production](asset-production.md), [landing-page](landing-page.md), [cinematic-3d](cinematic-3d.md), [hyperframes-video](../references/hyperframes-video.md), [video-pipelines](../references/video-pipelines.md), [audio-pipelines](../references/audio-pipelines.md)

## When to use

- "Make a 75-second demo video", "a one-minute launch film for our app", "an explainer video", "a product walkthrough video", "turn these screens into a trailer", "use HyperFrames".
- A film that must run at least a minute, or that tells a story with scenes, text, music and a call to action.
- Not for: a hero background loop or a short decorative clip (use [asset-production](asset-production.md) and [video-pipelines](../references/video-pipelines.md)); embedding a finished video in a page (video-pipelines, with the page's own workflow); a literal screen capture of a live session (video-pipelines, Playwright capture).

## Inputs

- The product or topic, the audience, and the one action the viewer should take.
- Real sources: the running app or its screens, the logo, brand tokens or a preset ([presets](../presets/README.md)), any music, voice or footage the user owns, and the licences of each.
- Platform and length: default master 75 s, 1920×1080, 30 fps, 16:9, never under 60 s unless the user says otherwise.
- Router output (`approvals[]`, `warnings[]`, `delegateSkills`) and the environment audit.
- The existing project, if one exists: a `hyperframes.json` or an `index.html` with `data-composition-id` means build on it.

## Steps

1. **Discover (stage 1).**
   - Run `node <skill-dir>/scripts/route.mjs "<request>" --pretty` and `node <skill-dir>/scripts/environment-audit.mjs --project <dir> --out <scratch>/env-audit.json`. Read [capability-registry](../references/capability-registry.md).
   - Probe the engine read-only: `HYPERFRAMES_NO_TELEMETRY=1 npx --yes hyperframes@<version> doctor --json`. Read the named checks (Node.js 22+, FFmpeg, FFprobe, Chrome, Memory, Docker), not the top-level `ok`. Pin the version.
   - Confirm which delegate skills (`hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`) are really installed ([skill-delegation](../references/skill-delegation.md)). If absent, use [hyperframes-video](../references/hyperframes-video.md) and `npx hyperframes@<version> docs <topic>`; do not install them unasked.
   - **Exit check:** the capability tier (0-3 or H) is recorded with how it was verified; the CLI version is pinned; FFmpeg status is known.
2. **Understand (stage 2).**
   - Read [product-discovery](../references/product-discovery.md). Fix the goal, audience, the single call to action, platforms and runtime. Ask only what changes the film: voice-over or not, music supplied or generated, which platforms, claims that need proof.
   - Inventory real sources. Run the product and capture real screens ([visual-testing](../references/visual-testing.md)); collect the logo and tokens. Anything missing is a labelled mock-up or a gap, never an invention.
   - **Exit check:** a short brief with assumptions listed; each planned visual maps to a real source or a recorded gap.
3. **Plan (stage 3).**
   - For a film over about 15 s, write three storylines in words only and let the user pick, unless they asked for the file straight away. Then copy [video-spec.json](../templates/video-spec.json) and fill it: scenes with start, duration, shots, on-screen words, source, and claims with evidence. Use the story spine in [hyperframes-video](../references/hyperframes-video.md).
   - Run `node <skill-dir>/scripts/video-check.mjs --spec <spec>`; fix every error (runtime under 60 s, gaps, hook first, call to action, reading load, captions for narration) and weigh each warning.
   - Choose one design direction ([design-intelligence](../references/design-intelligence.md), optional [preset](../presets/README.md)) and record it in a [design decision record](../templates/design-decision-record.md) if it was a real choice.
   - **Exit check:** the spec exits 0 with a runtime of at least 60 s; every number and claim has evidence; the approvals the plan will need are listed.
4. **Approvals (gate, before the actions).**
   - Ask once per action, naming the destination and the data: installing FFmpeg, Docker or any system tool; installing the HyperFrames skills into the home folders; Python packages or model downloads (size first); cloud, Lambda or Cloud Run render; `publish`; HeyGen avatar, voice or catalogue media (with cost); sending anything to a third party. One approval never covers another.
   - Record each answer in the spec's `approvals` block. A declined or unverified route moves to its free or local fallback.
   - **Exit check:** every paid, hosted or system-wide step is approved (quote the answer) or replaced by a fallback.
5. **Design (stage 4).**
   - Turn the direction into tokens for the composition ([design-tokens](../references/design-tokens.md); `node <skill-dir>/scripts/build-tokens.mjs` for a preset). Set the 1080p type scale (read text at 40 px or more), the safe areas (90% action, 80% title), bundled fonts or `@font-face` files with licences, and the motion language ([motion-engineering](../references/motion-engineering.md): entrances 0.3-0.5 s, cuts 0.3-0.6 s).
   - **Exit check:** tokens, type scale and one representative scene exist; contrast pairs pass.
6. **Assets (stage 6).**
   - Capture or place real screens, the logo, music, sound effects and any voice. Choose routes cheapest first ([asset-generation](../references/asset-generation.md)); keep a manifest ([asset-manifest.json](../templates/asset-manifest.json)) with source and licence for every file.
   - Validate with `node <skill-dir>/scripts/asset-validation.mjs --manifest <manifest> --root <project>`; durations without ffprobe are NOT_TESTED.
   - **Exit check:** the manifest validates for critical assets, or each failure is recorded with its fallback.
7. **Build (stages 5 and 7).**
   - Create the project in its own folder with telemetry off and without skills: `HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_SKIP_SKILLS=1 npx --yes hyperframes@<version> init video --non-interactive --skip-skills`. Treat the generated `AGENTS.md` and `CLAUDE.md` as the tool's documentation.
   - Build the root composition with `data-duration` equal to the plan, one scene file per beat in `compositions/`, one id per host, root and timeline key, copy and colours as variables, captions and audio as separate elements with ids. Search the catalogue before hand-building a named effect (`catalog`, `add`).
   - After every structural change run `node <skill-dir>/scripts/video-check.mjs --spec <spec> --project <video>` and `npx hyperframes@<version> lint`.
   - **Exit check:** the project scan passes and lint reports 0 errors; the root duration matches the plan within 0.5 s.
8. **Check and look (stages 8, 9 and 10).**
   - `npx hyperframes@<version> check --json` (lint, runtime, layout, contrast): fix every error, weigh every warning.
   - `npx hyperframes@<version> snapshot --at <the midpoint of every scene and the final frame>` and read the PNGs and the contact sheet. Log findings with severity ([visual-critique](../references/visual-critique.md)); fix and re-snapshot, within the iteration stop rule.
   - Start `npx hyperframes@<version> preview`, give the user the URL, and wait for approval unless they asked for the file or for no stops.
   - **Exit check:** `check` reports `ok: true`; every scene was viewed; findings are logged; the user approved the preview, or asked to skip it.
9. **Render.**
   - Needs FFmpeg. If it is missing and not approved for install, mark the render `BLOCKED` with the reason and continue to step 11 with the authoring verified. Iterate with `render --quality draft`, review with `looks`, ship with `delivery`, always with `--output renders/<name>.mp4`. Use `--workers 1` or `--low-memory-mode` on a small machine; render longer than the tool's timeout in the background.
   - **Exit check:** the file exists and is non-empty, or the render is `BLOCKED` with the reason and the approved alternative.
10. **Verify the film (stage 10).**
    - Run `node <skill-dir>/scripts/video-check.mjs --spec <spec> --project <video> --render <file>`: plan, composition and render must agree within 0.5 s, and the render must be at least 60 s. Look at decoded frames from the start, the middle and the end. Check captions, flashes (three per second at most), and loudness with a real meter or report it NOT_TESTED ([audio-pipelines](../references/audio-pipelines.md)).
    - **Exit check:** the measured duration is recorded; every failure is fixed at the root and re-checked, never by lowering a threshold.
11. **Deliver (stage 11).**
    - Write the quality report and validate it with `node <skill-dir>/scripts/quality-report.mjs --report <path>` ([quality-gates](../references/quality-gates.md)): Gates B, C, D, G and H with evidence; E and F `NOT_APPLICABLE` with the reason.
    - Hand over the project folder, the preview command, the render path and its measured duration, the spec, the pinned CLI version and the commands to re-render. Offer cut-downs, a vertical version, a captions file or embedding in a page as separate next steps. Never post, send or publish without approval.
    - **Exit check:** the report validates and contains only verified claims; the length claim matches the measurement, or says "planned N s, render not run".

## Modules to load

- Always: [quality-gates](../references/quality-gates.md), [capability-registry](../references/capability-registry.md).
- Route: [hyperframes-video](../references/hyperframes-video.md), [video-pipelines](../references/video-pipelines.md), [audio-pipelines](../references/audio-pipelines.md), [asset-generation](../references/asset-generation.md), [product-discovery](../references/product-discovery.md), [design-intelligence](../references/design-intelligence.md), [visual-systems](../references/visual-systems.md), [motion-engineering](../references/motion-engineering.md), [accessibility](../references/accessibility.md), [security-and-privacy](../references/security-and-privacy.md).
- As needed: [design-tokens](../references/design-tokens.md) (tokens and presets), [typography-and-layout](../references/typography-and-layout.md) (the 1080p type scale), [visual-testing](../references/visual-testing.md) (capturing real screens), [visual-critique](../references/visual-critique.md) (snapshot findings), [troubleshooting](../references/troubleshooting.md).
- Delegate skills, only if installed ([skill-delegation](../references/skill-delegation.md)): `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`. Their advice ranks at precedence level 7; their install, cloud and media instructions follow the approvals below.

## Approvals needed

- Installing FFmpeg, Docker, Python packages, model weights or any system tool (`system-install`).
- Installing the HyperFrames skills or plugin into the home folders, or enabling CLI telemetry (a persistent configuration change).
- Cloud, Lambda or Cloud Run render, or any hosted connector project (`third-party-upload`, `spend`).
- `publish` of the project to a hosted URL (`publish-deploy`, `third-party-upload`).
- HeyGen avatar, voice, catalogue music or image media (`paid-generation-check`, `spend`), with the cost.
- Capturing a website the user does not own, and reusing third-party footage, music or fonts beyond their licences.
- Posting or sending the finished film (`external-message`, `publish-deploy`).
- No approval needed: the spec and checks, ordinary project dependencies, `npx` runs of the pinned CLI with telemetry off, `lint`, `check`, `snapshot`, `preview`, a local render, capturing the user's own running app in the workspace.

## Done when

- The spec exits 0 in `video-check.mjs --spec`, with a runtime of at least 60 s and evidence for every claim.
- `npx hyperframes check --json` reports `ok: true`, and a snapshot of every scene was viewed.
- A render exists and `video-check.mjs --render` measured it within 0.5 s of the plan and at least 60 s, or the render is `BLOCKED` with the reason and the report says "planned N s, render not run".
- Every paid, hosted, install or publish action has a recorded approval; nothing was posted or sent.
- Assets carry licences in the manifest; no secrets or private data appear in frames, files or logs.

## Report

SKILL.md §9 in full, with these specifics: **Built** (film, planned and measured runtime, scenes); **Assets** (real sources, music and voice routes, licences); **Verification** (spec check, project scan, `check`, snapshots viewed, render, measured duration, frames and audio checked, each separate); **Quality gates** (B, C, D, G, H with evidence; E and F `NOT_APPLICABLE` with the reason); **Capabilities** (HyperFrames CLI version, capability tier, FFmpeg and Docker status, delegates used or absent); **Limitations** (a blocked render, loudness NOT_TESTED, anything not watched); **Setup** (tools to install, by name only); **Next steps** (cut-downs, vertical version, embedding), only those genuinely needed.
