# Licences and provenance

## This package

The original text, scripts, schemas and data in `ultimate-uiux` were written for this project. No licence has been declared yet. Add one (for example MIT) before publishing or sharing the skill.

## Policy for third-party material

1. **MIT / Apache-2.0 sources:** techniques may be adapted, with attribution below.
2. **Sources with no licence found:** ideas and facts only, paraphrased in our own words, with no passage longer than 15 consecutive words. Where possible the installed skill is invoked at runtime instead (see `references/skill-delegation.md`).
3. **Standards and documentation** (W3C, MDN, web.dev, vendor docs): facts cited with URLs and retrieval dates; no text reproduced.
4. **Generated assets** in projects built with this skill must record their generator, prompt reference and licence in the asset manifest (`templates/asset-manifest.json`).

## Audited sources

| Source | Licence found | Use in this package |
|---|---|---|
| design-taste-frontend (upstream name: tasteskill / taste-skill) | None found. No license key in frontmatter and no LICENSE fi… | Techniques adapted |
| impeccable SKILL.md (router + general rules) | none found locally (see provenance) | Techniques adapted |
| reference/brand.md | none found locally | Techniques adapted |
| reference/product.md | none found locally | Techniques paraphrased |
| reference/craft.md | none found locally | Techniques adapted |
| reference/shape.md | none found locally | Techniques adapted |
| reference/init.md | none found locally | Techniques adapted |
| reference/codex.md | none found locally | Techniques adapted |
| reference/critique.md | none found locally | Techniques adapted |
| reference/audit.md | none found locally | Techniques adapted |
| reference/polish.md | none found locally | Techniques paraphrased |
| reference/typeset.md | none found locally | Techniques paraphrased |
| reference/colorize.md | none found locally | Techniques adapted |
| reference/layout.md | none found locally | Techniques paraphrased |
| reference/animate.md | none found locally | Techniques paraphrased |
| reference/interaction-design.md | none found locally | Techniques paraphrased |
| reference/adapt.md | none found locally | Techniques adapted |
| reference/harden.md | none found locally | Techniques paraphrased |
| reference/clarify.md | none found locally | Techniques paraphrased |
| reference/onboard.md | none found locally | Techniques adapted |
| reference/delight.md | none found locally | Delegated at runtime |
| reference/bolder.md | none found locally | Delegated at runtime |
| reference/quieter.md | none found locally | Delegated at runtime |
| reference/distill.md | none found locally | Delegated at runtime |
| reference/overdrive.md | none found locally | Techniques adapted |
| reference/optimize.md | none found locally | Techniques adapted |
| reference/document.md | none found locally | Techniques adapted |
| reference/extract.md | none found locally | Techniques paraphrased |
| reference/live.md | none found locally | Delegated at runtime |
| agents/impeccable_asset_producer.toml | none found locally | Techniques adapted |
| agents/impeccable_manual_edit_applier.toml | none found locally | Delegated at runtime |
| agents/openai.yaml | none found locally | Not used |
| scripts/context.mjs | none found locally | Not used |
| scripts/context-signals.mjs | none found locally | Techniques adapted |
| scripts/critique-storage.mjs | none found locally | Techniques adapted |
| scripts/palette.mjs | none found locally | Techniques adapted |
| scripts/detect.mjs + scripts/detector/** (anti-pattern detector) | Apache-2.0 per SPDX headers in detect-antipatterns.mjs and … | Delegated at runtime |
| detector/engines/visual/screenshot-contrast.mjs | Apache-2.0 (detector package SPDX, unconfirmed per-file) | Techniques adapted |
| scripts/detect-csp.mjs | none found locally | Delegated at runtime |
| scripts/pin.mjs + scripts/command-metadata.json | none found locally | Not used |
| live-mode scripts (live.mjs, live-server.mjs, live-poll.mjs, live-inj… | none found locally; modern-screenshot.umd.js is vendored th… | Delegated at runtime |
| scripts/live-copy-edit-agent.mjs + scripts/live-commit-manual-edits.m… | none found locally | Not used |
| scripts/lib (design-parser.mjs, is-generated.mjs, impeccable-paths.mj… | none found locally | Techniques adapted |
| frontend-design (Anthropic official plugin) | Apache-2.0 (frontmatter points to LICENSE.txt in skill dir;… | Techniques paraphrased |
| frontend-design-direction (ECC) | No license in frontmatter (metadata.origin: community); cov… | Techniques paraphrased |
| taste (ECC) | No license in frontmatter (origin: ECC); covered by ECC roo… | Techniques adapted |
| taste-application (ECC) | MIT (scripts/LICENSE, (c) 2026 Affaan Mustafa; pyproject pa… | Delegated at runtime |
| taste-distillation (ECC) | No LICENSE file in the skill dir and no frontmatter license… | Delegated at runtime |
| make-interfaces-feel-better (ECC) | No license in frontmatter (metadata.origin: community); cov… | Techniques paraphrased |
| liquid-glass-design (ECC) | No frontmatter license and no origin metadata; covered by E… | Delegated at runtime |
| inherit-legacy-style (ECC) | No frontmatter license (metadata.origin: community; allowed… | Techniques adapted |
| product-lens (ECC) | No frontmatter license (metadata.origin: ECC); covered by E… | Techniques adapted |
| emil-design-eng | none found (no frontmatter license, no LICENSE file). Prove… | Techniques adapted |
| transitions-dev | none found (no frontmatter license, no LICENSE file in the … | Delegated at runtime |
| ecc:motion-foundations | MIT (ECC plugin LICENSE at C:/Users/abize/.claude/plugins/c… | Techniques adapted |
| ecc:motion-patterns | MIT (ECC plugin LICENSE, Copyright 2026 Affaan Mustafa). Fr… | Techniques adapted |
| ecc:motion-advanced | MIT (ECC plugin LICENSE, Copyright 2026 Affaan Mustafa). Fr… | Techniques adapted |
| ui-ux-pro-max (local, data-backed) | none found (no frontmatter license, no LICENSE file; data-p… | Delegated at runtime |
| ui-ux-pro-max (Anthropic-synced single-file variant) | none found | Not used |
| ui-styling | conflict: frontmatter MIT (author claudekit) vs LICENSE.txt… | Techniques adapted |
| design-system | MIT (frontmatter only, author claudekit; no LICENSE file) | Techniques adapted |
| design | MIT (frontmatter only, author claudekit; no LICENSE file) | Delegated at runtime |
| brand | none declared (no frontmatter license, no LICENSE file; aut… | Techniques adapted |
| design-critique (Anthropic design plugin) | No LICENSE file in the design plugin dir. plugin.json autho… | Techniques adapted |
| accessibility-review (Anthropic design plugin) | Same as the design plugin: no LICENSE file found; Anthropic… | Techniques adapted |
| design-handoff (Anthropic design plugin) | Same as the design plugin (no LICENSE file; Anthropic; like… | Techniques paraphrased |
| design-system (Anthropic design plugin) | Same as the design plugin (no LICENSE file; Anthropic; like… | Techniques paraphrased |
| ux-copy (Anthropic design plugin) | Same as the design plugin (no LICENSE file; Anthropic; like… | Techniques paraphrased |
| user-research (Anthropic design plugin) | Same as the design plugin (no LICENSE file; Anthropic; like… | Delegated at runtime |
| research-synthesis (Anthropic design plugin) | Same as the design plugin (no LICENSE file; Anthropic; like… | Delegated at runtime |
| design-system (ECC plugin 2.2.3) | MIT (ECC plugin LICENSE, Copyright 2026 Affaan Mustafa); sk… | Techniques adapted |
| dashboard-builder (ECC plugin 2.2.3) | MIT (ECC plugin LICENSE); metadata says 'ECC direct-port ad… | Techniques adapted |
| banner-design (claudekit) | MIT (frontmatter); author claudekit, v1.0.0 | Techniques adapted |
| slides (claudekit) | None found (no frontmatter license, no LICENSE file); autho… | Techniques adapted |
| frontend-slides (ECC plugin 2.2.3) | MIT (ECC plugin LICENSE); credits zarazhangrui's frontend-s… | Techniques adapted |
| notion-design (local, auto-generated by 'skillui') | None found. The content reverse-engineers notion.com's bran… | Not used |
| frontend-patterns | No license in frontmatter (metadata.origin: ECC). Covered b… | Techniques adapted |
| react-patterns | No license in frontmatter (metadata.origin: ECC). Covered b… | Techniques paraphrased |
| ecc-rules-react (supporting files for react-patterns / react-performa… | ECC plugin root LICENSE: MIT, Copyright 2026 Affaan Mustafa. | Techniques paraphrased |
| react-performance | No license in frontmatter (metadata.origin: ECC); ECC root … | Techniques paraphrased |
| nextjs-turbopack | No license in frontmatter (metadata.origin: ECC); ECC root … | Delegated at runtime |
| vite-patterns | No license in frontmatter (metadata.origin: ECC); ECC root … | Techniques adapted |
| seo | No license in frontmatter (metadata.origin: ECC); ECC root … | Techniques adapted |
| web-artifacts-builder | Apache License 2.0 (LICENSE.txt, 'Copyright 2026 Anthropic,… | Delegated at runtime |
| frontend-a11y | MIT (ECC plugin LICENSE, Copyright 2026 Affaan Mustafa); fr… | Techniques adapted |
| accessibility (ECC) | MIT (ECC plugin LICENSE); metadata.origin: ECC | Techniques adapted |
| browser-qa | MIT (ECC plugin LICENSE); metadata.origin: ECC | Techniques paraphrased |
| e2e-testing | MIT (ECC plugin LICENSE); metadata.origin: ECC | Techniques adapted |
| verification-loop | MIT (frontmatter license: MIT, plus ECC LICENSE) | Techniques adapted |
| click-path-audit | MIT (ECC plugin LICENSE); metadata.origin: community | Techniques paraphrased |
| gan-style-harness (+ agents/gan-evaluator.md, commands/gan-design.md) | MIT (ECC plugin LICENSE); metadata.origin: ECC-community | Delegated at runtime |
| eval-harness | MIT (ECC plugin LICENSE); metadata.origin: ECC | Techniques adapted |
| ui-demo | MIT (ECC plugin LICENSE); metadata.origin: ECC | Delegated at runtime |
| skill-creator (official marketplace plugin) | Apache-2.0 (LICENSE.txt in skill dir and LICENSE at plugin … | Techniques paraphrased |
| skill-creator (synced Anthropic copy) | Apache-2.0 (LICENSE.txt alongside) | Techniques paraphrased |
| fal-ai-media | MIT (ECC plugin LICENSE, Affaan Mustafa 2026); frontmatter … | Techniques adapted |
| manim-video | MIT (ECC plugin LICENSE); frontmatter origin: ECC. Manim Co… | Delegated at runtime |
| remotion-video-creation | MIT via ECC plugin LICENSE (no license/origin in frontmatte… | Delegated at runtime |
| blender-motion-state-inspection | MIT (ECC plugin LICENSE); frontmatter origin: ECC | Techniques adapted |
| tasteforge-video | MIT (ECC plugin LICENSE; the referenced engine at skills/ta… | Techniques adapted |
| video-editing | MIT (ECC plugin LICENSE); frontmatter origin: ECC. Fusion b… | Techniques adapted |
| ios-icon-gen | MIT via ECC plugin LICENSE, but frontmatter says origin: co… | Delegated at runtime |
| canvas-design | Apache-2.0 (LICENSE.txt in the skill folder; frontmatter: '… | Delegated at runtime |
| cinematic-noir-studio (skill) | none found (no license in frontmatter and no LICENSE file).… | Delegated at runtime |
| monochrome-editorial-portfolio (skill) | none found (no license in frontmatter and no LICENSE file).… | Delegated at runtime |
| ECHO-WEBSITE flex-carousel.js + FlexCarousel.css (WebGL liquid-lens c… | No license header. The project README shows an MIT badge, b… | Techniques adapted |
| ECHO-WEBSITE works-wheel.js (CSS-3D ring to drum wheel) | No license header. Calls itself a vanilla port of a 'WorksW… | Techniques adapted |
| ECHO-WEBSITE scroll-expand-media.js (About room) | No license header. A vanilla port of a ScrollExpandMedia Re… | Techniques adapted |
| ECHO-WEBSITE experience-section.js (sticky horizontal camera) | No license header. Original code that depends on @fiddle-di… | Techniques adapted |
| ECHO-Design-Studio Hero.tsx (scrubbed wordmark morph + curtain) | none (the project README says no license file exists). User… | Techniques paraphrased |
| ECHO-Design-Studio SmoothScrollProvider.tsx (Lenis + GSAP shared cloc… | none (project has no license file) | Techniques adapted |
| ECHO-Design-Studio ui/Reveal.tsx + ui/SplitText.tsx | none (project has no license file) | Techniques adapted |
| ECHO-Design-Studio ui/Odometer.tsx | none | Techniques adapted |
| ECHO-Design-Studio ui/Marquee.tsx | none | Techniques adapted |
| ECHO-Design-Studio ui/SpotlightReveal.tsx (+ CustomCursor.tsx) | none | Techniques adapted |
| ECHO-Design-Studio ui/StaggeredMenu.tsx + StaggeredMenu.css | Header credits React Bits StaggeredMenu, ported to TypeScri… | Techniques adapted |
| ECHO-Design-Studio ui/skiper10.tsx (stairs preloader) | Skiper UI component, upstream license unknown. This project… | Not used |
| ECHO-Design-Studio ui/skiper52.tsx (expand-on-hover process cards) | Skiper UI component, upstream license unknown. This project… | Techniques adapted |
| ECHO-Design-Studio ui/ArrowButton.tsx + ui/SectionLabel.tsx | none | Techniques adapted |
| ECHO-Design-Studio app/globals.css | none | Techniques paraphrased |
| ECHO-Design-Studio tailwind.config.ts | none. Its own comment says the tokens were 'extracted verba… | Techniques adapted |

## Attribution

- **ECC plugin skills** © 2026 Affaan Mustafa, MIT License: motion, accessibility, browser QA, frontend patterns, performance, taste and dashboard techniques were adapted and paraphrased.
- **skill-creator** (Anthropic), Apache License 2.0: skill format and evaluation methodology informed the package structure and evals.
- **ui-styling, design, design-system, banner-design** (MIT per frontmatter): token and styling techniques were paraphrased.
- **ECHO Design Studio / ECHO Website** reference projects and the derived `cinematic-noir-studio` and `monochrome-editorial-portfolio` skills: techniques learned and rewritten. No brand assets, copy or images are included.

## Libraries and assets referenced (not bundled)

- Fonts in `presets/` are Google Fonts (SIL Open Font License or Apache 2.0) or system fonts.
- Libraries recommended by modules keep their own licences. Most are MIT (React, Next.js, Tailwind CSS, motion, Lenis, three.js, React Three Fiber, drei, TanStack). axe-core is MPL-2.0. GSAP 3.13+ is free for commercial use under its own no-charge licence (read its terms before use). Verify each licence at install time.

## External documentation consulted

- <https://api.webstatus.dev/v1/features?q=id%3Aview-transitions%20OR%20id%3Across-document-view-transitions%20OR%20id%3Ascroll-driven-animations%20OR%20id%3Astarting-style%20OR%20id%3Aanchor-positioning%20OR%20id%3Acontainer-queries%20OR%20id%3Apopover>
- <https://bugs.webkit.org/show_bug.cgi?id=216887>
- <https://c2pa.org/the-c2pa-launches-content-credentials-2-3-and-celebrates-5-years-of-impact-across-the-digital-ecosystem/>
- <https://c2pa.org/wp-content/uploads/sites/33/2026/07/Content-Credentials-Deployment-Guidance.pdf>
- <https://caniuse.com/av1>
- <https://caniuse.com/avif>
- <https://caniuse.com/hevc>
- <https://caniuse.com/jpegxl>
- <https://caniuse.com/opus>
- <https://cdn.jsdelivr.net/npm/@react-three/fiber@9.8.2/dist/declarations/src/core/configuration.d.ts>
- <https://cdn.jsdelivr.net/npm/@react-three/fiber@9.8.2/dist/declarations/src/core/store.d.ts>
- <https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js>
- <https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.webgpu.js>
- <https://developer.chrome.com/blog/autoplay>
- <https://developer.chrome.com/blog/lighthouse-13-0>
- <https://developer.chrome.com/blog/new-in-chrome-148>
- <https://developer.chrome.com/docs/lighthouse/accessibility/scoring>
- <https://developer.chrome.com/docs/lighthouse/performance/performance-scoring>
- <https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API>
- <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors>
- <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast>
- <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>
- <https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay>
- <https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs>
- <https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types>
- <https://developers.google.com/ar/develop/scene-viewer>
- <https://docs.telosalliance.com/docs/understanding-loudness-for-streaming-audio>
- <https://echarts.apache.org/handbook/en/best-practices/aria/>
- <https://github.com/ChromeDevTools/chrome-devtools-mcp>
- <https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md>
- <https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md>
- <https://github.com/darkroomengineering/lenis>
- <https://github.com/dequelabs/axe-core>
- <https://github.com/dequelabs/axe-core/blob/develop/doc/API.md>
- <https://github.com/gpuweb/gpuweb/wiki/Implementation-Status>
- <https://github.com/motiondivision/motion/blob/main/CHANGELOG.md>
- <https://github.com/mrdoob/three.js/releases>
- <https://github.com/recharts/recharts/discussions/4484>
- <https://github.com/recharts/recharts/wiki/3.0-migration-guide>
- <https://gltf-transform.dev/cli>
- <https://gsap.com/standard-license>
- <https://nextjs.org/blog>
- <https://nextjs.org/blog/next-16>
- <https://nextjs.org/blog/next-16-4>
- <https://nextjs.org/docs/app/api-reference/components/image>
- <https://opensource.contentauthenticity.org/docs/durable-cr/>
- <https://playwright.dev/docs/accessibility-testing>
- <https://playwright.dev/docs/api/class-page#page-emulate-media>
- <https://playwright.dev/docs/api/class-pageassertions>
- <https://playwright.dev/docs/docker>
- <https://playwright.dev/docs/release-notes>
- <https://playwright.dev/docs/test-cli>
- <https://playwright.dev/docs/test-snapshots>
- <https://productionadvice.co.uk/td1008/>
- <https://r3f.docs.pmnd.rs/advanced/scaling-performance>
- <https://raw.githubusercontent.com/donmccurdy/glTF-Transform/main/packages/cli/src/cli.ts>
- <https://react.dev/blog/2026/09/09/react-19-3>
- <https://react.dev/versions>
- <https://registry.npmjs.org/@axe-core/playwright/latest>
- <https://registry.npmjs.org/@gltf-transform/cli>
- <https://registry.npmjs.org/@google/model-viewer>
- <https://registry.npmjs.org/@lhci/cli/latest>
- <https://registry.npmjs.org/@react-three/drei>
- <https://registry.npmjs.org/@react-three/fiber>
- <https://registry.npmjs.org/@react-three/postprocessing>
- <https://registry.npmjs.org/@splinetool/react-spline>
- <https://registry.npmjs.org/@splinetool/runtime>
- <https://registry.npmjs.org/@tanstack/react-table/latest>
- <https://registry.npmjs.org/@tanstack/react-virtual/latest>
- <https://registry.npmjs.org/axe-core/latest>
- <https://registry.npmjs.org/chrome-devtools-mcp/latest>
- <https://registry.npmjs.org/echarts/latest>
- <https://registry.npmjs.org/lighthouse/latest>
- <https://registry.npmjs.org/meshoptimizer>
- <https://registry.npmjs.org/next>
- <https://registry.npmjs.org/ogl>
- <https://registry.npmjs.org/postprocessing>
- <https://registry.npmjs.org/recharts/latest>
- <https://registry.npmjs.org/sharp>
- <https://registry.npmjs.org/three/latest>
- <https://sharp.pixelplumbing.com/>
- <https://sharp.pixelplumbing.com/api-output>
- <https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html>
- <https://tailwindcss.com/blog>
- <https://tailwindcss.com/blog/tailwindcss-v4-3>
- <https://tailwindcss.com/docs/theme>
- <https://tailwindcss.com/docs/upgrade-guide>
- <https://tanstack.com/blog/announcing-tanstack-table-v9>
- <https://tanstack.com/virtual/latest/docs/introduction>
- <https://threejs.org/manual/pages/how-to-dispose-of-objects.html>
- <https://threejs.org/manual/pages/webgpurenderer.html>
- <https://ui.shadcn.com/docs/changelog>
- <https://ui.shadcn.com/docs/components-json>
- <https://w3c.github.io/audio-session/>
- <https://web-platform-dx.github.io/web-features-explorer/features/anchor-positioning/>
- <https://web.dev/articles/cls>
- <https://web.dev/articles/fetch-priority>
- <https://web.dev/articles/inp>
- <https://web.dev/articles/lab-and-field-data-differences>
- <https://web.dev/articles/lazy-loading-video>
- <https://web.dev/articles/lcp>
- <https://web.dev/articles/replace-gifs-with-videos>
- <https://web.dev/articles/vitals>
- <https://web.dev/blog/crux-experimental-soft-navs/>
- <https://web.dev/blog/lcp-and-inp-are-now-baseline-newly-available>
- <https://webflow.com/blog/gsap-becomes-free>
- <https://webkit.org/blog/6784/new-video-policies-for-ios/>
- <https://webstatus.dev/features/container-queries>
- <https://webstatus.dev/features/cross-document-view-transitions>
- <https://webstatus.dev/features/popover>
- <https://webstatus.dev/features/scroll-driven-animations>
- <https://webstatus.dev/features/starting-style>
- <https://webstatus.dev/features/view-transitions>
- <https://www.deque.com/blog/en-301-549-v4-1-1-is-final-what-changed-what-it-means-and-what-you-should-do/>
- <https://www.dwt.com/insights/2026/09/european-accessibility-act-ict-standards-update>
- <https://www.grimmaudio.com/news/aes-td1008-ends-the-loudness-war/>
- <https://www.jdsupra.com/legalnews/doj-extends-title-ii-ada-web-2176958/>
- <https://www.mondaq.com/unitedstates/media-entertainment-law/1782220/doj-extends-ada-title-ii-digital-accessibility-deadlines-by-one-year>
- <https://www.nngroup.com/articles/complex-application-design/>
- <https://www.nngroup.com/articles/dashboards-preattentive/>
- <https://www.nngroup.com/articles/data-tables/>
- <https://www.npmjs.com/package/@base-ui-components/react>
- <https://www.npmjs.com/package/@base-ui/react>
- <https://www.npmjs.com/package/@gsap/react>
- <https://www.npmjs.com/package/@studio-freight/lenis>
- <https://www.npmjs.com/package/cn>
- <https://www.npmjs.com/package/framer-motion>
- <https://www.npmjs.com/package/gsap>
- <https://www.npmjs.com/package/lenis>
- <https://www.npmjs.com/package/motion>
- <https://www.npmjs.com/package/next>
- <https://www.npmjs.com/package/radix-ui>
- <https://www.npmjs.com/package/react>
- <https://www.npmjs.com/package/shadcn>
- <https://www.production-expert.com/production-expert-1/aes-update-loudness-recommendations-for-audio-only-streaming>
- <https://www.w3.org/TR/WCAG22/>
- <https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/>
- <https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html>
- <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>
- <https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html>
- <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html>
- <https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html>
- <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- <https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/>
- <https://www.w3.org/WAI/standards-guidelines/wcag/wcag3-intro/>
- <https://www.w3.org/WAI/test-evaluate/tools/selecting/>
- <local: %LOCALAPPDATA%/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe -version/-encoders/-decoders/-muxers/-demuxers/-filters (run 2026-10-23)>
- <skill://dataviz (built-in; SKILL.md + references/color-formula.md, choosing-a-form.md, marks-and-anatomy.md, interaction.md, anti-patterns.md, palette.md, components.md; scripts/validate_palette.js read, not run)>
