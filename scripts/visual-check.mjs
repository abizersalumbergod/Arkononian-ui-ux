#!/usr/bin/env node
// visual-check: open a page (http(s) URL, file:// URL or local file) in headless Chromium through
// Playwright at several viewports and report, per viewport: a full-page screenshot, horizontal
// overflow, console errors, failed requests, broken images and elements that extend past the
// viewport, plus optional axe-core results. Zero dependencies of its own: Playwright is resolved
// from the target project, else from the global npm root. Node >= 18, ESM. Run with --help.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { isMainModule } from './lib/fsutil.mjs';

export const EXIT = Object.freeze({ OK: 0, CRITICAL: 1, ERROR: 2, BLOCKED: 4, USAGE: 64 });
export const DEFAULT_VIEWPORTS = Object.freeze(['375x812', '768x1024', '1280x800', '1920x1080']);
const PLAYWRIGHT_PACKAGES = Object.freeze(['playwright', '@playwright/test', 'playwright-core']);
const CRITICAL_REQUEST_TYPES = new Set(['document', 'stylesheet', 'script']);
const MAX_DETAILS = 20;
const MAX_ELEMENTS = 5000;

/** Bad command-line input or options (CLI exit 64). */
export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

const firstLine = (s) => String(s ?? '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';
const clip = (s, n = 300) => {
  const t = String(s ?? '');
  return t.length > n ? `${t.slice(0, n - 3)}...` : t;
};

/** URL for reports: credentials removed, data: URLs and very long URLs shortened. */
export function displayUrl(href) {
  if (/^data:/i.test(href)) return clip(href, 80);
  try {
    const u = new URL(href);
    if (u.username || u.password) {
      u.username = '';
      u.password = '';
    }
    return clip(u.href, 300);
  } catch {
    return clip(href, 300);
  }
}

// ---------------------------------------------------------------------------------------------
// Module resolution (Playwright, axe-core)
// ---------------------------------------------------------------------------------------------

let globalRootsCache = null;

/**
 * Candidate global node_modules directories: `npm root -g` first, then the conventional default.
 * `label` is safe to print (it never contains environment variable values).
 * @returns {{dir: string, label: string}[]}
 */
export function globalNpmRoots() {
  if (globalRootsCache) return globalRootsCache;
  const roots = [];
  const opts = { encoding: 'utf8', timeout: 15000, windowsHide: true };
  // Constant command with no user input. On Windows npm is npm.cmd, which needs a shell.
  const r = process.platform === 'win32' ? spawnSync('npm root -g', { ...opts, shell: true }) : spawnSync('npm', ['root', '-g'], opts);
  const out = r.status === 0 && typeof r.stdout === 'string' ? r.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() : null;
  if (out && path.isAbsolute(out)) roots.push({ dir: out, label: 'npm root -g' });
  if (process.platform === 'win32') {
    if (process.env.APPDATA) roots.push({ dir: path.join(process.env.APPDATA, 'npm', 'node_modules'), label: '%APPDATA%\\npm\\node_modules' });
  } else {
    roots.push({ dir: path.resolve(path.dirname(process.execPath), '..', 'lib', 'node_modules'), label: '<node prefix>/lib/node_modules' });
  }
  const seen = new Set();
  globalRootsCache = roots.filter((root) => {
    const key = process.platform === 'win32' ? root.dir.toLowerCase() : root.dir;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return globalRootsCache;
}

function resolveFrom(dir, name) {
  try {
    return createRequire(path.join(dir, '__visual_check_resolve__.js')).resolve(name);
  } catch {
    return null;
  }
}

function packageVersion(resolvedFile, name) {
  let dir = path.dirname(resolvedFile);
  for (let i = 0; i < 10; i++) {
    const pj = path.join(dir, 'package.json');
    if (existsSync(pj)) {
      try {
        const json = JSON.parse(readFileSync(pj, 'utf8'));
        if (json.name === name) return json.version ?? null;
      } catch {
        // keep walking up
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function searchLocations(options) {
  const projectDir = path.resolve(options.projectDir ?? process.cwd());
  const locations = [{ dir: projectDir, source: 'project', label: `project (${projectDir})` }];
  if (options.includeGlobal !== false) {
    const roots = options.globalRoots ? options.globalRoots.map((dir) => ({ dir: path.resolve(dir), label: path.resolve(dir) })) : globalNpmRoots();
    for (const root of roots) locations.push({ ...root, source: 'global' });
  }
  return locations;
}

/**
 * Find a Playwright package that can launch Chromium: first from the target project (and its
 * parent folders), then from the global npm root.
 * @param {{projectDir?: string, includeGlobal?: boolean, globalRoots?: string[]}} [options]
 * @returns {Promise<{ok: true, source: string, packageName: string, version: string|null, path: string, chromium: object}
 *   | {ok: false, reason: string, tried: string[]}>}
 */
export async function resolvePlaywright(options = {}) {
  const tried = [];
  for (const loc of searchLocations(options)) {
    if (loc.source === 'global' && !existsSync(loc.dir)) {
      tried.push(`${loc.label}: directory not found`);
      continue;
    }
    let found = false;
    for (const name of PLAYWRIGHT_PACKAGES) {
      const resolved = resolveFrom(loc.dir, name);
      if (!resolved) continue;
      found = true;
      try {
        const mod = createRequire(resolved)(resolved);
        if (mod?.chromium && typeof mod.chromium.launch === 'function') {
          return { ok: true, source: loc.source, packageName: name, version: packageVersion(resolved, name), path: resolved, chromium: mod.chromium };
        }
        tried.push(`${loc.label}: ${name} has no chromium launcher`);
      } catch (e) {
        tried.push(`${loc.label}: ${name} failed to load (${clip(firstLine(e.message), 160)})`);
      }
    }
    if (!found) tried.push(`${loc.label}: no ${PLAYWRIGHT_PACKAGES.join(' / ')} package`);
  }
  return { ok: false, reason: 'BLOCKED: playwright not resolvable', tried };
}

/**
 * Find axe-core (project first, then the global npm root) and return the path of its browser build.
 * @param {{projectDir?: string, includeGlobal?: boolean, globalRoots?: string[]}} [options]
 */
export function resolveAxe(options = {}) {
  for (const loc of searchLocations(options)) {
    if (loc.source === 'global' && !existsSync(loc.dir)) continue;
    const main = resolveFrom(loc.dir, 'axe-core');
    if (!main) continue;
    const min = path.join(path.dirname(main), 'axe.min.js');
    return { ok: true, source: loc.source, path: existsSync(min) ? min : main, version: packageVersion(main, 'axe-core') };
  }
  return { ok: false, reason: 'axe-core is not resolvable from the project or the global npm root (install it with npm i -D axe-core to enable --axe)' };
}

// ---------------------------------------------------------------------------------------------
// Input normalisation
// ---------------------------------------------------------------------------------------------

/**
 * Turn --url input into a navigable URL. Local paths must exist (a directory needs index.html).
 * @param {string} input
 * @param {string} [cwd]
 * @returns {{href: string, display: string, kind: 'http'|'file', path?: string}}
 */
export function normalizeTarget(input, cwd = process.cwd()) {
  if (typeof input !== 'string' || input.trim() === '') throw new UsageError('--url <url|file> is required');
  const value = input.trim();
  if (/^(https?|file):\/\//i.test(value)) {
    let u;
    try {
      u = new URL(value);
    } catch {
      throw new UsageError(`invalid URL: ${clip(value, 120)}`);
    }
    return { href: u.href, display: displayUrl(u.href), kind: u.protocol === 'file:' ? 'file' : 'http' };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[a-z]:[\\/]/i.test(value)) {
    throw new UsageError(`unsupported URL scheme "${value.split(':')[0]}:"; use http://, https://, file:// or a local path`);
  }
  let abs = path.resolve(cwd, value);
  let st;
  try {
    st = statSync(abs);
  } catch {
    throw new UsageError(`file not found: ${abs}`);
  }
  if (st.isDirectory()) {
    const index = path.join(abs, 'index.html');
    if (!existsSync(index)) throw new UsageError(`directory has no index.html: ${abs}`);
    abs = index;
  }
  const href = pathToFileURL(abs).href;
  return { href, display: href, kind: 'file', path: abs };
}

/**
 * Parse "375x812,1280x800" (or an array of strings / {width, height}) into unique viewports.
 * @param {string|Array<string|{width: number, height: number}>} value
 * @returns {{width: number, height: number, label: string}[]}
 */
export function parseViewports(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(',');
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    let width;
    let height;
    if (raw && typeof raw === 'object') {
      ({ width, height } = raw);
    } else {
      const item = String(raw).trim();
      if (item === '') continue;
      const m = /^(\d{1,5})x(\d{1,5})$/i.exec(item);
      if (!m) throw new UsageError(`invalid viewport "${clip(item, 40)}" (expected WIDTHxHEIGHT, e.g. 375x812)`);
      width = Number(m[1]);
      height = Number(m[2]);
    }
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 200 || height < 200 || width > 7680 || height > 7680) {
      throw new UsageError(`viewport ${width}x${height} is out of range (each side 200-7680 px)`);
    }
    const label = `${width}x${height}`;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ width, height, label });
  }
  if (out.length === 0) throw new UsageError('no viewports given');
  return out;
}

// ---------------------------------------------------------------------------------------------
// In-page measurement (serialised into the page by Playwright: must not use outer variables)
// ---------------------------------------------------------------------------------------------

async function measurePage({ maxElements }) {
  const de = document.documentElement;
  const body = document.body;
  const clientWidth = de.clientWidth;
  const scrollWidth = Math.max(de.scrollWidth, body ? body.scrollWidth : 0);
  const clipsX = (el) => {
    const v = getComputedStyle(el).overflowX;
    return v === 'hidden' || v === 'clip';
  };
  const viewportClipsX = clipsX(de) || (body ? clipsX(body) : false);
  const describe = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
    if (cls.length) s += `.${cls.join('.')}`;
    return s.length > 120 ? `${s.slice(0, 117)}...` : s;
  };

  const broken = [];
  let pendingImages = 0;
  for (const img of Array.from(document.images)) {
    const src = img.currentSrc || img.getAttribute('src') || '';
    if (!src) continue;
    if (!img.complete) {
      pendingImages += 1;
      continue;
    }
    if (img.naturalWidth > 0) continue;
    let failed = false;
    try {
      await img.decode(); // resolves for a valid image without intrinsic size (e.g. some SVGs)
    } catch {
      failed = true;
    }
    if (failed) broken.push({ src: src.length > 200 ? `${src.slice(0, 197)}...` : src, alt: img.getAttribute('alt'), element: describe(img) });
  }

  const cache = new Map();
  const info = (node) => {
    let v = cache.get(node);
    if (!v) {
      const s = getComputedStyle(node);
      v = { fixed: s.position === 'fixed', clips: s.overflowX !== 'visible' };
      cache.set(node, v);
    }
    return v;
  };
  // Fixed elements do not extend the scrollable area; descendants of a clipping or scrolling
  // container (other than html/body) are contained by it.
  const contained = (el) => {
    if (info(el).fixed) return true;
    for (let n = el.parentElement; n && n !== body && n !== de; n = n.parentElement) {
      const i = info(n);
      if (i.fixed || i.clips) return true;
    }
    return false;
  };
  const all = body ? body.getElementsByTagName('*') : [];
  const limit = Math.min(all.length, maxElements);
  const scrollX = window.scrollX;
  const samples = [];
  let wideCount = 0;
  for (let i = 0; i < limit; i++) {
    const el = all[i];
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const left = rect.left + scrollX;
    const right = rect.right + scrollX;
    const wider = rect.width > clientWidth + 1;
    const pastRight = right > clientWidth + 1;
    const cutLeft = left < -1 && right > 0; // fully off-screen left = visually-hidden pattern, ignored
    if (!wider && !pastRight && !cutLeft) continue;
    if (contained(el)) continue;
    wideCount += 1;
    if (samples.length < 10) samples.push({ element: describe(el), width: Math.round(rect.width), left: Math.round(left), right: Math.round(right) });
  }
  return {
    clientWidth,
    scrollWidth,
    viewportClipsX,
    broken,
    pendingImages,
    wideCount,
    wideSamples: samples,
    elementsChecked: limit,
    elementsTotal: all.length,
    metaViewport: Boolean(document.querySelector('meta[name="viewport" i]')),
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

// ---------------------------------------------------------------------------------------------
// Browser run
// ---------------------------------------------------------------------------------------------

async function launchChromium(chromium, timeout) {
  const attempts = [
    { label: 'chromium (Playwright-managed)', options: {} },
    { label: 'chrome (installed channel)', options: { channel: 'chrome' } },
    { label: 'msedge (installed channel)', options: { channel: 'msedge' } },
  ];
  const errors = [];
  for (const attempt of attempts) {
    try {
      const browser = await chromium.launch({ headless: true, timeout, ...attempt.options });
      return { browser, label: attempt.label, errors };
    } catch (e) {
      errors.push(`${attempt.label}: ${clip(firstLine(e.message), 200)}`);
    }
  }
  return { browser: null, label: null, errors };
}

function classify(r, settings) {
  if (r.overflowX) {
    const first = r.details.wideElements[0];
    const cause = first ? `; first offender ${first.element} (${first.width}px wide, right edge ${first.right}px)` : '';
    const msg = `horizontal overflow: page is ${r.scrollWidth}px wide in a ${r.clientWidth}px viewport${cause}`;
    if (r.viewportClipsX) r.warnings.push(`${msg}; html/body clip overflow-x, so content is cut off rather than scrollable`);
    else r.critical.push(msg);
  } else if (r.wideElements > 0) {
    r.warnings.push(`${r.wideElements} element(s) extend past the viewport edge without causing scroll (clipped or cut off on the left)`);
  }
  if (r.brokenImages > 0) r.critical.push(`${r.brokenImages} broken image(s)`);
  if (r.consoleErrors > 0) r.critical.push(`${r.consoleErrors} console error(s) or uncaught exception(s)`);
  if (r.criticalRequests > 0) r.critical.push(`${r.criticalRequests} failed document/stylesheet/script request(s)`);
  const otherFailed = r.failedRequests - r.criticalRequests;
  if (otherFailed > 0) r.warnings.push(`${otherFailed} other failed request(s) (images, fonts, media, fetch/xhr)`);
  if (r.metaViewport === false) r.warnings.push('no <meta name="viewport"> tag: mobile browsers will lay the page out at desktop width');
  if (settings.reducedMotion && r.reducedMotion === false) r.warnings.push('reduced motion was requested but prefers-reduced-motion did not match in the page');
  if (r.axe && Array.isArray(r.axe.violations)) {
    const severe = r.axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    const minor = r.axe.violations.length - severe.length;
    if (severe.length) r.critical.push(`${severe.length} serious/critical axe violation(s): ${severe.map((v) => v.id).slice(0, 8).join(', ')}`);
    if (minor) r.warnings.push(`${minor} moderate/minor axe violation(s)`);
  }
  r.status = r.critical.length ? 'critical' : r.warnings.length ? 'warning' : 'ok';
  return r;
}

async function checkViewport(browser, href, vp, settings) {
  const r = {
    viewport: vp.label,
    width: vp.width,
    height: vp.height,
    status: 'ok',
    loaded: false,
    httpStatus: null,
    loadError: null,
    screenshot: null,
    overflowX: false,
    scrollWidth: null,
    clientWidth: null,
    viewportClipsX: false,
    consoleErrors: 0,
    failedRequests: 0,
    criticalRequests: 0,
    brokenImages: 0,
    wideElements: 0,
    reducedMotion: null,
    metaViewport: null,
    critical: [],
    warnings: [],
    notes: [],
    details: { consoleErrors: [], failedRequests: [], brokenImages: [], wideElements: [] },
  };
  const addConsole = (text) => {
    r.consoleErrors += 1;
    if (r.details.consoleErrors.length < MAX_DETAILS) r.details.consoleErrors.push(clip(text));
  };
  let context;
  try {
    context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      reducedMotion: settings.reducedMotion ? 'reduce' : 'no-preference',
      bypassCSP: Boolean(settings.axeSource),
    });
    const page = await context.newPage();
    const isMainNavigation = (req) => {
      try {
        return req.isNavigationRequest() && req.frame() === page.mainFrame();
      } catch {
        return false; // e.g. service-worker requests have no frame
      }
    };
    const addFailed = (entry) => {
      r.failedRequests += 1;
      if (CRITICAL_REQUEST_TYPES.has(entry.type)) r.criticalRequests += 1;
      if (r.details.failedRequests.length < MAX_DETAILS) r.details.failedRequests.push(entry);
    };
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (/^Failed to load resource\b/.test(text)) return; // reported under failedRequests
      addConsole(text);
    });
    page.on('pageerror', (err) => addConsole(`Uncaught ${err?.name ?? 'Error'}: ${err?.message ?? err}`));
    page.on('requestfailed', (req) => {
      if (isMainNavigation(req)) return; // goto() reports it
      const errorText = req.failure()?.errorText ?? 'failed';
      if (/ERR_ABORTED/i.test(errorText)) return; // cancelled by the page, not a failure
      addFailed({ url: displayUrl(req.url()), type: req.resourceType(), error: errorText });
    });
    page.on('response', (res) => {
      if (res.status() < 400) return;
      const req = res.request();
      if (isMainNavigation(req)) return;
      addFailed({ url: displayUrl(res.url()), type: req.resourceType(), status: res.status() });
    });

    let response;
    try {
      response = await page.goto(href, { waitUntil: 'load', timeout: settings.timeout });
    } catch (e) {
      r.loadError = clip(firstLine(e.message), 300);
      r.critical.push(`page failed to load: ${r.loadError}`);
      return classify(r, settings);
    }
    r.loaded = true;
    r.httpStatus = response ? response.status() : null;
    if (r.httpStatus !== null && r.httpStatus >= 400) r.critical.push(`main document responded with HTTP ${r.httpStatus}`);
    await page.waitForLoadState('networkidle', { timeout: Math.min(5000, settings.timeout) }).catch(() => {});
    if (settings.wait > 0) await page.waitForTimeout(settings.wait);

    let m;
    try {
      m = await page.evaluate(measurePage, { maxElements: MAX_ELEMENTS });
    } catch (e) {
      r.critical.push(`page could not be measured: ${clip(firstLine(e.message), 200)}`);
      return classify(r, settings);
    }
    r.clientWidth = m.clientWidth;
    r.scrollWidth = m.scrollWidth;
    r.viewportClipsX = m.viewportClipsX;
    r.overflowX = m.scrollWidth > m.clientWidth + 1;
    r.brokenImages = m.broken.length;
    r.details.brokenImages = m.broken.slice(0, MAX_DETAILS);
    r.wideElements = m.wideCount;
    r.details.wideElements = m.wideSamples;
    r.metaViewport = m.metaViewport;
    r.reducedMotion = m.reducedMotion;
    if (m.pendingImages) r.notes.push(`${m.pendingImages} image(s) had not finished loading (lazy or slow) and were not checked`);
    if (m.elementsTotal > m.elementsChecked) r.notes.push(`only the first ${m.elementsChecked} of ${m.elementsTotal} elements were checked for width`);

    const file = path.join(settings.outDir, `${vp.label}.png`);
    try {
      await page.screenshot({ path: file, fullPage: true, animations: 'disabled', timeout: settings.timeout });
      r.screenshot = file;
    } catch (e) {
      r.warnings.push(`screenshot failed: ${clip(firstLine(e.message), 200)}`);
    }

    if (settings.axeSource) {
      try {
        await page.addScriptTag({ content: settings.axeSource });
        const violations = await page.evaluate(async () => {
          const res = await window.axe.run(document, { resultTypes: ['violations'] });
          return res.violations.map((v) => ({ id: v.id, impact: v.impact ?? null, help: v.help, nodes: v.nodes.length }));
        });
        r.axe = { status: 'TESTED', violations };
      } catch (e) {
        r.axe = { status: 'ERROR', reason: clip(firstLine(e.message), 200) };
        r.warnings.push(`axe-core could not run: ${r.axe.reason}`);
      }
    }
    return classify(r, settings);
  } catch (e) {
    r.critical.push(`check failed: ${clip(firstLine(e.message), 200)}`);
    return classify(r, settings);
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

/**
 * Run the visual check. Never throws for page problems (they become critical findings); throws
 * UsageError for bad options. A page that fails to load is always critical, never ok.
 * @param {{url: string, viewports?: string|Array, outDir?: string, reducedMotion?: boolean,
 *   axe?: boolean, axeSource?: string, projectDir?: string, timeout?: number, wait?: number,
 *   cwd?: string, playwright?: object}} opts
 *   `playwright` injects a resolvePlaywright() result; `axeSource` injects an axe build (tests or
 *   a vendored copy) instead of resolving axe-core.
 * @returns {Promise<object>} summary; `overall.exitCode` is 0 ok, 1 critical, 4 blocked
 */
export async function runVisualCheck(opts = {}) {
  const target = normalizeTarget(opts.url, opts.cwd);
  const viewports = parseViewports(opts.viewports ?? DEFAULT_VIEWPORTS);
  const timeout = opts.timeout ?? 30000;
  const wait = opts.wait ?? 500;
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 300000) throw new UsageError('timeout must be an integer between 1000 and 300000 ms');
  if (!Number.isInteger(wait) || wait < 0 || wait > 60000) throw new UsageError('wait must be an integer between 0 and 60000 ms');
  const summary = {
    tool: 'visual-check',
    url: target.display,
    startedAt: new Date().toISOString(),
    options: { viewports: viewports.map((v) => v.label), reducedMotion: Boolean(opts.reducedMotion), axe: Boolean(opts.axe || opts.axeSource), timeoutMs: timeout, waitMs: wait },
    playwright: null,
    outDir: null,
    viewports: [],
    overall: null,
  };
  const blocked = (reason, extra = {}) => {
    summary.overall = { status: 'blocked', exitCode: EXIT.BLOCKED, reason, criticalCount: 0, warningCount: 0, viewportsChecked: 0, ...extra };
    summary.finishedAt = new Date().toISOString();
    return summary;
  };

  const pw = opts.playwright ?? (await resolvePlaywright({ projectDir: opts.projectDir }));
  if (!pw?.ok) {
    summary.playwright = { ok: false, tried: pw?.tried ?? [] };
    return blocked(pw?.reason ?? 'BLOCKED: playwright not resolvable');
  }
  summary.playwright = { ok: true, source: pw.source, package: pw.packageName, version: pw.version, path: pw.path };

  let axeSource = opts.axeSource ?? null;
  if (axeSource) {
    summary.axe = { status: 'injected', source: 'axeSource option' };
  } else if (opts.axe) {
    const axe = resolveAxe({ projectDir: opts.projectDir });
    if (axe.ok) {
      axeSource = readFileSync(axe.path, 'utf8');
      summary.axe = { status: 'available', source: axe.source, version: axe.version, path: axe.path };
    } else {
      summary.axe = { status: 'NOT_TESTED', reason: axe.reason };
    }
  }

  const launched = await launchChromium(pw.chromium, timeout);
  if (!launched.browser) return blocked('BLOCKED: no Chromium browser could be launched by Playwright', { launchErrors: launched.errors });
  summary.playwright.browser = launched.label;
  summary.playwright.browserVersion = launched.browser.version();

  const outDir = opts.outDir ? path.resolve(opts.outDir) : mkdtempSync(path.join(os.tmpdir(), 'visual-check-'));
  try {
    mkdirSync(outDir, { recursive: true });
    summary.outDir = outDir;
    const settings = { reducedMotion: Boolean(opts.reducedMotion), timeout, wait, outDir, axeSource };
    for (const vp of viewports) summary.viewports.push(await checkViewport(launched.browser, target.href, vp, settings));
  } finally {
    await launched.browser.close().catch(() => {});
  }
  const criticalCount = summary.viewports.reduce((n, v) => n + v.critical.length, 0);
  const warningCount = summary.viewports.reduce((n, v) => n + v.warnings.length, 0);
  const anyCritical = summary.viewports.some((v) => v.status === 'critical');
  summary.overall = {
    status: anyCritical ? 'critical' : 'ok',
    exitCode: anyCritical ? EXIT.CRITICAL : EXIT.OK,
    criticalCount,
    warningCount,
    viewportsChecked: summary.viewports.length,
  };
  summary.finishedAt = new Date().toISOString();
  writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

const HELP = `Usage: node scripts/visual-check.mjs --url <url|file> [options]

Opens the page in headless Chromium (Playwright) at each viewport and prints a JSON summary:
per viewport a full-page screenshot, horizontal overflow, console errors (including uncaught
exceptions), failed requests, broken images, elements extending past the viewport, and the
prefers-reduced-motion state; plus an overall status.

Options:
  --url <url|file>      http(s):// URL, file:// URL, or a local HTML file / folder with index.html.
  --viewports <list>    Comma-separated WIDTHxHEIGHT list (default ${DEFAULT_VIEWPORTS.join(',')}).
  --out <dir>           Folder for <WxH>.png screenshots and summary.json (created if needed; files
                        with those names are replaced). Default: a new folder in the OS temp dir.
  --reduced-motion      Emulate prefers-reduced-motion: reduce.
  --axe                 Run axe-core if it resolves from the project or the global npm root;
                        otherwise the summary reports axe as NOT_TESTED.
  --project <dir>       Where to resolve playwright and axe-core from first (default: current dir).
  --timeout <ms>        Navigation timeout (default 30000).
  --wait <ms>           Extra settle time after load and network idle (default 500).
  -h, --help            Show this help.

Critical (exit 1): the page fails to load or responds HTTP >= 400, horizontal scrolling,
broken images, console errors or uncaught exceptions, failed document/stylesheet/script
requests, serious or critical axe violations. Warnings (exit 0): other failed requests,
overflow clipped by html/body, missing meta viewport, moderate or minor axe violations.
"Failed to load resource" console lines are counted under failedRequests, not consoleErrors.

Exit codes:
  0   no critical issue at any viewport
  1   at least one critical issue (a page that fails to load is always critical)
  2   the check itself failed unexpectedly
  4   BLOCKED: playwright not resolvable, or no Chromium could be launched
  64  usage error
`;

/**
 * CLI entry point.
 * @param {string[]} argv
 * @returns {Promise<number>} exit code
 */
export async function main(argv) {
  let args;
  try {
    ({ values: args } = parseArgs({
      args: argv,
      options: {
        url: { type: 'string' },
        viewports: { type: 'string' },
        out: { type: 'string' },
        'reduced-motion': { type: 'boolean', default: false },
        axe: { type: 'boolean', default: false },
        project: { type: 'string' },
        timeout: { type: 'string' },
        wait: { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n\n${HELP}`);
    return EXIT.USAGE;
  }
  if (args.help) {
    process.stdout.write(HELP);
    return EXIT.OK;
  }
  const toInt = (value, name) => {
    if (value === undefined) return undefined;
    if (!/^\d+$/.test(value)) throw new UsageError(`--${name} must be a whole number of milliseconds`);
    return Number(value);
  };
  let summary;
  try {
    if (args.project && !existsSync(args.project)) throw new UsageError(`--project folder not found: ${path.resolve(args.project)}`);
    summary = await runVisualCheck({
      url: args.url,
      viewports: args.viewports ?? DEFAULT_VIEWPORTS,
      outDir: args.out,
      reducedMotion: args['reduced-motion'],
      axe: args.axe,
      projectDir: args.project,
      timeout: toInt(args.timeout, 'timeout'),
      wait: toInt(args.wait, 'wait'),
    });
  } catch (e) {
    if (e instanceof UsageError) {
      process.stderr.write(`Error: ${e.message}\n\n${HELP}`);
      return EXIT.USAGE;
    }
    throw e;
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.overall.status === 'blocked') {
    process.stderr.write(`${summary.overall.reason}\n`);
  } else {
    for (const v of summary.viewports) {
      const reasons = v.critical.length ? v.critical : v.warnings;
      process.stderr.write(`${v.viewport.padEnd(10)} ${v.status.padEnd(8)} ${reasons.join(' | ')}\n`);
    }
    process.stderr.write(`overall: ${summary.overall.status} (screenshots in ${summary.outDir})\n`);
  }
  return summary.overall.exitCode;
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      process.stderr.write(`Unexpected error: ${e?.stack ?? e}\n`);
      process.exitCode = EXIT.ERROR;
    },
  );
}
