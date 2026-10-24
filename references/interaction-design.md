# Interaction design

The explicit state model every interactive component must implement, per component family, plus feedback timing, destructive-action handling, empty/loading/error patterns and microcopy. Use it so that no control is inert, every state is designed, and keyboard, pointer and touch users get the same outcome.

**Load when:** building or reviewing any component, form, navigation, overlay, feedback or settings surface; writing UI copy; Stage 5 (Build) of [SKILL.md](../SKILL.md). **Owns:** component state model and precedence, forms and validation behaviour, navigation patterns, menus, dialogs/drawers, tabs/segmented controls, tooltips/popovers, toasts, pagination, filters, search, command palette, settings, feedback timing, destructive-action confirmation, empty/loading/skeleton/error/partial/permission states, microcopy rules, the "no inert controls" rule.
**Related:** [accessibility](accessibility.md), [design-tokens](design-tokens.md), [motion-engineering](motion-engineering.md), [dashboard-engineering](dashboard-engineering.md), [responsive-design](responsive-design.md), [landing-page-engineering](landing-page-engineering.md), [security-and-privacy](security-and-privacy.md), [frontend-architecture](frontend-architecture.md), [quality-gates](quality-gates.md)

WCAG success-criterion detail lives in [accessibility](accessibility.md); animation values in [motion-engineering](motion-engineering.md); data-table structure, sorting and CRUD flows in [dashboard-engineering](dashboard-engineering.md); touch-target and pointer adaptation in [responsive-design](responsive-design.md).

## Decision rules

1. **No inert controls.** Every visible button, link, tab, menu item and CTA performs its action, navigates to a real destination, or is removed. Never ship `href="#"`, empty `onClick`, or "coming soon" controls that look enabled; if a control must stay visible while unavailable, render it `aria-disabled="true"` with a visible reason. An inert primary CTA fails Gate B.
2. Specify the state set for every interactive component before styling it: default, hover, focus-visible, active, disabled, loading, plus selected, expanded, error, success and empty where the component has them. A component with only a default state is not done.
3. Resolve stacked states in this order: disabled > loading > error > active > selected > focus-visible > hover > default. Focus-visible must remain visible on top of every state except disabled.
4. Gate hover styles behind `@media (hover: hover) and (pointer: fine)`; never put information or actions behind hover alone. Every hover-revealed control needs a keyboard and touch path.
5. Use semantic elements first: `<button>` for actions, `<a href>` for navigation, `<dialog>` for modals, `popover` for light-dismiss overlays, native `<select>`, `<input type>` and `<details>` where they fit. Add ARIA only for patterns HTML lacks (tabs, combobox, menu).
6. Give feedback within 100ms of every press; show a loading indicator only when work exceeds ~300ms, a skeleton beyond ~1s, and progress plus a cancel path beyond ~10s.
7. Prevent double submission: while a request is pending, mark the trigger busy (`aria-disabled`, `aria-busy`), ignore repeat activations, and keep its width stable.
8. Forms: every input has a visible `<label>` (placeholders are never labels); validate on blur, then live once a field has shown an error; on submit, focus the first invalid field and show a summary when there are 2+ errors; never clear user input on error.
9. Errors appear next to their source, linked with `aria-describedby` and `aria-invalid`, and say what happened and how to fix it. Toasts are for transient confirmations only, never for form errors.
10. Overlays: modals use `<dialog>.showModal()` (top layer, inert background, Escape) and return focus to the trigger on close; anchored overlays use the `popover` attribute or a portal. Never position a dropdown inside an `overflow: hidden` ancestor.
11. Prefer undo over confirmation for reversible destructive actions. Use a confirmation dialog only for irreversible, high-cost or batch actions; it names verb + object + count, states the consequence, and labels buttons by outcome ("Delete 5 files" / "Keep files"), never Yes/No/OK.
12. Every data surface designs six content states: loading, empty, error, partial, success, permission. Mark a state NOT_APPLICABLE only with a reason; an untested state is NOT_TESTED.
13. Use skeletons shaped like the final layout for content loads; reserve spinners for in-control waits (buttons, inputs). Skeletons must not shift layout when content arrives (CLS, see [performance](performance.md)).
14. Keyboard: every action reachable with Tab/Shift+Tab, Enter/Space, Escape and arrow keys where the pattern defines them (tabs, menus, listboxes, radio groups). Single-key shortcuts must ignore focused inputs and modifier combos and be remappable or disableable (WCAG 2.1.4).
15. Every drag, swipe or long-press action has a single-pointer or button alternative (WCAG 2.5.7).
16. Microcopy: verb + object labels, one label per intent across the page, one term per concept across the product, sentence case, no blame, no jokes in errors, no raw error codes.
17. Persist what users set: filters, sort, pagination, tabs and search live in the URL when shareable; Back restores scroll, filters and input.
18. Settings: save explicitly with a visible save state, or auto-save with per-field confirmation; never mix both on one page. Destructive settings (delete account, revoke keys) sit apart, behind confirmation.
19. Motion in any state change respects `prefers-reduced-motion`; state must remain understandable with motion removed.
20. Match the project's primitive library (Base UI, Radix, React Aria, native) detected from `package.json`; never mix two primitive libraries in one project.

## Specifications

### State model

| State | Trigger | Visual cue (tokens from [design-tokens](design-tokens.md)) | Semantics |
|---|---|---|---|
| default | rest | role tokens | native element |
| hover | pointer over (fine pointers only) | one step colour shift; optional shadow sm → md | none |
| focus-visible | keyboard/programmatic focus | ring 2-3px, offset 2px, ≥ 3:1, identical everywhere | none (native focus) |
| active / pressed | pointer down, Enter/Space | darkest step; `scale(0.97)` (range 0.95-0.98) or `translateY(1px)` | `aria-pressed` only for toggles |
| selected | chosen item in a set | accent fill/indicator plus a non-colour cue (check, weight, bar) | `aria-selected` / `aria-current` / `checked` |
| expanded | disclosure open | chevron rotation, open panel | `aria-expanded` |
| disabled | not available | opacity 0.38-0.5, muted colours, `cursor: not-allowed` | `disabled` or `aria-disabled="true"` |
| loading | async in progress | spinner in place of icon; children dimmed to 0.7; pointer events off | `aria-busy="true"`, hidden "Loading…" text |
| success | operation completed | check/confirmation, then return to default or next step | `role="status"` message |
| error | invalid or failed | error border + icon + text below; error ring on focus | `aria-invalid`, `aria-describedby`, alert/live region |
| empty | no data/content | explanation + one action | heading + action button |

Sources: impeccable (8 states, focus ring), design-handoff/design-system (Anthropic, focus-visible added for WCAG 2.4.7), design-system (claudekit) loading/disabled anatomy and precedence, ui-ux-pro-max disabled opacity.

### Feedback timing

| Situation | Threshold | Source |
|---|---|---|
| visual response to tap/click | ≤ 100ms (press state 80-150ms) | ui-ux-pro-max; Nielsen 0.1s limit |
| show spinner/skeleton | after ~300ms of waiting; once shown keep ≥ 500ms to avoid flicker (default — adjust per product) | ui-ux-pro-max |
| prefer skeleton/shimmer over spinner | waits > 1s | ui-ux-pro-max; Nielsen 1s limit |
| show progress + estimate + cancel | waits > ~10s | Nielsen 10s limit |
| search-as-you-type debounce | 300ms | react-patterns |
| toast auto-dismiss (no action) | 3-5s; pause on hover, focus and hidden tab | ui-ux-pro-max; emil-design-eng |
| undo toast (has action) | ≥ 6s (default — adjust per product); pause on hover/focus | default; WCAG 2.2.1 rationale |
| tooltip open delay / in / out | 80ms delay, 125-150ms in, 50ms out; neighbours open instantly once one is open | transitions-dev, emil-design-eng |
| hover-reveal grace before hiding | 400ms | frontend-slides (ECC) |
| long press | 600ms (always with an alternative) | ecc:motion-advanced |
| validation shake | 280ms total, 6px/4px legs; off under reduced motion | transitions-dev |
| delight moments | < 1s, never blocking | impeccable |

### Component families

**Buttons and links.** Button = action, link = navigation; never style a `<div>` as either. Primary CTA labels ≤ 3 words (ideal 1-2) and must not wrap at desktop; fix by shortening, not by `max-width` (design-taste-frontend). One primary action per view region. Icon-only buttons need `aria-label` and a tooltip. Loading buttons keep their width and label text (visually hidden) and announce the pending state. External links say so (icon + hidden text) when they open a new tab.

**Inputs, forms and validation.** Visible label, persistent helper text for complex formats, semantic `type`, `autocomplete` and `inputmode`. Required fields marked in text, not colour alone. Validate on blur (except password strength, which is live). Error text sits directly below the field, in the error shade with an icon, and clears as soon as the value is valid; never auto-clear while still invalid. With 2+ errors on submit: summary at the top with links to each field, focus moved to the summary or first invalid field. Read-only is distinct from disabled. Do not disable submit for an invalid form (users cannot discover why); validate on submit instead, and disable only while pending. Edge probes: empty, 500+ characters, `<script>`, emoji/Unicode, rapid double submit, network failure, missing required fields (gan-evaluator).

**Navigation.** Current location highlighted with `aria-current="page"` plus a non-colour cue; identical placement on every page; bottom nav ≤ 5 labelled destinations with no nested navigation; breadcrumbs from 3+ levels deep; never mix tabs, sidebar and bottom nav at one level; modals never carry primary navigation; destructive items (log out, delete account) spatially separated (ui-ux-pro-max). Mobile menus are disclosures (`aria-expanded`) or dialogs, with Escape and focus return. Prefetch the next route on hover/focus where the framework supports it (react-performance).

**Menus.** Site navigation dropdowns are disclosure lists of links, not `role="menu"`. Use `role="menu"` only for application action menus, and then implement arrow keys, Home/End, typeahead, Escape returning focus to the button. Anchored surfaces scale from their trigger (`transform-origin` from the primitive library's origin variable); modals stay centred (emil-design-eng, transitions-dev).

**Dialogs and drawers.** `<dialog>` with `showModal()`: top layer, background inert, Escape fires `cancel`. Label with `aria-labelledby` (title) and optional `aria-describedby`. Initial focus on the first meaningful control (or the least destructive button in a confirmation); return focus to the trigger on close (store it explicitly; do not rely only on browser behaviour). Backdrop click closes only non-destructive, non-form dialogs. Drawers are dialogs anchored to an edge; drag-to-dismiss threshold 120px or 500 px/s (Motion example values, ecc:motion-advanced) plus a visible close button. Scrim 40-60% black. Lock page scroll while open and restore on close.

**Tabs and segmented controls.** `role="tablist"` / `tab` / `tabpanel`, `aria-selected`, roving `tabindex` (only the active tab is tabbable), Left/Right arrows (Up/Down for vertical), Home/End. Automatic activation when panels are cheap; manual (Enter/Space) when switching is expensive. Segmented controls that filter a single view can be a radio group instead. Sliding pill indicator: 250ms ease-out, positioned without transition on first paint and resize (transitions-dev). Keep panel state across switches when it matters (React 19.2 `<Activity>` if the installed React supports it; verify `npm view react version`).

**Tooltips and popovers.** Tooltips hold short supplementary text only, never essential info or interactive content; show on hover and keyboard focus; dismissible with Escape without moving focus; hoverable (no gap that closes it) (WCAG 1.4.13). Popovers with interactive content use the `popover` attribute (`popover="auto"` for light dismiss, `"manual"` for script-controlled) with a `popovertarget` button; verify the expanded state in the accessibility tree. Position with CSS anchor positioning only where the target browsers support it; otherwise a positioning library (Floating UI via the primitive library) or a portal with `position: fixed`, recomputed on scroll/resize and flipped at viewport edges (impeccable).

**Toasts.** Container is a polite live region (`role="status"`); never steals focus; max ~3 visible, newest on top (default — adjust per product); pause timers on hover, focus and `visibilitychange` hidden; actions in toasts are also reachable elsewhere or the toast persists until dismissed. Detect whether the project already uses Sonner or a library Toast before adding one (research r02).

**Tables (states only).** Loading skeleton rows matching column widths, empty state with an action, error row with retry, selected rows with checkbox + `aria-selected`, sort state via `aria-sort`, sticky header with `--z-raised`. Structure, density, virtualization (50+ rows) and bulk actions live in [dashboard-engineering](dashboard-engineering.md).

**Pagination.** `<nav aria-label="Pagination">`, current page `aria-current="page"`, previous/next as real links with disabled state at the ends, page in the URL. Show total count where known. "Load more" moves focus to the first new item; infinite scroll needs a reachable footer and a "load more" fallback.

**Filters.** Applied filters visible as removable chips with a "Clear all"; result count announced in a polite live region after changes; instant apply for few cheap filters, an explicit "Apply" for many or expensive ones; zero-result state offers to remove the last filter; state in the URL.

**Search.** `<search>` or `role="search"` landmark, `type="search"` input with a label, clear button with an accessible name, 300ms debounce, cancel stale requests, empty-query and no-results states that suggest next steps, result count announced.

**Command palette.** Open with Ctrl+K / Cmd+K (ignore while an editable field has focus unless the palette is the only shortcut target), also reachable from a visible button. Dialog containing a combobox (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`) and a listbox; Up/Down move, Enter runs, Escape closes and returns focus; group results with headings; show the keyboard shortcut next to each command; announce result count.

**Settings.** Group by user task, not by system module; label every toggle with what On means; switches (`role="switch"`, `aria-checked`) for instant-apply booleans only; explicit save shows dirty state, a sticky save bar and an unsaved-changes guard on navigation; auto-save shows "Saved" per field; danger zone separated and confirmed.

### Destructive actions

| Action type | Pattern |
|---|---|
| reversible single item (archive, remove from list, delete with trash) | act immediately, undo toast, commit on expiry; restore and show an error if the commit fails |
| irreversible or high-cost (delete project, revoke key, cancel subscription) | confirmation dialog: title "Delete project 'Atlas'?", consequence sentence, outcome-labelled buttons, focus on the safe button |
| batch | confirmation naming the count ("Delete 5 items"); type-to-confirm only for account/project-level deletion (default — adjust per product) |

Destructive actions without confirmation or undo fail Gate H.

### Content-state contract

| State | Must show | Safe next action |
|---|---|---|
| loading | stable structure (skeleton), progress where measurable | cancel where supported |
| empty | what this area is, why it is empty | the single action that fills it |
| error | specific failure in plain language, no stack traces | retry, alternative, or support path |
| partial | what loaded, clearly marked gaps | retry the missing part |
| success | confirmation using the action's name ("Published") | next step or undo |
| permission | the access boundary, who can grant it | request access or go back |

Source: frontend-design-direction (ECC), ux-copy (Anthropic).

### Microcopy rules

- Buttons: verb + object ("Save changes", "Create invoice"); keep the same verb through the flow (button "Publish" → toast "Published").
- One label per intent across the page: pick one of "Contact us" / "Get in touch" / "Let's talk" (design-taste-frontend).
- Errors: what happened, why, how to fix, with an example format when useful ("Enter a date like 24/10/2026").
- Empty states invite action; loading copy says what is happening, plus expected time for waits over a few seconds.
- User's vocabulary, not the system's ("notifications", not "webhook config"); sentence case; no filler; link text meaningful out of context.
- Tone by state: success restrained, error helpful, warning actionable, neutral concise (ux-copy).
- Localisation: full sentences as single strings, no concatenation, budget +30-40% length (German ~+30%, French ~+20%, Finnish up to +40%) (impeccable).

## Implementation

Detect the stack first ([frontend-architecture](frontend-architecture.md)): React/Next version, primitive library (`@base-ui/react`, `radix-ui`, `react-aria-components`, none), toast library, form library. Prefer the installed primitives; the snippets below are for projects without them or to show the required behaviour.

### State styling (CSS, token-driven)

```css
.control { transition: background-color var(--duration-quick) var(--ease-out),
                       transform var(--duration-quick) var(--ease-out); }
@media (hover: hover) and (pointer: fine) { .control:hover { background: var(--control-bg-hover); } }
.control:focus-visible { outline: var(--focus-ring-width) solid var(--color-focus-ring);
                         outline-offset: var(--focus-ring-offset); }
.control:active:not([aria-disabled="true"]) { transform: scale(0.97); }
.control[aria-disabled="true"], .control:disabled { opacity: .5; cursor: not-allowed; }
.control[aria-busy="true"] { pointer-events: none; }
.control[aria-busy="true"] > :not(.spinner) { opacity: .7; }
@media (prefers-reduced-motion: reduce) { .control { transition: none; } .control:active { transform: none; } }
```

### Submit button with pending state (React 19)

```tsx
'use client';
import { useFormStatus } from 'react-dom';

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button type="submit" className="control" aria-disabled={pending || undefined} aria-busy={pending || undefined}
        onClick={(e) => { if (pending) e.preventDefault(); }}>
        {children}{pending && <span className="spinner" aria-hidden="true" />}
      </button>
      <span role="status" className="sr-only">{pending ? 'Saving…' : ''}</span>
    </>
  );
}
```

### Form with server validation (React 19 `useActionState`)

```tsx
'use client';
import { useActionState, useEffect, useRef } from 'react';
import { saveProfile, type ProfileState } from './actions'; // 'use server' module

export function ProfileForm() {
  const [state, action] = useActionState<ProfileState, FormData>(saveProfile, { errors: {} });
  const summary = useRef<HTMLDivElement>(null);
  const errs = Object.entries(state.errors ?? {});
  useEffect(() => { if (errs.length > 1) summary.current?.focus(); }, [state]); // eslint-disable-line
  return (
    <form action={action} noValidate>
      {errs.length > 1 && (
        <div ref={summary} tabIndex={-1} role="alert">
          <p>Fix {errs.length} fields:</p>
          <ul>{errs.map(([k, m]) => <li key={k}><a href={`#${k}`}>{m}</a></li>)}</ul>
        </div>
      )}
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required
        defaultValue={state.values?.email} aria-invalid={!!state.errors?.email || undefined}
        aria-describedby={state.errors?.email ? 'email-error' : undefined} />
      {state.errors?.email && <p id="email-error" className="field-error">{state.errors.email}</p>}
      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}
```

React 19 resets uncontrolled fields after a form action completes; echo submitted values back in `state.values` (as above) so input survives an error, and verify in the browser. With one error, focus that field instead of the summary. Use controlled inputs or React Hook Form / TanStack Form for live formatting, cross-field rules or dynamic arrays (react-patterns). Validate again on the server; client validation is a convenience ([security-and-privacy](security-and-privacy.md)).

### Modal dialog with focus return (React, native `<dialog>`)

```tsx
'use client';
import { useEffect, useId, useRef } from 'react';

export function Modal({ open, onClose, title, children }:
  { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { opener.current = document.activeElement as HTMLElement | null; d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    const handleClose = () => { onClose(); opener.current?.focus(); };
    d.addEventListener('close', handleClose);           // Escape → cancel → close
    return () => { d.removeEventListener('close', handleClose); if (d.open) d.close(); };
  }, [onClose]);
  return (
    <dialog ref={ref} aria-labelledby={titleId} className="modal">
      <h2 id={titleId}>{title}</h2>
      {children}
      <button type="button" onClick={() => ref.current?.close()}>Close</button>
    </dialog>
  );
}
```

Vanilla: the same calls (`showModal()`, `close()`, the `close` event, focus the stored opener). Style the backdrop with `.modal::backdrop { background: var(--color-scrim); }`. If a primitive library is installed, use its Dialog instead; it already handles focus.

### Popover menu and tooltip (HTML `popover`)

```html
<button popovertarget="row-actions">Actions</button>
<div id="row-actions" popover="auto" class="menu">
  <button type="button">Rename</button>
  <button type="button">Duplicate</button>
</div>

<button aria-describedby="tip-export" class="icon-btn" aria-label="Export">…</button>
<div id="tip-export" role="tooltip" popover="manual">Export as CSV</div>
<script>
  const btn = document.querySelector('[aria-describedby="tip-export"]');
  const tip = document.getElementById('tip-export'); let t;
  const show = () => { clearTimeout(t); t = setTimeout(() => tip.showPopover(), 80); };
  const hide = () => { clearTimeout(t); if (tip.matches(':popover-open')) tip.hidePopover(); };
  btn.addEventListener('pointerenter', show); btn.addEventListener('focus', show);
  btn.addEventListener('pointerleave', hide); btn.addEventListener('blur', hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
</script>
```

`popover="auto"` gives light dismiss and Escape. Check target-browser support for `popover` before relying on it, and keep the tooltip hoverable if it can be pointed at (extend `hide` with a grace timeout).

### Undo instead of confirm

```ts
async function removeWithUndo(id: string) {
  const item = store.take(id);                       // optimistic removal
  const commit = setTimeout(async () => {
    try { await api.delete(id); }
    catch { store.restore(item); toast.error('Could not delete. The item was restored.'); }
  }, 6000);
  toast('Item deleted', { action: { label: 'Undo', onClick: () => { clearTimeout(commit); store.restore(item); } } });
}
```

Flush pending commits on `pagehide` or let the server hold a soft delete; never lose data because the tab closed.

### Debounced, race-safe search

```ts
export function useDebouncedValue<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
// in the component: abort stale requests
useEffect(() => {
  if (!q) return;
  const ac = new AbortController();
  fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ac.signal })
    .then(r => r.ok ? r.json() : Promise.reject(r.status)).then(setResults)
    .catch(e => { if (e?.name !== 'AbortError') setError(true); });
  return () => ac.abort();
}, [q]);
```

### Tabs keyboard handling

```ts
function onTabKey(e: React.KeyboardEvent, i: number, count: number, select: (n: number) => void) {
  const map: Record<string, number> = { ArrowRight: (i + 1) % count, ArrowLeft: (i - 1 + count) % count, Home: 0, End: count - 1 };
  if (e.key in map) { e.preventDefault(); select(map[e.key]); }  // select() also focuses the tab
}
```

## Failure modes & fallbacks

| Symptom | Cause | Fix |
|---|---|---|
| Dropdown clipped | positioned inside `overflow: hidden` | `popover`/top layer, portal, or anchor positioning |
| Focus lost after closing modal | opener not stored, element re-rendered | store opener; fall back to a stable landmark/heading |
| Sticky hover on touch | hover not media-gated | `@media (hover: hover) and (pointer: fine)` |
| Double charge/submit | trigger not busy while pending | pending guard + server idempotency key |
| Input wiped after server error | React 19 form reset | echo values to `defaultValue` or control inputs |
| Skeleton flashes for 50ms | indicator shown immediately | delay ~300ms, minimum display ~500ms |
| Screen reader silent on errors/results | no live region, or region created at the same time as its text | render the live region empty on mount, then update text |
| Shortcut fires while typing | no target check | skip when `e.target` is an input, textarea or contenteditable |
| Tooltip unreachable by keyboard | hover-only listeners | show on focus, close on Escape |
| Toast actions missed | auto-dismiss too fast, no pause | pause on hover/focus/hidden; longer timeout; action available elsewhere |
| `popover` unsupported in a target browser | old engine | primitive library or portal fallback |

## Verification

Feeds Gate B (journeys work, no inert CTAs), Gate D (keyboard, focus, announcements), Gate F (no hover-only functions) and Gate H (destructive confirmation, no console errors).

1. Inert-control sweep: list every button/link in scope and click each; search sources for `href="#"`, `onClick={() => {}}`, `javascript:` (`rg -n 'href="#"|=> \{\s*\}|javascript:' src`). Any hit on a visible control is a Gate B finding.
2. Keyboard pass per flow: Tab order, visible focus on every stop, Enter/Space/Escape/arrows per pattern, focus return after every overlay.
3. State matrix: render each component in every applicable state (a story, fixture page or test) and screenshot via [visual-check](../scripts/visual-check.mjs) or verified browser tools; if no browser capability is `available-verified`, mark the state screenshots NOT_TESTED with the reason.
4. Edge probes on every form: empty, 500+ characters, special characters, double submit, offline/failed request, missing required fields.
5. Screen-reader-relevant checks: names and roles in the accessibility tree, `aria-invalid`/`aria-describedby` wiring, live-region announcements for results, errors and toasts. Automated axe runs (`--axe`) do not replace this manual check.
6. Reduced motion (`--reduced-motion`): states still distinguishable.
7. Record results per journey in the quality report ([templates/quality-report.json](../templates/quality-report.json)); use [acceptance-checklist](../templates/acceptance-checklist.md) for sign-off.

## Sources

Installed skills (paraphrased; licences per the audit digest, see [LICENSES_AND_PROVENANCE](../LICENSES_AND_PROVENANCE.md)):
- impeccable, none found: state set, focus ring, overlay clipping ladder, undo over confirm, copy formulas, localisation budget, delight budget. Ideas only.
- design-taste-frontend, none found: CTA label rules, full state cycle, press feedback. Ideas only.
- frontend-design (Anthropic official plugin), Apache-2.0: interface writing rules.
- frontend-design-direction (ECC), MIT: six content-state contract.
- ux-copy, design-handoff, design-system (Anthropic design plugin), no LICENSE file (likely Apache-2.0, unverified): microcopy formulas, tone matrix, mandatory state matrix.
- design-system (claudekit), MIT: state precedence, loading/error/disabled anatomy.
- ui-ux-pro-max, none found: feedback thresholds, form contract, navigation limits, touch sizing. Ideas only.
- emil-design-eng, transitions-dev, none found: tooltip timing, origin-aware popovers, shake, sliding pill (numbers cited, no code copied).
- ecc:motion-foundations, ecc:motion-advanced, MIT: press scale, gesture thresholds.
- frontend-slides (ECC), MIT: hover-reveal grace timeout.
- react-patterns, react-performance, frontend-patterns, gan-evaluator (ECC), MIT (ECC root licence): React 19 forms, debounced search, Activity, prefetch, portals, edge-case probes.

External:
- WCAG 2.2 (1.4.13 Content on Hover or Focus, 2.1.4 Character Key Shortcuts, 2.2.1 Timing Adjustable, 2.4.7 Focus Visible, 2.5.7 Dragging Movements): https://www.w3.org/TR/WCAG22/ (from prior knowledge; not re-fetched in this build).
- WAI-ARIA Authoring Practices (tabs, menu button, combobox, dialog patterns): https://www.w3.org/WAI/ARIA/apg/patterns/ (from prior knowledge; not re-fetched).
- Nielsen, response-time limits 0.1 / 1 / 10 s: https://www.nngroup.com/articles/response-times-3-important-limits/ (from prior knowledge; not re-fetched).
- shadcn changelog and npm registry (primitive libraries, toast): https://ui.shadcn.com/docs/changelog , https://www.npmjs.com/package/@base-ui/react , https://www.npmjs.com/package/radix-ui (retrieved 2026-10 via research brief r02; verify at runtime: `npm view @base-ui/react version`, `npm view radix-ui version`).
