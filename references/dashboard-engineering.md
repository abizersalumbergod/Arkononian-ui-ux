# Dashboard engineering

Rules for building dashboards, admin panels and SaaS apps whose job is to help people decide and act on data: information architecture, navigation, KPIs, tables, filters, charts, drill-downs, data integrity and CRUD workflows. Dashboards are judged by task completion and data correctness, not by visual spectacle.

**Load when:** dashboard, admin panel, analytics, reporting, SaaS app, internal tool, CRM/back office, CRUD, data tables, charts, KPI tiles, filters/saved views. **Owns:** dashboard/SaaS IA and navigation patterns, KPI design, data tables, filter/date-range/saved-view state, chart selection for dashboards, drill-downs, data-state taxonomy for data surfaces, data integrity, CRUD workflow safety, SaaS quality checks.
**Related:** [dashboard workflow](../workflows/dashboard.md), [product-discovery](product-discovery.md), [interaction-design](interaction-design.md), [accessibility](accessibility.md), [visual-systems](visual-systems.md), [design-tokens](design-tokens.md), [typography-and-layout](typography-and-layout.md), [responsive-design](responsive-design.md), [performance](performance.md), [motion-engineering](motion-engineering.md), [security-and-privacy](security-and-privacy.md), [frontend-architecture](frontend-architecture.md), [skill-delegation](skill-delegation.md), [quality-gates](quality-gates.md), [precision-saas preset](../presets/README.md)

## Decision rules

1. Before any layout, write the 3-6 questions the screen must answer (default set: are we on target, what is driving it, what changed, what should I do next) and the decision each supports. Delete any panel that answers none of them.
2. Classify every dashboard as operational (time-sensitive: auto-refresh, freshness timestamp, prioritised thresholds) or analytical (periodic: filters, comparison periods, drill-down, export) during [product-discovery](product-discovery.md); build the features of that class only.
3. Make the first viewport the working product (KPIs, the primary table or the main chart), never a marketing hero, unless the user asks for one.
4. Show at most 4 headline KPIs without scrolling; every KPI must state value, unit, period and a comparison (vs previous period or target). No KPI without a period; no delta without its baseline.
5. Never fabricate, randomise or "illustrate" metrics in a production build. Demo, sample or seeded data must carry a visible "Sample data" label on every affected surface and must be switchable off.
6. Every filter, date range, sort and search must change the query that produces the data. A control that only changes styling or is not wired is a Gate B failure.
7. Keep filters, sort, page, date range, selected tab and open record in the URL. Typing updates use `replace`; deliberate view changes (saved view, drill-down) use `push` so Back undoes them.
8. Choose the chart by the analytical question (table in Specifications), never by novelty. Ban radial gauges, 3D charts and pies with more than 5 slices or near-equal shares.
9. Never encode a value with colour alone (WCAG 1.4.1). Bars and areas start at zero. A line chart may use a non-zero baseline (sensor readings, prices) only when the axis is labelled with its range. Never animate or truncate an axis in a way that misrepresents magnitude.
10. Give every chart a title with unit and period, a text summary of the key finding, and a reachable data-table alternative.
11. Format every number and date with `Intl.NumberFormat` / `Intl.DateTimeFormat`, cached per option set, in the viewer's locale and an explicit, displayed time zone. Use `tabular-nums` and right alignment for numeric columns.
12. Implement sortable columns as a `<button>` inside `<th scope="col">`, with `aria-sort` only on the currently sorted header, and announce the new sort order.
13. Paginate task tables people reference, share or act on; virtualise logs, feeds and exploration grids. Paginate or virtualise beyond 200-500 rows or about 5,000 cells (default, adjust after profiling).
14. Design all six data states for every data surface: loading, empty (with the right empty-state type), partial, error with retry, stale, and no-permission. A blank panel is never acceptable.
15. Confirm every destructive action with the object's name and consequence; prefer undo for reversible deletes and typed confirmation for irreversible or bulk deletes.
16. Make every create/update safe against double submit (disable while pending plus idempotency key), network failure (keep user input, offer retry) and concurrent edits (version/ETag check, conflict UI).
17. Enforce tenant isolation on the server from the session, never from a client-supplied tenant id; return 404, not 403, for records in another tenant. Switching workspace clears tenant-scoped caches and URL state.
18. Before writing chart code, check whether the `dataviz` skill is installed (session skill list or `scripts/environment-audit.mjs`); if it is, invoke it for chart form, palette and marks. Its advice ranks at precedence level 7 and never overrides rules 5, 6, 9 and 10.

## Specifications

### Information architecture and navigation

| Pattern | Use when | Specs (defaults, adjust per product) |
|---|---|---|
| Top nav | ≤ 5 top-level sections, shallow hierarchy | ≤ 5 items (impeccable critique limit, medium confidence); active item marked with `aria-current="page"` |
| Sidebar | > 5 sections, nested areas, frequent switching | 240 px (precision-saas `space.sidebar` 15rem); collapsible icon rail 56-64 px with visible tooltips and accessible names; group headings; never hide the current location |
| Breadcrumbs | depth ≥ 3 or drill-down from list to record | `<nav aria-label="Breadcrumb">` with `<ol>`; last item `aria-current="page"`, not a link |
| Workspace / tenant switcher | multi-org or multi-project accounts | top of sidebar; always shows current workspace name; switch = full tenant context reset (rule 17) |
| Command palette (optional) | power users, > 20 destinations | Ctrl/Cmd+K; mirrors nav, never the only path to a feature |

- Order sections overview → performance → resources → domain-specific risk (dashboard-builder, MIT). For product analytics: outcome KPIs → drivers → changes/anomalies → actionable lists.
- One primary action per screen plus 1-2 secondary; the rest go in an overflow menu (impeccable, medium confidence).
- Generic nav component states, menus and focus handling: [interaction-design](interaction-design.md).

### KPI tiles

- Anatomy (top to bottom): label (metric name) → value with unit → comparison (`+4.2% vs prev. 30 days`, sign and colour **and** an arrow or word) → optional sparkline (decorative, `aria-hidden`, with a text trend in the tile) → "as of" time on operational boards.
- Size: KPI value one step above body in the type scale ([typography-and-layout](typography-and-layout.md)); no oversized hero cards that push the table below the fold. A single hero metric may be larger only on a single-metric screen.
- Grid: 3-4 per row, collapsing to 2 then 1 column (claudekit slides, no licence, medium confidence; breakpoints in [responsive-design](responsive-design.md)).
- No decorative icons in KPI tiles; the number is the content (NN/g complex apps, 2020-11-08).
- Latency-type metrics show p50/p95/p99, never averages alone (dashboard-builder, MIT).
- "Good" direction must be explicit: a rise in churn is red. Store `goodDirection: 'up' | 'down' | 'neutral'` per metric.
- Panel acceptance: title, unit, meaningful thresholds/status colours, filters for the common slices, sensible default time range and refresh, not a vanity metric (dashboard-builder, MIT).

### Tables

| Item | Spec |
|---|---|
| First column | human-readable identifier (name, order number), not an internal auto-ID (NN/g data tables, 2022-04-03) |
| Column order | by task importance; user can hide/reorder/sort columns on complex tables |
| Alignment | text left, numbers right with `tabular-nums`, dates consistent format; headers align with their data |
| Row height | 32 / 40 / 48 px compact / default / comfortable (r05 default); precision-saas uses 28 / 36 px (`rowCompact`, `row`). Offer a density toggle on data-heavy tables |
| Sticky | `<thead>` sticky with z-index above cells; first column sticky on horizontal overflow, subtle shadow on frozen edge (NN/g) |
| Row scanning | zebra striping or light borders plus hover highlight; selected row uses `accentSubtle` (precision-saas contrast pair ≥ 4.5:1) |
| Selection | checkbox column 40-48 px; target ≥ 24×24 px (WCAG 2.2 SC 2.5.8); header checkbox supports indeterminate; shift-click range select |
| Row actions | 1-2 inline actions, otherwise an overflow menu with an accessible name including the row identifier |
| Bulk actions | action bar appears on selection with count ("12 selected"), "Select all 1,234 matching" as an explicit second step, clear selection; bulk destructive = typed confirmation |
| Editing | inline edit only for narrow tables with a distinct edit mode; otherwise a non-modal side drawer (NN/g) |
| Pagination | `<nav aria-label="Pagination">`, current page `aria-current="page"`, "Showing 51-100 of 1,234" in a polite live region; page sizes 25/50/100 (default); cursor pagination for large/live sets, label estimated totals "about 12k" |
| Virtualisation | beyond 200-500 rows or ~5,000 cells (r05 default); for heavy rows (rich cells) consider from ~50 visible rows (react-patterns, MIT). Keep `<thead>` sticky outside the virtual body, `aria-rowcount` on `<table>`, `aria-rowindex` on each rendered `<tr>`, and a search box because Ctrl+F cannot find unrendered rows |
| Long simple lists | `content-visibility: auto` with `contain-intrinsic-size: auto 80px` before reaching for JS virtualisation (react-performance, MIT) |
| Mobile | priority 1 columns (identifier, status, key metric) always visible; priority 2 hidden < 768 px; priority 3 hidden < 1024 px (defaults); hidden columns reachable in the row's detail view; below ~640 px consider a stacked card list. Never rely on horizontal scroll without a sticky first column |

### Filters, date ranges and saved views

- Show active filters as removable chips with a "Clear all"; show the result count after filtering.
- Date range: presets (Today, Last 7 days, Last 30 days, This quarter, Custom) plus a comparison toggle (previous period / same period last year). Display the resolved absolute range and time zone ("1-30 Sep 2026, UTC+1").
- Define period boundaries once (inclusive start, exclusive end, in the account's reporting time zone) and use them in both query and label.
- Debounce free-text search 250-300 ms (default); wrap filter/sort state changes in `startTransition` so input stays responsive (react-performance, MIT; INP budget in [performance](performance.md)).
- Changing a filter resets pagination to page 1 and preserves sort.
- Saved views store the URL query (filters, sort, columns, density), a name, an owner and a visibility scope (private/team). Shared views never embed personal data or secrets in the URL ([security-and-privacy](security-and-privacy.md)).

### Charts: choose by question

| Analytical question | Use | Avoid |
|---|---|---|
| How does it change over time? | line (area only for a single cumulative series) | many overlapping series; > 5 lines → small multiples |
| Which category is bigger? / ranking | sorted horizontal bar | unsorted bars, pie |
| Part of a whole | 100% stacked bar; pie/donut only for ≤ 5 lopsided shares (NN/g 2017) | pie with near-equal slices |
| Actual vs target | bullet chart with target marker (NN/g) | radial gauge |
| Distribution | histogram, box plot | average-only KPI |
| Relationship between two measures | scatter | dual-axis line |
| Composition over time | stacked bar or stacked area, ≤ 5 series | streamgraph |
| Exact lookup | table | any chart |

- Position and length encode quantity most accurately; area and angle are weaker; colour is categorical, not ordered (NN/g 2017).
- Colour: status colours (success/warning/danger) are reserved for status; categorical series ≤ 6 hues by default, then group as "Other"; marks need ≥ 3:1 against the background (WCAG 1.4.11); use shape, direct labels or patterns as the second channel. Palette construction: delegate to `dataviz`, else [visual-systems](visual-systems.md).
- Single-series charts: hide the legend; very faint gridlines (claudekit slides use alpha 0.05, no licence).
- SVG libraries (Recharts) slow down beyond a few thousand points per chart: downsample or use a canvas renderer (ECharts) (r05).
- Chart entrance animation only on first reveal, under 400 ms and skipped under `prefers-reduced-motion`; axis baselines stay fixed (remotion-video-creation, MIT). Timing tokens: [motion-engineering](motion-engineering.md).
- Number tween counters: animate from the previous value, format with Intl, `tabular-nums`, expose the final value as text, do not announce each frame (transitions-dev + motion-advanced, corrected).

### Data states (data-surface specific; generic patterns in [interaction-design](interaction-design.md))

| State | Must show |
|---|---|
| Loading | skeleton in the same box as the content (reserved height, no layout shift, `aria-busy="true"`); keep previous data dimmed during refetch instead of a skeleton |
| Empty: first use | what will appear, why it matters, primary action (create/import/template) (impeccable, paraphrased) |
| Empty: no results | the active filters and a "Clear filters" action |
| Empty: user cleared | light message, easy re-create |
| Partial | which sources/widgets failed, the rest still rendered |
| Error | what failed in plain words, retry, request id for support; never a raw stack trace |
| Stale | "Updated 14 min ago" plus refresh; mark stale when age > 2x the refresh interval (default) |
| No permission | why, who can grant access, request-access action; never render the hidden numbers blurred in the DOM |

### CRUD workflows

| Concern | Rule |
|---|---|
| Validation | validate on blur and on submit, server re-validates; errors next to fields plus a summary linked to fields ([interaction-design](interaction-design.md)) |
| Destructive | confirmation names the object and consequence; undo window 5-10 s (default) for soft deletes; typed confirmation for irreversible or bulk |
| Unsaved changes | warn on drawer close, in-app navigation and `beforeunload` when dirty |
| Network failure | keep the input, show inline error with retry; offline: disable submit with reason |
| Duplicate submit | disable submit while pending, `Idempotency-Key` header per logical operation (IETF draft; server must support it) |
| Optimistic updates | only for reversible, low-risk, high-success edits (toggles, renames); roll back and explain on failure. Never optimistic for payments, permissions, deletes of shared data |
| Concurrent edits | send version or ETag with `If-Match`; on 412/409 show a conflict view (theirs vs yours, keep both inputs), never silent overwrite (RFC 9110) |
| Tenant isolation | server-side scoping by session tenant on every query and mutation; cache keys include tenant id |
| Audit | record who changed what and when for business-critical objects; show "Last edited by" in the detail view |

### Drill-downs and detail drawers

- Click on a chart mark, KPI or row → filtered list or record detail, carrying the filter context into the URL; breadcrumb or Back returns to the exact prior view.
- Prefer a non-modal side drawer for record detail from a table so the list context stays visible (NN/g data tables); use a full page when the record has its own sub-navigation or is linkable as a work object.
- Drawer: `role="dialog"` with label when modal; focus moves in on open and returns to the triggering row on close; Esc closes (with unsaved-changes check). Dialog mechanics: [interaction-design](interaction-design.md).
- Show detail on hover/focus (tooltip) without navigation for quick reads (NN/g complex apps); tooltips must also open on keyboard focus.

## Implementation

Detect the project's stack first ([frontend-architecture](frontend-architecture.md)): framework, router, data-fetching library, table and chart libraries and their **major versions**. TanStack Table v8 (`useReactTable`, `getCoreRowModel()`) and v9 (`useTable` with `tableFeatures()`) APIs are not interchangeable; read the installed package's types before writing table code and never mix snippets. Current versions per r05 research (2026-10-23): `@tanstack/react-table` 9.3.1, `@tanstack/react-virtual` 3.14.22, `recharts` 3.10.1, `echarts` 6.1.0 — verify at runtime (`npm view <pkg> version`).

**URL state for filters (Next.js App Router, client component; wrap its parent in `<Suspense>` because it reads `useSearchParams`).**

```tsx
'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';

export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const set = useCallback((patch: Record<string, string | null>, mode: 'replace' | 'push' = 'replace') => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) (v == null || v === '') ? next.delete(k) : next.set(k, v);
    if (!('page' in patch)) next.delete('page'); // any filter change returns to page 1
    const url = next.size ? `${pathname}?${next}` : pathname;
    startTransition(() => router[mode](url, { scroll: false }));
  }, [params, pathname, router]);
  return { params, set, isPending }; // dim results while isPending instead of blanking them
}
```

Vanilla variant: build a `URL(location.href)`, edit `url.searchParams`, call `history.replaceState(null, '', url)` (or `pushState`), then re-render from `Object.fromEntries(url.searchParams)`; listen to `popstate` to re-render on Back/Forward. Validate every param against an allow-list before using it in a query.

**Sortable header (WAI-ARIA APG sortable table pattern).**

```tsx
type Sort = { id: string; dir: 'ascending' | 'descending' } | null;

export function SortHeader({ id, label, sort, onSort }: { id: string; label: string; sort: Sort; onSort: (id: string) => void }) {
  const active = sort?.id === id;
  return (
    <th scope="col" aria-sort={active ? sort!.dir : undefined} className="text-right">
      <button type="button" onClick={() => onSort(id)} className="inline-flex min-h-6 items-center gap-1">
        {label}
        <span aria-hidden="true">{active ? (sort!.dir === 'ascending' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  );
}
// After sorting, write "Sorted by Revenue, descending" into a visually hidden <div role="status">.
```

**Cached formatters.**

```ts
const cache = new Map<string, Intl.NumberFormat>();
export function nf(opts: Intl.NumberFormatOptions, locale?: string) {
  const key = `${locale ?? ''}|${JSON.stringify(opts)}`;
  let f = cache.get(key);
  if (!f) { f = new Intl.NumberFormat(locale, opts); cache.set(key, f); }
  return f;
}
export const money = (v: number, currency: string) => nf({ style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
export const compact = (v: number) => nf({ notation: 'compact', maximumFractionDigits: 1 }).format(v);
export const delta = (ratio: number) => nf({ style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 1 }).format(ratio);
export const day = (d: Date, timeZone: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone }).format(d);
export const cell = (v: number | null, f: (n: number) => string) => (v == null ? '—' : f(v)); // null is "no data", not 0
```

Show the full value in a tooltip or `title`-free accessible text when a compact value is displayed (`1.2M` → "1,234,567").

**Virtualised semantic table body (TanStack Virtual; spacer rows keep native table layout).**

```tsx
'use client';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, type ReactNode } from 'react';

export function VirtualTable<T>({ rows, columns, header, renderRow, label, rowHeight = 40 }: {
  rows: T[]; columns: number; header: ReactNode; label: string; rowHeight?: number;
  renderRow: (row: T, ariaRowIndex: number) => ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => rowHeight, overscan: 8 });
  const items = v.getVirtualItems();
  const top = items.length ? items[0].start : 0;
  const last = items[items.length - 1];
  const bottom = last ? v.getTotalSize() - (last.start + last.size) : 0;
  return (
    <div ref={scrollRef} role="region" aria-label={label} tabIndex={0} className="h-[600px] overflow-auto">
      <table aria-rowcount={rows.length + 1} className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-[var(--color-surface)]">{header}</thead>
        <tbody>
          {top > 0 && <tr aria-hidden="true"><td colSpan={columns} style={{ height: top, padding: 0 }} /></tr>}
          {items.map((it) => renderRow(rows[it.index], it.index + 2))}{/* header row is aria-rowindex 1 */}
          {bottom > 0 && <tr aria-hidden="true"><td colSpan={columns} style={{ height: bottom, padding: 0 }} /></tr>}
        </tbody>
      </table>
    </div>
  );
}
```

`renderRow` must key by a stable id and set `aria-rowindex`. `overscan` is a documented option not on the fetched intro page: confirm in the installed types. The 600 px container height is a default — adjust per layout.

**Safe mutation (framework-agnostic).**

```ts
export class ConflictError extends Error { constructor(public server: unknown) { super('conflict'); } }

export async function saveRecord(id: string, changes: object, version: string, opId: string, signal?: AbortSignal) {
  const res = await fetch(`/api/records/${encodeURIComponent(id)}`, {
    method: 'PATCH', signal,
    headers: { 'Content-Type': 'application/json', 'If-Match': version, 'Idempotency-Key': opId },
    body: JSON.stringify(changes),
  });
  if (res.status === 409 || res.status === 412) throw new ConflictError(await res.json().catch(() => null));
  if (!res.ok) throw new Error(`Save failed (${res.status})`);
  return res.json();
}
// Caller: generate opId = crypto.randomUUID() once per user intent (reuse it on retry), disable submit while pending,
// snapshot -> apply optimistic patch -> on error restore snapshot, keep form input, show retry; on ConflictError open the conflict view.
```

React 19 projects may use `useOptimistic` + `useTransition` (or the data library's mutation API) for the optimistic layer; the rollback, idempotency and conflict rules stay the same.

**Server-side tenant scoping (Next.js route handler; `getSession` and `db` are the project's own).**

```ts
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  const { id } = await params;
  const row = await db.record.findFirst({ where: { id, tenantId: session.tenantId } }); // tenant from session only
  if (!row) return new Response(null, { status: 404 });                                // hide cross-tenant existence
  if (req.headers.get('if-match') !== row.version) return Response.json(row, { status: 412 });
  // validate body against a schema, apply, bump version, write audit entry, return the saved row
}
```

**Unsaved-changes guard.**

```ts
useEffect(() => {
  if (!dirty) return;
  const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
  window.addEventListener('beforeunload', onBeforeUnload);
  return () => window.removeEventListener('beforeunload', onBeforeUnload);
}, [dirty]);
// The App Router has no route-change blocker: also confirm on drawer close and on in-app nav links while dirty.
```

**Charts.** Recharts 3.x enables `accessibilityLayer` by default (keyboard point navigation, one tab stop); keep it on and still add a caption and a "View as table" toggle. ECharts has accessibility off by default; import modularly and dispose:

```ts
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, AriaComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
echarts.use([LineChart, GridComponent, TooltipComponent, AriaComponent, CanvasRenderer]);

export function mountChart(el: HTMLElement, option: echarts.EChartsCoreOption, summary: string) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const chart = echarts.init(el);
  chart.setOption({ ...option, animation: !reduced, aria: { show: true, description: summary, decal: { show: true } } });
  const ro = new ResizeObserver(() => chart.resize());
  ro.observe(el);
  return () => { ro.disconnect(); chart.dispose(); }; // call from useEffect cleanup
}
```

**Delegation to `dataviz`.** If the skill appears in the session's skill list or `environment-audit` reports it, invoke it before the first chart, stat tile or palette decision and follow its form heuristic, palette validator and mark specs. Otherwise use the chart table above and [visual-systems](visual-systems.md). Record which path was used in the report. See [skill-delegation](skill-delegation.md).

## Failure modes & fallbacks

| Failure | Fix |
|---|---|
| Filter chips change but numbers do not | wire the param into the query key and the server query; add the Gate B filter test below |
| KPI shows a number with no period or unit | add period label and unit; if the source cannot supply them, mark the KPI "unverified" and ask |
| Random or placeholder numbers shipped | replace with real source or explicit "Sample data" labelling; record as critical in Gate B |
| Totals disagree with row sums | compute totals on the server from the same filtered query; show rounding note if sums of rounded values differ |
| Dates shift by a day for some users | parse as UTC instants, format with an explicit `timeZone`, define inclusive/exclusive bounds |
| Table janks on scroll or typing | profile; virtualise or paginate; memoise rows; `useDeferredValue` for the search term ([performance](performance.md)) |
| Screen reader reads virtual table as 30 rows | set `aria-rowcount` and `aria-rowindex`; add a search box |
| Chart unreadable in dark mode or for colour-blind users | use theme tokens per mode ([design-tokens](design-tokens.md)), second channel (labels, shapes, decals), re-check 3:1 |
| Double-click creates two records | disable while pending plus idempotency key; server de-duplicates |
| Silent overwrite of a colleague's edit | version/ETag with `If-Match`; conflict view |
| Data from another tenant visible after switching | include tenant id in every cache key; clear caches and URL state on switch; server scoping |
| Chart library not installed and installs are blocked | render an accessible HTML table plus inline SVG bars/sparklines; mark the chart route in the report |
| TanStack docs unreachable | read the installed package's `.d.ts`; do not guess v9 option names |
| `dataviz` skill absent | apply this module's chart rules; note the fallback |

## Verification

Feeds gates B, C, D, E, F and H ([quality-gates](quality-gates.md)). Keep each result separate and mark untested items `NOT_TESTED` with a reason.

- **Gate B — functional:** for each filter, date preset, sort and search: apply it and assert the row count, a total or the first row changes (or the no-results state appears); reload the URL and assert the same view returns; Back restores the previous view. CRUD journeys: create, edit, delete with undo, validation error, network failure (offline or blocked request) with retry, double submit, conflicting edit from a second tab. Any fabricated metric or unlabelled sample data = critical.
- **Data integrity checks:** every KPI and chart has unit, period and time zone; totals reconcile with rows; null renders as "no data", not 0; comparison baselines are labelled.
- **Gate D — accessibility:** keyboard-only pass through nav, filters, table sort, row actions, drawer open/close with focus return; `aria-sort` on exactly one header; pagination `aria-current`; charts have summary and table alternative; status not colour-only; targets ≥ 24×24 px. Run `node ../scripts/visual-check.mjs --url <url> --out <dir> --axe` when Playwright resolves; otherwise use a browser tool whose status in [capability-registry](capability-registry.md) is `available-verified`, or mark NOT_TESTED. Screen-reader checks (VoiceOver can lose Recharts point navigation, r05) need a real screen reader; never claim them otherwise.
- **Gate E — performance:** interact with filters and sort on the largest realistic dataset; INP ≤ 200 ms target; label lab results as lab ([performance](performance.md)).
- **Gate F — responsive:** tables at 375/768/1280 px: priority columns visible, no page-level horizontal overflow, sticky first column works, drawer usable at 320 px.
- **Gate H — reliability/security:** no console errors across states; destructive actions confirm; cross-tenant id request returns 404 (test with two seeded tenants); ECharts/observers disposed on unmount (navigate away and back, check for duplicate listeners or growing heap).
- Use the [acceptance checklist](../templates/acceptance-checklist.md) and record results in the [quality report](../templates/quality-report.json), validated with `node ../scripts/quality-report.mjs --report <path>`.

## Sources

Installed skills (techniques paraphrased; numbers credited inline):
- `dashboard-builder` (ECC plugin, MIT, Copyright 2026 Affaan Mustafa): question-first design, panel categories and order, panel acceptance checklist, percentile latency.
- `react-patterns`, `react-performance`, `frontend-patterns` (ECC plugin, MIT): virtualisation threshold, `content-visibility`, `startTransition` / `useDeferredValue`.
- `remotion-video-creation` (ECC plugin, MIT; upstream provenance unverified): chart entrance rules.
- `impeccable` (no licence found locally; paraphrased only): empty-state taxonomy, cognitive-load limits, product UI discipline.
- `transitions-dev` (no licence found; paraphrased only): skeleton-to-content reveal and number pop-in, corrected for accessibility; motion details in [motion-engineering](motion-engineering.md).
- `slides` (claudekit, no licence found; paraphrased only): KPI grid columns, faint gridlines.
- `frontend-design-direction` (ECC plugin, MIT): product-first first viewport.
- `dataviz` (built-in skill; licence not recorded in the audit): delegated at runtime, content not copied.
- Preset: [precision-saas](../presets/README.md) (`presets/precision-saas.json`, this package): row heights, sidebar width, contrast pairs.

External (r05 research retrieved 2026-10-23 unless noted):
- https://registry.npmjs.org/@tanstack/react-table/latest and https://tanstack.com/blog/announcing-tanstack-table-v9 (v9 architecture, 9.3.1).
- https://registry.npmjs.org/@tanstack/react-virtual/latest and https://tanstack.com/virtual/latest/docs/introduction (3.14.22, core API).
- https://www.nngroup.com/articles/dashboards-preattentive/ (Laubheimer, 2017-06-18) and https://www.nngroup.com/articles/complex-application-design/ (Kaplan, 2020-11-08).
- https://www.nngroup.com/articles/data-tables/ (Laubheimer, 2022-04-03).
- https://registry.npmjs.org/recharts/latest and https://github.com/recharts/recharts/wiki/3.0-migration-guide (3.10.1, `accessibilityLayer` default).
- https://registry.npmjs.org/echarts/latest and https://echarts.apache.org/handbook/en/best-practices/aria/ (6.1.0, Apache-2.0, aria/decal).
- Standards cited from the specifications, not re-fetched in this build: WAI-ARIA 1.2 `aria-sort` and the APG sortable-table example (https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/); WCAG 2.2 SC 1.4.1, 1.4.11, 2.5.8; RFC 9110 conditional requests (`If-Match`, 412); IETF draft "The Idempotency-Key HTTP Header Field" (draft status: check before relying on it).
