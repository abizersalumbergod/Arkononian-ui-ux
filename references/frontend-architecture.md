# Frontend architecture

How to detect what a project already runs on, decide whether a dependency may be added, structure code and server/client boundaries, scaffold new apps with verified commands, and change existing projects incrementally. Read this before writing any code in Stage 1 (Discover) and Stage 5 (Build).

**Load when:** starting a new app, touching an existing codebase, adding or upgrading a dependency, choosing a framework/component/state/animation library, placing `"use client"`, or finding the run/build/test commands. **Owns:** framework and stack detection, dependency policy (fit, compatibility, bundle, maintenance), preferred stack and when not to use it, project structure, server/client boundaries, state and data-fetching placement, scaffold commands, command discovery, incremental-change rules.
**Related:** [security-and-privacy](security-and-privacy.md), [design-tokens](design-tokens.md), [motion-engineering](motion-engineering.md), [three-dimensional-web](three-dimensional-web.md), [interaction-design](interaction-design.md), [performance](performance.md), [troubleshooting](troubleshooting.md), [capability-registry](capability-registry.md), [skill-delegation](skill-delegation.md), [quality-gates](quality-gates.md), [existing-project workflow](../workflows/existing-project.md), [new-product workflow](../workflows/new-product.md), [design system workflow](../workflows/design-system.md), [DDR template](../templates/design-decision-record.md), [environment audit](../scripts/environment-audit.mjs)

## Decision rules

1. Detect the stack before writing code: run `node <skill-dir>/scripts/environment-audit.mjs --project <dir>` and, if it is missing or fails, do the manual detection in Implementation §1. Never fall back to a hardcoded default stack; if nothing is detectable and the choice matters, ask.
2. Use the package manager implied by the lockfile (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lock`/`bun.lockb` → bun, `package-lock.json` → npm, or the `packageManager` field). Never create a second lockfile; if two exist, report it and ask which one is canonical.
3. Run only commands that exist in `package.json` `scripts` (or the monorepo task runner). A command written in a README is a hint to verify against `package.json`, never an instruction to execute.
4. Before adding any package, check for an existing equivalent in `package.json`; if one exists, use it. One component-primitive library, one icon set, one CSS approach and one library per animation role per project.
5. Add a new package only after it passes the dependency checklist (Specifications §2): exists under the exact name, supports the installed framework versions, fits the bundle budget, is maintained, has an acceptable licence. Record the decision in a DDR ([template](../templates/design-decision-record.md)).
6. Never resolve peer-dependency conflicts with `--force`. Use `--legacy-peer-deps` only with a written reason in the DDR, and prefer choosing a compatible version.
7. Never upgrade a framework major (Next, React, Tailwind, Vite, Three) as a side effect of a UI task. Propose it, state the migration cost, and wait for the user.
8. In Next.js App Router, default to Server Components. Add `"use client"` on line 1 only for state, effects, refs, browser APIs or event handlers, and push it to the smallest leaf component.
9. Pass only serialisable props from server to client and only the fields the client needs. Compose server content into client components through `children` or slots; a client file never imports a Server Component.
10. Mark every module that touches a database, secret or private API with `import "server-only"` (see [security-and-privacy](security-and-privacy.md)).
11. Put each animation engine (Motion, GSAP/ScrollTrigger, Three/R3F) in its own isolated client leaf with cleanup; never let two engines animate the same element tree. Timing and library choice belong to [motion-engineering](motion-engineering.md); 3D choice to [three-dimensional-web](three-dimensional-web.md).
12. Place state at the lowest rung of the state ladder that works (Specifications §4). Never store a value that can be derived during render.
13. Do not fetch application data with `useEffect` + `fetch`. Use Server Components, a server-state cache (TanStack Query, SWR) or event-handler fetches; if an effect fetch is unavoidable, abort it in cleanup.
14. Pair every Suspense boundary with an error boundary above it, placed close to the data, with reserved space for the fallback.
15. In an existing project, edit source, never build output (`.next/`, `dist/`, `build/`, `out/`) or generated files (Implementation §6). Follow the project's file naming, import alias, lint and formatting rules; do not reformat untouched code.
16. Before creating a new component, list the existing components it overlaps and why they are insufficient (extend before create).
17. Scaffold only into an empty or new directory. Scaffolding over, or replacing, an existing project overwrites user work and needs explicit approval.
18. Treat version numbers in this file as dated research. Confirm with `npm view <pkg> version` (and `peerDependencies`) before pinning.

## Specifications

### 1. Detection matrix

| Aspect | Evidence to read | Decision it drives |
|---|---|---|
| Framework + version | `package.json` deps: `next`, `react`, `vue`, `nuxt`, `svelte`/`@sveltejs/kit`, `astro`, `@angular/core`, `solid-js`, `@remix-run/*`/`react-router`; non-JS manifests: `pubspec.yaml` (Flutter), `Package.swift`/`*.xcodeproj` (SwiftUI), `composer.json` (Laravel), `app.json` + `react-native` | Which code patterns are legal at all |
| Router | Next: `app/` or `src/app/` → App Router; `pages/` → Pages Router (both may coexist); Vite SPA: `react-router`/`@tanstack/react-router` | Where `"use client"`, layouts and data loading go |
| Rendering model | `next.config.*` `output: "export"` → static; `cacheComponents: true` → Cache Components; `astro.config.*` `output`; adapter packages; SPA if only `index.html` + Vite | Whether server code, cookies, proxies or nonces are possible |
| Package manager | Lockfile, `packageManager` field, `pnpm-workspace.yaml` | Install and run commands |
| Monorepo | `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `workspaces` in `package.json` | Run commands with a filter (`pnpm --filter <app> dev`) |
| Styling | `tailwindcss` version; v4 if CSS has `@import "tailwindcss"` and deps include `@tailwindcss/postcss` or `@tailwindcss/vite`; v3 if `tailwind.config.*` with `content`; CSS Modules (`*.module.css`), `styled-components`, `@emotion/*`, `vanilla-extract`, Sass | Token pipeline ([design-tokens](design-tokens.md)) |
| Component library | `components.json` (shadcn), `@base-ui/react`, `radix-ui` or `@radix-ui/react-*`, `react-aria-components`, `@mui/material`, `@mantine/core`, `@chakra-ui/react`, `@fluentui/react-components`, `@carbon/react` | Which primitives to compose; never mix two |
| Icons | `lucide-react`, `@phosphor-icons/react`, `@heroicons/react`, `@tabler/icons-react` | Reuse the existing set |
| State / data | `zustand`, `jotai`, `@reduxjs/toolkit`, `@tanstack/react-query`, `swr`, `react-hook-form`, `zod` | Specifications §4 and §5 |
| Animation | `motion` (`motion/react`), legacy `framer-motion`, `gsap` + `@gsap/react`, `lenis` (legacy `@studio-freight/lenis`) | [motion-engineering](motion-engineering.md) |
| 3D | `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` | [three-dimensional-web](three-dimensional-web.md) |
| Tests | `vitest`, `jest`, `@testing-library/*`, `@playwright/test`, `cypress`, `storybook` | Verification commands |
| Lint/types | `eslint.config.*`, `biome.json`, `tsconfig.json` (`strict`, `paths`) | Import alias, lint gate |
| Build/deploy | `vercel.json`, `netlify.toml`, `wrangler.toml`, `Dockerfile`, `.github/workflows/*` | Where headers/CSP live; never deploy without approval |

### 2. Dependency checklist (all must pass; record in the DDR)

| Check | How | Fail action |
|---|---|---|
| Existing equivalent | Search `package.json` and `src/` for a library doing the same job | Use the existing one |
| Package exists, exact name | `npm view <pkg> name version repository.url license` and compare with the official docs' install line | Stop; possible typo-squat or invented name ([security-and-privacy](security-and-privacy.md)) |
| Compatibility | `npm view <pkg> peerDependencies engines` vs installed React/Next/Node; RSC needs a client entry or `"use client"` wrapper | Choose another version or library |
| Bundle cost | Bundle analyzer of the project's bundler; budget from [performance](performance.md) | Lazy-load (`next/dynamic`, `import()`), or drop |
| Maintenance | `npm view <pkg> time.modified`; release in the last 12 months (default — adjust per product); open security advisories | Prefer a maintained alternative |
| Licence | `license` field; MIT/Apache/BSD/ISC fine; GPL, proprietary or "no charge" licences flagged to the user | Ask before adopting |
| Need | Can platform CSS/HTML do it (popover, `<dialog>`, container queries, View Transitions)? | Use the platform |

### 3. Preferred stack (dated research, retrieved 2026-10-24 — verify at runtime)

| Layer | Default for new React products | Version note |
|---|---|---|
| Framework | Next.js App Router, Turbopack (default for dev and build since 16.0; opt out with `--webpack`) | 16.4.x — verify at runtime (`npm view next version`) |
| Caching | Cache Components (`cacheComponents: true`, `"use cache"` + `cacheLife`/`cacheTag`); create-next-app enables it; planned default in Next 17 | 16.4 |
| UI runtime | React + React DOM; `<ViewTransition>` and Fragment refs stable in 19.3 | 19.3.x — verify at runtime (`npm view react version`) |
| Styling | Tailwind CSS v4, CSS-first `@import "tailwindcss"` + `@theme`; no `tailwind.config.js` | 4.3.x — verify at runtime (`npm view tailwindcss version`) |
| Components | shadcn CLI v4 (`npx shadcn@latest`), Base UI default for new projects (`@base-ui/react`); existing Radix projects keep Radix via the unified `radix-ui` package | shadcn 4.22.x, `@base-ui/react` 1.9.x, `radix-ui` 1.8.x — verify at runtime |
| UI motion | `motion`, imported from `motion/react` | 14.x — verify at runtime (`npm view motion version`); confirm the RSC client entry name |
| Scroll storytelling | GSAP + `@gsap/react` (`useGSAP`), ScrollTrigger | 3.15 — verify at runtime; licence is a proprietary no-charge licence, flag it |
| Smooth scroll | `lenis` (`lenis/react`), showcase pages only, off under reduced motion | 1.3.x — verify at runtime |
| 3D | `three` r18x, `@react-three/fiber` 9, `@react-three/drei` 10 | verify at runtime |
| Forms | `react-hook-form` + `zod` resolver, shadcn Form parts | verify at runtime |
| Tests | Vitest + Testing Library for units; Playwright for journeys | verify at runtime |

Stale names to replace when you meet them in skill text or snippets (not in the user's working code without approval): `framer-motion` imports → `motion/react`; `@studio-freight/lenis` → `lenis`; `@base-ui-components/react` → `@base-ui/react`; many `@radix-ui/react-*` → `radix-ui`; `shadcn-ui` command → `shadcn`; `tailwindcss-animate` and `tailwind.config.js`-first instructions → v4 CSS-first; GSAP Club/private-registry install steps → public `gsap`.

**When not to use the preferred stack:**

| Situation | Use instead |
|---|---|
| Project already runs another framework or a working Vite SPA | Keep it (precedence rule 2) |
| Mostly static content, little interactivity (docs, blog, editorial) | Astro with islands, or the existing SSG; React only for islands |
| Single portable file required (artifact, email preview, prototype) | Plain HTML/CSS/JS, or bundle a React app to one inlined HTML file; check the host's size limit |
| Brief names a real design system | Its official package, one system per project (table below) |
| Static hosting without a server | `output: "export"` or Vite; no Server Actions, proxies or per-request nonces |
| Native mobile/desktop manifest found | That platform's toolkit; this file's web rules do not apply |

Brief-to-official-system map (install the package, do not hand-recreate it): Microsoft/enterprise → Fluent UI v9; IBM-style analytics → Carbon; Shopify admin → Polaris web components; Atlassian-style → Atlaskit + tokens; GitHub-style dev tool → Primer; UK public sector → `govuk-frontend`; US public sector → `@uswds/uswds`; Google-style → Material Web (check maintenance status first); accessible React foundation → Radix Themes; owned SaaS components → shadcn/ui (never shipped in its default look). Aesthetics such as glass, bento or brutalism are not systems; build them with the project's CSS and tokens.

### 4. State ladder

| Who reads/writes | Put it in |
|---|---|
| One component | `useState` (`useReducer` once 3+ related values change together) |
| Parent + a few descendants | Lift to the nearest common ancestor |
| Distant branches, low-frequency (theme, locale, auth flag) | Context with a provider in a `"use client"` wrapper |
| Distant branches, high-frequency | External store (Zustand, Jotai, Redux Toolkit) |
| Server-derived | Server Component, or TanStack Query / SWR on the client |
| Shareable view state (filters, tab, page) | URL search params |

### 5. Data-fetching matrix

| Need | Use |
|---|---|
| Per-request data in App Router | `await` in a Server Component; wrap getters in `React.cache` for per-request dedupe |
| Cross-request static lookups | `"use cache"` with `cacheLife`/`cacheTag` (Next 16 Cache Components); never cache per-user data without the user key |
| Client cache with mutations, polling, optimistic updates | TanStack Query |
| Lightweight cache + revalidation | SWR |
| Real-time | SSE/WebSocket or the library's subscription API |
| Fire-and-forget | `fetch` in the event handler |
| Logging/analytics after response | `after()` |

### 6. Project structure (App Router default — mirror the existing layout if one exists)

```
src/
  app/                 routes, layout.tsx, page.tsx, loading.tsx, error.tsx, not-found.tsx, template.tsx
    (marketing)/       route groups per area
    api/               route handlers (server proxies)
  components/
    ui/                owned primitives (shadcn output)
    <feature>/         composed feature components; client leaves suffixed or co-located
  lib/
    server/            "server-only" data access, auth, secrets
    utils.ts           cn() and pure helpers
  styles/              tokens.css, theme.tailwind.css (from build-tokens)
  hooks/               client hooks
proxy.ts               Next 16 request proxy (was middleware.ts in ≤15; do not flag as misnamed)
```

Keep the z-index scale as named tokens in one file (sticky nav, overlay, modal, toast); no scattered arbitrary values.

## Implementation

### 1. Manual stack detection (when the audit script is unavailable)

```bash
# Lockfiles and manifests (POSIX shell; on Windows use the Glob tool or Git Bash)
ls package.json pnpm-lock.yaml yarn.lock package-lock.json bun.lock bun.lockb components.json \
   next.config.* vite.config.* astro.config.* tailwind.config.* tsconfig.json 2>/dev/null
# Versions of the libraries that change code patterns
node -e "const p=require('./package.json');const d={...p.dependencies,...p.devDependencies};for(const k of ['next','react','tailwindcss','motion','framer-motion','gsap','three','@react-three/fiber','@base-ui/react','radix-ui','vitest','@playwright/test'])if(d[k])console.log(k,d[k]);console.log('scripts',Object.keys(p.scripts||{}).join(', '));console.log('pm',p.packageManager||'(none)')"
# Installed (resolved) version, not the range
npm ls next react --depth=0
```

Then check `app/` vs `pages/`, `output` in `next.config.*`, and whether global CSS starts with `@import "tailwindcss"`. Record findings in the capability record of the final report.

### 2. Scaffold a new app (only into a new directory)

```bash
# Check the flags the installed CLI version accepts first
npx create-next-app@latest --help
npx create-next-app@latest my-app --ts --eslint --tailwind --app --src-dir --import-alias "@/*"
cd my-app && npx shadcn@latest init        # then: npx shadcn@latest add button dialog form
npm i motion                                # only if UI motion is in scope
npm run build                               # exit check: the empty app builds
```

Vite + React alternative: `npm create vite@latest my-app -- --template react-ts`, then `npm i tailwindcss @tailwindcss/vite` and add the plugin to `vite.config.ts`. Framework-agnostic: a static `index.html` + `styles.css` + `<script type="module">` is valid when the brief needs no build step.

Exit checks for every scaffold: the command exited 0; `npm run build` (or the project's build) exited 0; the dev server rendered the root route. Report each separately.

### 3. Server data + client leaf (Next.js App Router, React 19)

```ts
// src/lib/server/projects.ts
import "server-only";
import { cache } from "react";

export type ProjectImage = { src: string; alt: string; width: number; height: number };
export const getProject = cache(async (slug: string) => {
  const row = await db.project.findUnique({ where: { slug } }); // project's own data layer
  if (!row) return null;
  return { title: row.title, images: row.images as ProjectImage[] }; // project only needed fields
});
```

```tsx
// src/app/work/[slug]/page.tsx  (Server Component; params is a Promise in Next 15+)
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { getProject } from "@/lib/server/projects";
import { Gallery } from "@/components/work/gallery";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  return (
    <article>
      <h1>{project.title}</h1>
      <ErrorBoundary fallback={<p>Gallery unavailable.</p>}>
        <Suspense fallback={<div style={{ minHeight: 480 }} aria-busy="true" />}>
          <Gallery images={project.images} />
        </Suspense>
      </ErrorBoundary>
    </article>
  );
}
```

```tsx
// src/components/work/gallery.tsx  (client leaf: interaction + motion only)
"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { ProjectImage } from "@/lib/server/projects"; // type-only import is erased; safe

export function Gallery({ images }: { images: ProjectImage[] }) {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();
  const img = images[index];
  if (!img) return null;
  return (
    <figure>
      <motion.img key={img.src} src={img.src} alt={img.alt} width={img.width} height={img.height}
        initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.2 }} />
      <button type="button" onClick={() => setIndex((i) => (i + 1) % images.length)}>Next image</button>
    </figure>
  );
}
```

Notes: above-the-fold content must not wait for hydration to become visible (use `initial={false}` or CSS); branch on `matchMedia`, `hardwareConcurrency` or `window` only after mount; for client-only widgets (WebGL, audio, window-size UI) use `next/dynamic` with `ssr: false` inside a client file, or React 19.3 `use(browser())` (verify the API in the installed version). If `motion/react` fails in a Server Component context, import from the client entry the installed version documents.

### 4. Client provider wrapper

```tsx
// src/components/providers.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient()); // one client per browser session, not module scope on the server
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

Render `<Providers>` in `app/layout.tsx` around `{children}`; the layout stays a Server Component.

### 5. Framework-agnostic islands

Astro: render static HTML and hydrate only interactive parts (`<Gallery client:visible />`). Vanilla: ship semantic HTML that works without JS, then enhance with a module script that checks `matchMedia("(prefers-reduced-motion: reduce)")` and removes its listeners on `pagehide`. The boundary rule is the same everywhere: server/static by default, interactive leaf by exception.

### 6. Incremental changes in existing projects

1. Read `package.json`, the lockfile, router, styling entry, `components/ui`, tokens and one representative page before editing.
2. Treat a file as generated and do not edit it if `git check-ignore -q <file>` matches or its first ~300 characters contain `GENERATED`, `DO NOT EDIT` or `AUTO-GENERATED`; edit the generator or template instead.
3. Keep diffs scoped to the request; keep existing naming, alias (`@/`), lint and formatting; never rewrite a working page to a new pattern unasked.
4. Reuse existing tokens and components; new ones follow the extend-before-create table: related components, what they share, why insufficient, then props, variants, states, tokens and accessibility.
5. After each meaningful change run the project's typecheck/lint/build; fix what you broke before continuing.
6. Follow the [existing-project workflow](../workflows/existing-project.md) for the full sequence.

### 7. Command discovery

| Purpose | Look for (in order) |
|---|---|
| Dev | `scripts.dev`, `scripts.start` (CRA/Vite preview differs), `turbo run dev --filter` |
| Build | `scripts.build`; Next: `next build`; Vite: `vite build` |
| Typecheck | `scripts.typecheck`/`check`, else `npx tsc --noEmit` |
| Lint | `scripts.lint` (ESLint flat config or Biome) |
| Tests | `scripts.test`, `test:e2e`; Vitest `vitest run` (not watch mode) |

Run long-lived dev servers in the background and stop them at the end. Use the lockfile's manager: `pnpm run build`, `yarn build`, `bun run build`, `npm run build`.

## Failure modes & fallbacks

| Symptom | Cause | Fix |
|---|---|---|
| `window is not defined` / `document is not defined` during build | Browser API in a Server Component or at module scope | Move into a client leaf effect or `next/dynamic` `ssr: false` |
| Hydration mismatch | Render depends on time, random, locale or `matchMedia` | Compute after mount; `suppressHydrationWarning` only for timestamps |
| `server-only` import error in a client bundle | Client file imports server module | Pass data as props; move logic to a Server Action or route handler |
| "Functions cannot be passed to Client Components" | Non-serialisable prop | Pass data, or define the handler in the client leaf / a Server Action |
| Invalid hook call / two Reacts | Duplicate React (linked package, library not externalising peers) | `npm ls react`; dedupe; libraries must externalise `react`, `react-dom`, `react/jsx-runtime` |
| Tailwind classes missing after install | v3 config with v4 package or vice versa | Match detection §1; follow [design-tokens](design-tokens.md) |
| `ERESOLVE` peer conflict | Library not declaring the installed React/Next | Pick a compatible version; never `--force` |
| Turbopack plugin incompatibility | Webpack-only loader | Use `--webpack` for that command and record the reason |
| Exit animations do not run on route change | `AnimatePresence` around App Router children | Use View Transitions or enter-only animation in `template.tsx` ([motion-engineering](motion-engineering.md)) |
| Two lockfiles, inconsistent installs | Mixed package managers | Ask which is canonical; never delete one unasked |
| Audit script missing or Node unavailable | Package incomplete / runtime absent | Manual detection §1; record capability as `unavailable` |

For anything else see [troubleshooting](troubleshooting.md).

## Verification

Feeds **Gate B** (functional correctness: builds, runs, primary flows) and **Gate H** (reliability: no console errors, resources cleaned up); Gate A only when changing this skill package.

- Stack record: framework + resolved version, router, rendering model, package manager, styling, component library, state, animation, 3D, tests, deploy target — each with the file it came from.
- `<pm> run build` exits 0 (evidence: command + exit code). Separately: typecheck and lint exit 0, or record the pre-existing failures you did not introduce.
- Dev server starts and the changed routes render; console has no errors (browser tool or [visual-check](../scripts/visual-check.mjs)); otherwise mark render checks `NOT_TESTED` with the reason.
- `grep -rn '"use client"' src` shows client files only at leaves; no client file imports from `lib/server`.
- Every new dependency has a DDR entry with the checklist results.
- No changes under build output or generated files (`git status` shows only source paths).

## Sources

- design-taste-frontend (installed skill; licence: none found — paraphrased): animation-library separation, official design-system mapping idea, dependency check before import, z-index scale.
- impeccable (installed skill; licence: none found locally — paraphrased): foundation detection, build-output guard, generated-file header scan.
- ui-ux-pro-max (installed skill; see LICENSES_AND_PROVENANCE.md — paraphrased): manifest-based stack detection, no hardcoded default.
- ui-styling and design-system (installed skills; paraphrased): shadcn owned components on accessible primitives, Form parts with react-hook-form + zod, token lint.
- Anthropic design plugin skills design-handoff and design-system (paraphrased): extend-before-create gate, handoff contract.
- ECC skills (MIT): react-patterns, react-performance, frontend-patterns, ecc-rules-react, nextjs-turbopack, vite-patterns, motion-foundations, motion-patterns (auditor corrections applied), web-artifacts-builder, frontend-slides.
- Next.js blog and npm, retrieved 2026-10-24: https://nextjs.org/blog/next-16-4, https://nextjs.org/blog/next-16, https://www.npmjs.com/package/next
- React versions and 19.3 post, retrieved 2026-10-24: https://react.dev/versions, https://react.dev/blog/2026/09/09/react-19-3
- Tailwind CSS, shadcn changelog, npm (`shadcn`, `motion`, `lenis`, `gsap`), retrieved 2026-10-24: https://ui.shadcn.com/docs/changelog, https://ui.shadcn.com/docs/components-json, https://www.npmjs.com/package/shadcn, https://www.npmjs.com/package/lenis
