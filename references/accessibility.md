# Accessibility (WCAG 2.2 AA)

Single source of truth for WCAG 2.2 Level AA checks, accessible component patterns and the Gate D procedure. Use it to build accessible UI by default and to prove, honestly, how far accessibility was verified.

**Load when:** any UI build, redesign, audit, form, dialog, chart, media, motion or 3D/canvas work; any request mentioning accessibility, a11y, WCAG, screen reader, keyboard or contrast. **Owns:** WCAG 2.2 AA criteria and thresholds, keyboard model, focus visibility, accessible names, ARIA usage, accessible form/error/dialog/live-region semantics, contrast ratios, target size floor, motion and media accessibility requirements, 3D/canvas/chart alternatives, automated vs manual a11y testing, Gate D procedure.
**Related:** [interaction-design](interaction-design.md), [motion-engineering](motion-engineering.md), [visual-systems](visual-systems.md), [design-tokens](design-tokens.md), [responsive-design](responsive-design.md), [dashboard-engineering](dashboard-engineering.md), [three-dimensional-web](three-dimensional-web.md), [video-pipelines](video-pipelines.md), [visual-testing](visual-testing.md), [quality-gates](quality-gates.md), [skill-delegation](skill-delegation.md), [capability-registry](capability-registry.md)

## Decision rules

1. Target WCAG 2.2 Level AA (W3C Recommendation, dated version 2024-12-12) for every UI. Never gate on WCAG 3 or APCA; WCAG 2 ratios are the pass/fail line.
2. Use the native element first (`button`, `a href`, `input`, `select`, `dialog`, `nav`, `main`, `table`). Add ARIA only when no native element expresses the role, and then implement the full WAI-ARIA APG pattern (roles, states, keyboard).
3. If an element navigates, make it a link; if it acts, make it a button. Never put `onClick` on a `div`/`span`.
4. Give every interactive element an accessible name that contains its visible label (SC 2.5.3). Icon-only buttons get `aria-label`; decorative images get `alt=""`; decorative icons get `aria-hidden="true"`.
5. Never remove a focus indicator. Style `:focus-visible` with `outline` + `outline-offset` (not `outline: none` + `box-shadow`), with at least 3:1 contrast against adjacent colours.
6. If the page has any sticky or fixed bar, set `scroll-padding-top`/`scroll-padding-bottom` to its height so a focused element is never entirely hidden (SC 2.4.11).
7. Text contrast: 4.5:1 normal, 3:1 large (≥ 24 px regular or ≥ 18.66 px bold). UI component boundaries, focus indicators, meaningful icons and chart marks: 3:1. Check every theme and every state separately; test gradients and images at the worst point.
8. Every pointer target contains a 24 × 24 CSS px square or meets the SC 2.5.8 spacing exception. Default primary touch targets to 44 × 44 px (default — adjust per product; 48 px on Android-style UIs).
9. Every drag interaction (sortable list, slider, kanban, map pan, carousel swipe) also works with single clicks/taps and with the keyboard (SC 2.5.7).
10. Every input has a programmatic `<label>`. Never use a placeholder as the label. Link errors with `aria-describedby`, set `aria-invalid` only when invalid, and after a failed submit move focus to the first invalid field or an error summary.
11. Never block paste or password managers on password and one-time-code fields; set `autocomplete` tokens (SC 3.3.8, 1.3.5). Do not ask again for data already entered in the same process (SC 3.3.7).
12. Modal dialogs: prefer native `<dialog>` + `showModal()`. Move focus in on open, keep Tab inside, close on Escape and a visible close button, return focus to the trigger, remove the closed dialog from the accessibility tree.
13. Announce async results through one persistent `role="status"` region present before its text changes; use `role="alert"` only for urgent errors. Never pair `role="status"` with `aria-live="assertive"`.
14. Under `prefers-reduced-motion: reduce`, remove travel, scale, parallax, scroll hijack, auto-advancing loops and pointer tracking; keep content fully reachable. Anything that moves for more than 5 s needs a pause control (SC 2.2.2); never flash more than 3 times per second (SC 2.3.1).
15. Any canvas, WebGL, 3D scene or chart that carries information has a text or HTML equivalent; purely decorative canvas is `aria-hidden="true"` and unfocusable.
16. Never use colour as the only cue (SC 1.4.1): add text, icon, pattern or position for states, errors, chart series and links in body text.
17. Do not hand-roll comboboxes, menus, tabs or date pickers when a native control or a vetted headless library implementing the APG pattern exists in the project.
18. Never report Gate D as PASS from an automated scan alone. PASS requires automated results plus the manual keyboard, focus, zoom/reflow and media checks below; a screen-reader pass that was not run is reported as a residual NOT_TESTED item.

## Specifications

### WCAG 2.2 criteria new since 2.1 (A/AA)

| SC | Level | Requirement | Typical failure | Build rule |
|---|---|---|---|---|
| 2.4.11 Focus Not Obscured (Minimum) | AA | Focused component not *entirely* hidden by author content | Sticky header/footer, cookie bar, chat panel covers focus (F110) | `scroll-padding` (C43); non-modal banners must not cover focus |
| 2.5.7 Dragging Movements | AA | Single-pointer alternative to drag, unless essential | Drag-only sortable list, slider without track click or buttons | Up/down buttons, "Move to…" menu, click on track, arrow keys |
| 2.5.8 Target Size (Minimum) | AA | Target ≥ 24 × 24 CSS px, or spacing exception | Touching 20 × 20 icon buttons | Padding or `::before` hit area; spacing so 24 px circles do not intersect |
| 3.2.6 Consistent Help | A | Repeated help (contact, form, self-help, chat) keeps same relative order | Help link moves between header and footer per page | Fixed slot in layout component |
| 3.3.7 Redundant Entry | A | Previously entered info auto-filled or selectable | Re-typing shipping address as billing | "Same as shipping", prefill from earlier step |
| 3.3.8 Accessible Authentication (Minimum) | AA | No cognitive function test without alternative/aid | Paste blocked, transcribe-a-code puzzles, image CAPTCHA only | Allow paste and managers, passkeys, magic links |

AAA additions (aspirational, not gated): 2.4.12 Focus Not Obscured (Enhanced), 2.4.13 Focus Appearance (indicator area ≥ a 2 CSS px perimeter, 3:1 change contrast), 3.3.9. 4.1.1 Parsing is removed in 2.2. Source: W3C "What's new in WCAG 2.2" (r01).

2.5.8 exceptions: spacing (24 px circle centred on each undersized target does not intersect another target or circle — 20 × 20 buttons with 4 px gaps pass); an equivalent control elsewhere on the page; inline links in text; unmodified user-agent controls; essential (dense map pins).

### Component → criteria map (pre-2.2 AA highlights plus 2.2)

| Component | Criteria to check |
|---|---|
| Page shell | 1.3.1 landmarks (`header`, `nav`, `main`, `footer`); 2.4.1 skip link; 2.4.2 title; 3.1.1 `lang`; 2.4.6 headings without skipped levels; 3.2.6 help slot |
| Navigation / menu | 2.1.1 keyboard; 2.4.3 focus order = visual order; 2.4.7 focus visible; 2.4.11 not obscured; 1.4.13 hover/focus content dismissible (Esc), hoverable, persistent |
| Buttons / links | 4.1.2 name, role, value; 2.5.3 label in name; 2.5.8 target size; 1.4.11 boundary 3:1; 1.4.3 label 4.5:1 |
| Forms | 1.3.1 label association; 1.3.5 `autocomplete`; 3.3.1 error identified in text; 3.3.2 labels/instructions; 3.3.3 suggestion; 3.3.7; 3.3.8; 1.4.11 input borders 3:1 |
| Dialogs / drawers | 2.1.2 no keyboard trap (Escape exits); 2.4.3 focus moves in and returns; 4.1.2 `role=dialog`, `aria-modal`, `aria-labelledby` |
| Toasts / async status | 4.1.3 status messages via live region; 2.2.1 timing adjustable — auto-dismissing toasts must not carry the only copy of needed info; default: errors persist until dismissed, info toasts pause on hover/focus (default — adjust per product) |
| Carousels / auto-motion | 2.2.2 pause/stop/hide; 2.5.7 swipe alternative; 2.3.1 flashes |
| Images / icons | 1.1.1 meaningful `alt` or `alt=""`; no "image of" phrasing |
| Media | 1.2.2 captions (prerecorded); 1.2.5 audio description (AA); 1.2.1 transcript for audio-only; 1.4.2 audio control for auto-playing sound > 3 s |
| Tables | 1.3.1 `th`, `scope`, `caption`; `aria-sort` on the sorted `th` only |
| Charts / canvas / 3D | 1.1.1 text alternative; 1.4.1 not colour-only; 1.4.11 marks 3:1; 2.1.1 keyboard for interactive parts |
| Layout | 1.4.4 text resize 200%; 1.4.10 reflow at 320 CSS px (no 2-D scroll except tables, maps); 1.4.12 text spacing (line-height 1.5, paragraph 2×, letter 0.12 em, word 0.16 em) without loss |

### Contrast thresholds

| Element | Minimum (AA) | Notes |
|---|---|---|
| Body and secondary text, placeholders, helper and error text | 4.5:1 | Applies in dark mode too; 7:1 is AAA |
| Large text (≥ 24 px, or ≥ 18.66 px bold) | 3:1 | 18 px regular is NOT large |
| Input borders, control boundaries, focus indicators, meaningful icons | 3:1 vs adjacent colours | SC 1.4.11 |
| Chart lines, bars, points | 3:1 vs background; data labels 4.5:1 | Plus a non-colour cue |
| Disabled controls, logos, pure decoration | Exempt | Still prefer legibility |

Never place mid-grey text on a chromatic background; use a darker shade of the background hue or near-white. Ghost buttons over photos need a scrim, backdrop or stroke. Colour palettes and ramps live in [visual-systems](visual-systems.md); contrast pairs are enforced at build time by `../scripts/build-tokens.mjs`.

### Keyboard model

| Key | Expected behaviour |
|---|---|
| Tab / Shift+Tab | Next/previous focusable in visual order; never positive `tabindex` |
| Enter | Activate link or button; submit form from a text field |
| Space | Activate button, toggle checkbox/switch |
| Escape | Close dialog, popover, menu, tooltip; return focus to trigger |
| Arrow keys | Move within a composite widget (tabs, menu, listbox, radio group, grid, slider) using roving `tabindex` or `aria-activedescendant` |
| Home / End | First/last item in composite widgets and listboxes |

One Tab stop per composite widget. Route changes in SPAs move focus to the new page's `h1` or `main` (tabindex `-1`) and update `document.title`.

### Focus ring token (default — adjust per brand)

2 px solid ring, 2 px offset, colour from a semantic `--ring` token with ≥ 3:1 against both the component and the page background; shown on `:focus-visible` only; containers may use `:focus-within`. Token naming lives in [design-tokens](design-tokens.md).

### Forced colors and contrast preferences

`forced-colors: active` (Baseline since 2022-09) replaces author colours with system colours, sets `box-shadow` and gradients to none and draws text backplates. Shadow-based rings and gradient-only buttons disappear. `prefers-contrast: more` (Baseline since 2022-05) asks for stronger borders and no translucency. Source: MDN (r01).

## Implementation

Detect the project's stack first ([frontend-architecture](frontend-architecture.md)). Prefer the project's existing headless library (Radix, React Aria, Headless UI, Ark) for composite widgets.

### Global CSS baseline (framework-agnostic; works with Tailwind v4)

```css
:root { --header-h: 4rem; --sticky-footer-h: 0px; }
html { scroll-padding-top: var(--header-h); scroll-padding-bottom: var(--sticky-footer-h); }

:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--ring, Highlight);
  outline-offset: 2px;
}
/* Shadow rings vanish in forced colors; a transparent outline becomes visible there */
.ring-shadow { outline: 2px solid transparent; box-shadow: 0 0 0 2px var(--ring); }

.skip-link { position: absolute; left: 0.5rem; top: -100%; }
.skip-link:focus { top: 0.5rem; }

/* 24px minimum hit area on small icon buttons without changing the glyph */
.icon-btn { position: relative; inline-size: 1.25rem; block-size: 1.25rem; }
.icon-btn::before { content: ""; position: absolute; inset: 50% auto auto 50%;
  inline-size: max(100%, 44px); block-size: max(100%, 44px); translate: -50% -50%; }

@media (forced-colors: active) {
  .btn-gradient { border: 1px solid ButtonText; }
  svg { fill: currentColor; }
}
@media (prefers-contrast: more) {
  :root { --border-muted: var(--border-strong); --text-muted: var(--text); }
  .glass { backdrop-filter: none; background: Canvas; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
```

The reduced-motion block is a safety net only; do not add a blanket `transition-duration: 0.2s` (it adds motion to elements that had none). Per-component reduced-motion design (opacity fades ≤ 200 ms allowed) is owned by [motion-engineering](motion-engineering.md). Overlapping `::before` hit areas must not intersect neighbours.

### Accessible field (React 19)

```tsx
import { useId } from "react";

export function Field({ label, error, hint, ...input }: {
  label: string; error?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className="grid gap-2">
      <label htmlFor={id}>
        {label}{input.required && <span aria-hidden="true"> *</span>}
      </label>
      {hint && <p id={hintId}>{hint}</p>}
      <input id={id} aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined} {...input} />
      {error && <p id={errId}>{error}</p>}
    </div>
  );
}
```

Pass `autoComplete` (`email`, `current-password`, `new-password`, `one-time-code`, `street-address`). On submit with errors: render an error summary with links to fields, or focus the first invalid input with `element.focus()`. Never fire one alert per field. Copy, layout and states of forms are owned by [interaction-design](interaction-design.md).

### Modal dialog (native, vanilla or React)

```tsx
import { useEffect, useId, useRef } from "react";

export function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      dlg.showModal();                                 // top layer, inert background, Esc fires cancel
      dlg.querySelector<HTMLElement>("h2")?.focus();
    }
    if (!open && dlg.open) {
      dlg.close();
      triggerRef.current?.focus?.();                   // return focus to the trigger
    }
  }, [open]);
  useEffect(() => () => { ref.current?.open && ref.current.close(); }, []); // unmount cleanup
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <h2 id={titleId} tabIndex={-1}>{title}</h2>
      {children}
      <button type="button" onClick={onClose}>Close</button>
    </dialog>
  );
}
```

Escape fires `cancel`, which routes through `onClose`, so the parent sets `open=false` and focus returns via the same path; verify return with the keyboard pass. Without native `<dialog>`, set `inert` on page siblings, trap Tab, and use `role="dialog" aria-modal="true"`. Close animations must not leave the closed panel focusable (unmount, `hidden` or `inert`).

### Live status region

```tsx
// Render once in the app shell; update its text, never mount it at the same time as the message.
export function StatusRegion({ message }: { message: string }) {
  return <div role="status" aria-atomic="true" className="sr-only">{message}</div>;
}
```

Use a separate `role="alert"` only for blocking errors. Clear and re-set the text to repeat an identical message.

### Sortable table header

```tsx
<th scope="col" aria-sort={sortKey === "name" ? (dir === "asc" ? "ascending" : "descending") : undefined}>
  <button type="button" onClick={() => toggleSort("name")}>
    Name <span aria-hidden="true">{sortKey === "name" ? (dir === "asc" ? "▲" : "▼") : ""}</span>
  </button>
</th>
```

`aria-sort` goes on the `th` of the primary sorted column only (APG sortable table, r05). Use `role="grid"` with roving tabindex only when cells are interactive. Table and chart IA is owned by [dashboard-engineering](dashboard-engineering.md).

### Charts, canvas and 3D alternatives

- Chart: `figure` + `figcaption` stating the takeaway, plus a visually hidden or toggleable data table with the same values; series distinguished by shape/dash/label as well as colour; tooltips reachable by keyboard or duplicated in the table.
- Decorative canvas/WebGL: `<canvas aria-hidden="true" tabindex="-1">`, no pointer traps, page fully usable without it.
- Informative 3D (product viewer, configurator): HTML controls outside the canvas for every action (rotate buttons, variant radio group), a text description of the current state, and a static image fallback when WebGL is unavailable or reduced motion is set. Scene engineering and fallbacks are owned by [three-dimensional-web](three-dimensional-web.md).
- Scroll stories: the reduced-motion branch renders all sections in normal flow; no clipped hijacked tracks.

### Media

Prerecorded video with speech: `<track kind="captions" srclang="en" default>`; AA also needs audio description or a descriptive transcript when visuals carry meaning. Background video: muted, no meaningful content, pause button if it plays more than 5 s, poster image, stopped under reduced motion. Encoding and poster rules: [video-pipelines](video-pipelines.md).

### Motion hook (JS animations must check themselves)

```ts
import { useReducedMotion } from "motion/react";   // or: matchMedia("(prefers-reduced-motion: reduce)")
const reduce = useReducedMotion();                  // also MotionConfig reducedMotion="user" at the root
```

CSS media queries cannot stop per-frame JS writes (rAF loops, GSAP, Lenis); each must read the preference and listen for `change`. Details: [motion-engineering](motion-engineering.md).

## Failure modes & fallbacks

| Failure | Fix |
|---|---|
| Focus ring vanishes in Windows Contrast themes | Ring drawn with `box-shadow`; add transparent `outline` or use `outline` directly |
| Focus hidden under sticky header after Tab | Add `scroll-padding-top`; check cookie bars and chat launchers |
| Custom `div` dropdown not operable | Replace with native `select` or APG-conformant headless combobox |
| Toast never announced | Live region mounted together with its message; mount the region at app start |
| Modal leaves page focusable / focus lost on close | Use `showModal()` or `inert`; store and restore the trigger |
| Placeholder-as-label, low-contrast placeholder | Visible `<label>`; placeholder at 4.5:1 or remove it |
| Gradient button loses fill in forced colors | Keep a 1 px border; use system colours in the forced-colors block |
| Icon button 16 px with no padding | Expand hit area to ≥ 24 px (44 px default) with padding or `::before` |
| Drag-only reorder | Add move buttons/menu and keyboard reordering with a live-region announcement |
| Reduced motion hides content (opacity 0 initial states) | Skip initial hidden states when reduced motion is set |
| axe reports "incomplete" for text over images | Treat as a manual check; sample worst-case pixels and add a scrim |
| No browser tool available | Do code-level review with the anti-pattern scan below; mark runtime checks NOT_TESTED |

Anti-pattern scan for code review (flag each): click handler on non-interactive element; `aria-label` on an element without a role; positive `tabindex`; `aria-hidden` on or containing focusables; skipped heading levels; links styled as buttons that act, or buttons that navigate; icon-only control without a name; meaningful image without `alt` or decorative image without `alt=""`; "image of" in alt; colour-only status; `outline: none` without replacement; `user-scalable=no` or `maximum-scale=1` in the viewport meta.

## Verification

Feeds **Gate D** (and contributes to F for reflow/zoom). Definitions and report format: [quality-gates](quality-gates.md).

### What automation can and cannot prove

- axe-core states it finds on average 57% of WCAG issues automatically (vendor figure, by issue volume, tuned for zero false positives, so it under-reports). The Anthropic accessibility-review guidance estimates about 30% coverage. Either way, automation is a floor.
- A Lighthouse accessibility score of 100 does not mean accessible: it is a weighted pass/fail of axe-derived audits (weights 3–10), and its 10 manual audits do not count.
- Automation cannot judge: alt text meaning; reading/focus order vs visual order; custom widget keyboard behaviour and focus return; 2.4.11 obscured focus; 2.5.7 drag alternatives; 3.2.6, 3.3.7, 3.3.8; error-message quality; live-region announcements; caption accuracy; motion/flash/pause; reflow and text-spacing breakage; text over images (axe "incomplete"); 1.4.13 hover content; real screen-reader output.

### Gate D procedure

1. **Capabilities.** Read [capability-registry](capability-registry.md) and the `../scripts/environment-audit.mjs` output. Use the current host's tool-discovery interface to check browser tools and their available actions. Use only `available-verified` tools; record the rest.
2. **Static review.** Run the anti-pattern scan over changed components. Check contrast pairs with `../scripts/build-tokens.mjs` when tokens come from a preset; otherwise compute ratios for each text/UI pair per theme.
3. **Automated scan.** If Playwright resolves: `node ../scripts/visual-check.mjs --url <url> --axe` (exit 4 = BLOCKED, Playwright not resolvable). If Chrome DevTools MCP `lighthouse_audit` is available-verified: run it (covers Accessibility, SEO, Best Practices; mode `navigation` or `snapshot`, device `mobile`/`desktop`). Record each violation with rule id, SC and node. Axe tag `EN-301-549v4` exists for EU-oriented runs. A failing critical/serious rule in a tested flow is a critical or high finding.
4. **Keyboard pass.** Tab through every tested flow (Playwright `keyboard.press('Tab')` or browser tool key presses), screenshot each stop, and assert: ring visible, not obscured, order logical, no trap. Open and close every dialog/menu with keyboard; assert focus returns to the trigger. Exercise Enter, Space, Escape, arrows on each composite widget.
5. **Names and roles.** Read the accessibility tree (Playwright ARIA snapshot, `take_snapshot` or `read_page`). Confirm every control has a correct role, name containing the visible label, and state.
6. **Forms.** Submit empty and invalid; confirm text errors, `aria-invalid`, `aria-describedby`, focus to first error/summary, paste allowed on auth fields, no redundant entry.
7. **Zoom, reflow, spacing.** 320 × 800 CSS px viewport and 200% text size; inject the 1.4.12 spacing CSS; no clipped or overlapping text, no 2-D scroll (viewport matrix is owned by [visual-testing](visual-testing.md)).
8. **Preferences.** Emulate `reducedMotion: 'reduce'`, `forcedColors: 'active'` and `contrast: 'more'` with Playwright `page.emulateMedia` and screenshot; the installed DevTools MCP `emulate` tool may lack these options (r01) — check its schema before relying on it.
9. **Media, charts, 3D.** Confirm captions/transcripts exist, pause controls work, chart data tables match, 3D has HTML controls and a static fallback.
10. **Screen reader.** If a human or tool can run NVDA + Chrome/Firefox or VoiceOver + Safari, record results; otherwise list "screen-reader pass" as a residual NOT_TESTED item with the flows it should cover.
11. **Report.** Findings as: issue, WCAG SC, severity (critical = blocks a task for a user group; high = major barrier with workaround; medium; low), fix. Include contrast, keyboard and screen-reader matrices. Gate D is PASS only with evidence from steps 3–9 and zero open critical findings; BLOCKED if no runtime tool exists; never lower a threshold to pass.

If a sibling skill such as `design:accessibility-review` or `ecc:accessibility` is installed (see [skill-delegation](skill-delegation.md)), it may run the audit; its findings are still re-checked against the thresholds here.

Regulatory context (not legal advice): WCAG 2.2 AA covers current and incoming EU (EN 301 549 v4.1.1, reported 2026-09-02, harmonisation pending) and US (ADA Title II, WCAG 2.1 AA, deadlines moved to 2027-04-26 / 2028-04-26) expectations; these come from secondary sources (r01, medium confidence).

## Sources

Installed skills (paraphrased; licence "none found" unless noted): design-taste-frontend (contrast audits, form pattern, reduced-motion collapse); impeccable (contrast rules; detector Apache-2.0, guidance text none found); make-interfaces-feel-better, ecc:motion-foundations, ecc:motion-patterns, ecc:accessibility, ecc:frontend-a11y, ecc:frontend-patterns, ecc:react-patterns (ECC; adapted and corrected); ecc:frontend-slides (MIT; reduced-motion baseline, corrected); emil-design-eng; transitions-dev (modal and shimmer fixes); ui-ux-pro-max (contrast by element, focus parity, search order); design-system (focus ring token); design:accessibility-review (Anthropic design plugin; layered protocol, report matrices).

External (retrieved 2026-10, dated research r01/r05):
- https://www.w3.org/TR/WCAG22/ (Recommendation 2024-12-12)
- https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://www.w3.org/WAI/standards-guidelines/wcag/wcag3-intro/
- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors
- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast
- https://www.w3.org/WAI/test-evaluate/tools/selecting/
- https://github.com/dequelabs/axe-core
- https://developer.chrome.com/docs/lighthouse/accessibility/scoring
- https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/
- https://www.deque.com/blog/en-301-549-v4-1-1-is-final-what-changed-what-it-means-and-what-you-should-do/ (secondary)
- https://www.jdsupra.com/legalnews/doj-extends-title-ii-ada-web-2176958/ (secondary)
