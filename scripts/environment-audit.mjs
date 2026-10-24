#!/usr/bin/env node
// Environment audit for the ultimate-uiux skill (build spec section 7).
// Zero dependencies; Node >= 18 ESM; Windows and POSIX.
//
// Detects runtimes and CLIs (where/which + a version probe, 5 s timeout each), Chrome/Edge at
// known install paths, Playwright browser downloads, installed skills (directory names only) and a
// project profile from package.json + lockfiles. Output conforms to
// schemas/capability-registry.schema.json (object form).
//
// Privacy: never prints environment variable values, never reads ~/.claude/settings.json or any
// settings file, never reads skill contents (only checks that SKILL.md exists). Paths under the
// home directory are reported as "~". Commands are spawned with an argument array; the only
// cmd.exe use (Windows .cmd/.bat shims) passes a validated path plus constant flags.

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { validate, formatErrors } from './lib/schema.mjs';
import { PACKAGE_ROOT, writeFileSafe, isMainModule } from './lib/fsutil.mjs';

/** Process exit codes. */
export const EXIT = Object.freeze({ OK: 0, INVALID_OUTPUT: 1, ERROR: 2, USAGE: 64 });

/** Per-probe timeout (spawned process), in milliseconds. */
export const PROBE_TIMEOUT_MS = 5000;

/** Status vocabulary (schemas/capability-registry.schema.json #/$defs/status). */
export const STATUSES = Object.freeze([
  'available-verified',
  'available-untested',
  'available-with-prerequisites',
  'unavailable',
  'requires-credentials',
  'requires-approval',
  'unknown',
]);

/** Evidence text for capabilities a script cannot see. */
export const IN_SESSION_EVIDENCE = 'probe in-session via ToolSearch';

const IS_WIN = process.platform === 'win32';
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const SAFE_ARG = /^-{0,2}[A-Za-z0-9][A-Za-z0-9-]*$/;
const CMD_UNSAFE = /["%!^&|<>\r\n]/;
const VERSION_RE = /\b[vV]?(\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z._-]+)?)/;
const MAX_SKILL_DIRS = 3000;

const SCHEMA_PATH = path.join(PACKAGE_ROOT, 'schemas', 'capability-registry.schema.json');

/** CLIs and runtimes to probe. */
export const CLI_SPECS = Object.freeze([
  { name: 'node', category: 'runtime', fallback: 'Required for every script in scripts/. Install Node.js 18 or newer.' },
  { name: 'npm', category: 'cli', fallback: 'Use pnpm, yarn or bun if present.' },
  { name: 'pnpm', category: 'cli', fallback: 'Use the package manager the project lockfile names; npm otherwise.' },
  { name: 'yarn', category: 'cli', fallback: 'Use the package manager the project lockfile names; npm otherwise.' },
  { name: 'bun', category: 'runtime', fallback: 'Use node + npm/pnpm.' },
  { name: 'python', category: 'runtime', fallback: 'Use Node.js scripts; skip Python-only tooling.' },
  { name: 'python3', category: 'runtime', fallback: 'Use "python" if it is Python 3; otherwise Node.js scripts.' },
  { name: 'git', category: 'cli', fallback: 'Copy files before risky edits instead of relying on git history.' },
  { name: 'gh', category: 'cli', fallback: 'Use the GitHub web UI; ask the user to run gh commands.' },
  { name: 'ffmpeg', category: 'cli', versionArgs: ['-version'], fallback: 'Ship media as delivered with a poster/static fallback; mark transcoding as not done.' },
  { name: 'ffprobe', category: 'cli', versionArgs: ['-version'], fallback: 'asset-validation reports non-WAV durations as not-tested.' },
  { name: 'blender', category: 'cli', fallback: 'Use ready-made GLB files or procedural three.js geometry.' },
  { name: 'magick', category: 'cli', versionArgs: ['-version'], fallback: 'Use sharp/squoosh in the project or browser-native formats; record optimization as pending.' },
  { name: 'playwright', category: 'cli', fallback: 'visual-check exits 4 (BLOCKED); use the in-session browser tools or manual screenshots.' },
  { name: 'lighthouse', category: 'cli', fallback: 'Use Chrome DevTools MCP lighthouse_audit or performance traces, else mark Gate E NOT_TESTED.' },
  { name: 'vercel', category: 'cli', fallback: 'Deploying is publishing and needs approval; hand the user build output instead.' },
]);

// ---------------------------------------------------------------------------------------------
// Path display (home directory and LOCALAPPDATA are never printed in full)
// ---------------------------------------------------------------------------------------------

const slash = (p) => String(p).replace(/\\/g, '/');

function prefixes() {
  const list = [];
  const local = process.env.LOCALAPPDATA;
  if (local) list.push([slash(path.resolve(local)), '%LOCALAPPDATA%']);
  const home = os.homedir();
  if (home) list.push([slash(path.resolve(home)), '~']);
  return list;
}

/**
 * Replace the home directory (and %LOCALAPPDATA% on Windows) at the start of paths in a string.
 * @param {string} text
 * @returns {string}
 */
export function redactPaths(text) {
  let out = String(text);
  for (const [prefix, label] of prefixes()) {
    if (!prefix || prefix === '/') continue;
    const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '[\\\\/]');
    out = out.replace(new RegExp(esc, IS_WIN ? 'gi' : 'g'), label);
  }
  return out;
}

/** Display form of a path: forward slashes, home shown as "~". */
export function displayPath(p) {
  return redactPaths(slash(p));
}

function redactDeep(value) {
  if (typeof value === 'string') return redactPaths(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v);
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------------------------
// Small fs helpers (synchronous; every call is guarded)
// ---------------------------------------------------------------------------------------------

function statSafe(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}
const isFile = (p) => Boolean(statSafe(p)?.isFile());
const isDir = (p) => Boolean(statSafe(p)?.isDirectory());

function listDir(p) {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
}

function readJsonSafe(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function readTextSafe(p, limit = 8 * 1024 * 1024) {
  const st = statSafe(p);
  if (!st || !st.isFile() || st.size > limit) return null;
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------------------------------------------------------------------------------------------
// Command location and version probes
// ---------------------------------------------------------------------------------------------

function spawnOpts(extra = {}) {
  return {
    encoding: 'utf8',
    timeout: PROBE_TIMEOUT_MS,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1024 * 1024,
    ...extra,
  };
}

function pathExts() {
  const raw = process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD';
  return raw.split(';').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/** Order Windows candidates: real executables first, then .cmd/.bat shims; drop extensionless files. */
function rankWindows(candidates) {
  const exts = pathExts();
  const rank = (p) => {
    const ext = path.extname(p).toLowerCase();
    if (ext === '.exe') return 0;
    if (ext === '.com') return 1;
    if (ext === '.cmd' || ext === '.bat') return 2;
    return exts.includes(ext) ? 3 : 99;
  };
  return candidates.filter((p) => rank(p) < 99).sort((a, b) => rank(a) - rank(b));
}

function scanPath(name) {
  const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const exts = IS_WIN ? pathExts() : [''];
  const hits = [];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      if (isFile(candidate)) hits.push(candidate);
    }
  }
  return hits;
}

/**
 * Locate a command on PATH with `where` (Windows) or `which` (POSIX); falls back to scanning PATH
 * when the locator itself cannot run.
 * @param {string} name
 * @returns {{path: string|null, method: string}}
 */
export function locateCommand(name) {
  if (!SAFE_NAME.test(String(name))) throw new TypeError(`unsafe command name: ${JSON.stringify(name)}`);
  const locator = IS_WIN ? 'where.exe' : 'which';
  // "$PATH:<name>" restricts where.exe to PATH (it would otherwise search the current directory).
  const args = IS_WIN ? [`$PATH:${name}`] : [name];
  const r = spawnSync(locator, args, spawnOpts());
  let candidates;
  let method;
  if (r.error) {
    candidates = scanPath(name);
    method = 'PATH scan';
  } else {
    candidates = r.status === 0 ? r.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
    method = IS_WIN ? 'where' : 'which';
  }
  if (IS_WIN) candidates = rankWindows(candidates);
  return { path: candidates[0] ?? null, method };
}

function runFile(file, args) {
  if (!args.every((a) => SAFE_ARG.test(a))) return { error: new Error('unsafe probe argument') };
  if (IS_WIN && /\.(cmd|bat)$/i.test(file)) {
    // Node refuses to spawn .cmd/.bat directly (CVE-2024-27980). Run the shim through cmd.exe with
    // a validated, quoted path and constant flags only.
    if (CMD_UNSAFE.test(file)) return { error: new Error('path contains characters unsafe for cmd.exe') };
    const comspec = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe');
    return spawnSync(comspec, ['/d', '/s', '/c', `""${file}" ${args.join(' ')}"`], spawnOpts({ windowsVerbatimArguments: true }));
  }
  return spawnSync(file, args, spawnOpts());
}

/**
 * Parse a version number from command output.
 * @param {string} text
 * @returns {string|null}
 */
export function parseVersion(text) {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 5);
  for (const line of lines) {
    const m = line.match(VERSION_RE);
    if (m) return m[1];
  }
  return null;
}

function knownBlenderPaths() {
  const out = [];
  if (IS_WIN) {
    for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean)) {
      const root = path.join(base, 'Blender Foundation');
      for (const d of listDir(root).sort().reverse()) out.push(path.join(root, d, 'blender.exe'));
    }
  } else if (process.platform === 'darwin') {
    out.push('/Applications/Blender.app/Contents/MacOS/Blender');
  } else {
    out.push('/snap/bin/blender', '/usr/bin/blender', '/usr/local/bin/blender');
  }
  return out;
}

/**
 * Probe one CLI: locate it, run its version flag (5 s timeout) and build a registry entry.
 * found + version = available-verified; found, version failed = available-untested;
 * not found = unavailable.
 * @param {{name: string, category?: string, versionArgs?: string[], fallback?: string, knownPaths?: string[]}} spec
 * @returns {object} capability entry
 */
export function probeCommand(spec) {
  const s = typeof spec === 'string' ? { name: spec } : spec;
  if (!s || !SAFE_NAME.test(String(s.name))) throw new TypeError(`unsafe command name: ${JSON.stringify(s?.name)}`);
  const versionArgs = s.versionArgs ?? ['--version'];
  const category = s.category ?? 'cli';
  const entry = {
    id: `${category}:${s.name}`,
    name: s.name,
    category,
    status: 'unavailable',
    provider: null,
    environment: 'local CLI (PATH)',
    cost: 'free',
    network: 'none',
    verifiedOn: today(),
  };
  if (s.fallback) entry.fallback = s.fallback;

  let { path: found, method } = locateCommand(s.name);
  if (!found) {
    const known = (s.knownPaths ?? (s.name === 'blender' ? knownBlenderPaths() : [])).find(isFile);
    if (known) {
      found = known;
      method = 'known install path';
      entry.environment = 'local install (not on PATH)';
    }
  }
  if (!found) {
    entry.evidence = `${method === 'PATH scan' ? 'PATH scan' : `${method} ${s.name}`}: not found`;
    return entry;
  }
  entry.path = displayPath(found);
  const r = runFile(found, versionArgs);
  const cmdText = `${s.name} ${versionArgs.join(' ')}`;
  const version = !r.error && r.status === 0 ? parseVersion(`${r.stdout ?? ''}\n${r.stderr ?? ''}`) : null;
  if (version) {
    entry.status = 'available-verified';
    entry.version = version;
    entry.evidence = `${method}: ${entry.path}; \`${cmdText}\` -> ${version}`;
  } else {
    entry.status = 'available-untested';
    const why = r.error
      ? r.error.code === 'ETIMEDOUT' ? `timed out after ${PROBE_TIMEOUT_MS} ms` : `could not run (${r.error.code ?? r.error.message})`
      : r.status !== 0 ? `exit code ${r.status}` : 'no version in the output';
    entry.evidence = `${method}: ${entry.path}; \`${cmdText}\` failed: ${why}`;
    if (IS_WIN && /[\\/]WindowsApps[\\/]/i.test(found)) entry.evidence += ' (Microsoft Store app-execution alias; may be a stub)';
  }
  return entry;
}

// ---------------------------------------------------------------------------------------------
// Browsers
// ---------------------------------------------------------------------------------------------

function browserCandidates() {
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA;
  if (IS_WIN) {
    return {
      chrome: [path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'), local && path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe')].filter(Boolean),
      edge: [path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe')],
    };
  }
  if (process.platform === 'darwin') {
    return {
      chrome: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')],
      edge: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    };
  }
  return {
    chrome: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
    edge: ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable', '/opt/microsoft/msedge/msedge'],
  };
}

function browserVersion(exe) {
  if (IS_WIN) {
    // chrome.exe --version opens a window on Windows; read the versioned sibling folder instead.
    const versions = listDir(path.dirname(exe)).filter((d) => /^\d+\.\d+\.\d+\.\d+$/.test(d) && isDir(path.join(path.dirname(exe), d)));
    versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    return versions[0] ? { version: versions[0], how: 'versioned folder next to the executable' } : null;
  }
  if (process.platform === 'darwin') {
    const plist = readTextSafe(path.join(exe, '..', '..', 'Info.plist'), 1024 * 1024);
    const m = plist?.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
    return m ? { version: m[1], how: 'Info.plist' } : null;
  }
  const r = runFile(exe, ['--version']);
  const v = !r.error && r.status === 0 ? parseVersion(r.stdout) : null;
  return v ? { version: v, how: '--version' } : null;
}

/** Detect Chrome and Edge at known install paths. @returns {object[]} entries */
export function detectBrowsers() {
  const names = { chrome: 'Google Chrome', edge: 'Microsoft Edge' };
  const cands = browserCandidates();
  return Object.entries(cands).map(([key, list]) => {
    const entry = {
      id: `browser:${key}`,
      name: names[key],
      category: 'browser',
      status: 'unavailable',
      environment: 'local install',
      cost: 'free',
      network: 'local',
      verifiedOn: today(),
      fallback: key === 'chrome' ? 'Use Edge, Playwright Chromium or the in-session browser tools.' : 'Use Chrome or Playwright Chromium.',
    };
    const found = list.find(isFile);
    if (!found) {
      entry.evidence = `not found at known paths (${list.length} checked)`;
      return entry;
    }
    entry.path = displayPath(found);
    const v = browserVersion(found);
    if (v) {
      entry.status = 'available-verified';
      entry.version = v.version;
      entry.evidence = `found at ${entry.path}; version ${v.version} from ${v.how}`;
    } else {
      entry.status = 'available-untested';
      entry.evidence = `found at ${entry.path}; version not determined (browser not launched)`;
    }
    return entry;
  });
}

/** Detect Playwright browser downloads (ms-playwright cache). @returns {object} entry */
export function detectPlaywrightBrowsers() {
  const candidates = [];
  const custom = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (custom && custom !== '0') candidates.push({ dir: custom, label: '$PLAYWRIGHT_BROWSERS_PATH' });
  if (IS_WIN && process.env.LOCALAPPDATA) candidates.push({ dir: path.join(process.env.LOCALAPPDATA, 'ms-playwright') });
  if (process.platform === 'darwin') candidates.push({ dir: path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright') });
  if (!IS_WIN) candidates.push({ dir: path.join(os.homedir(), '.cache', 'ms-playwright') });
  const entry = {
    id: 'browser:playwright-browsers',
    name: 'Playwright browser downloads',
    category: 'browser',
    status: 'unavailable',
    environment: 'local cache',
    dependencies: ['cli:playwright or a project playwright dependency'],
    cost: 'free',
    network: 'local',
    verifiedOn: today(),
    fallback: '`npx playwright install chromium` downloads a browser (about 150 MB): ask before installing.',
  };
  for (const c of candidates) {
    if (!isDir(c.dir)) continue;
    const builds = listDir(c.dir).filter((d) => /^(chromium|chromium_headless_shell|firefox|webkit|ffmpeg)[-_]/i.test(d) && isDir(path.join(c.dir, d))).sort();
    const shown = c.label ?? displayPath(c.dir);
    entry.builds = builds;
    if (builds.some((b) => /^chromium/i.test(b))) {
      entry.status = 'available-untested';
      entry.evidence = `${shown} contains ${builds.join(', ')}; not launched (run scripts/visual-check.mjs to verify)`;
    } else {
      entry.evidence = `${shown} exists but holds no Chromium build${builds.length ? ` (${builds.join(', ')})` : ''}`;
    }
    return entry;
  }
  entry.evidence = `no ms-playwright directory at ${candidates.map((c) => c.label ?? displayPath(c.dir)).join(', ') || 'any known location'}`;
  return entry;
}

// ---------------------------------------------------------------------------------------------
// Capabilities a script cannot see (MCP servers, generators)
// ---------------------------------------------------------------------------------------------

const IN_SESSION = Object.freeze([
  { id: 'mcp:chrome-devtools', name: 'Chrome DevTools MCP', category: 'mcp', cost: 'free', network: 'local', fallback: 'scripts/visual-check.mjs (Playwright) or manual DevTools.' },
  { id: 'mcp:claude-browser', name: 'Built-in browser pane tools', category: 'mcp', cost: 'free', network: 'local', fallback: 'Chrome DevTools MCP or scripts/visual-check.mjs.' },
  { id: 'mcp:threejs-view', name: 'Three.js scene preview MCP', category: 'mcp', cost: 'free', network: 'local', fallback: 'Run the scene in the project dev server.' },
  { id: 'mcp:figma', name: 'Figma MCP', category: 'mcp', cost: 'unknown', network: 'external', fallback: 'Work from screenshots or exported tokens supplied by the user.' },
  { id: 'mcp:vercel', name: 'Vercel MCP', category: 'mcp', cost: 'unknown', network: 'external', fallback: 'Hand the user the build output; deploying needs approval.' },
  { id: 'generator:image', name: 'Image generation (any MCP or API)', category: 'generator', cost: 'paid or credit-based until proven otherwise', network: 'external', fallback: 'Procedural CSS/SVG/canvas graphics or user-supplied images.' },
  { id: 'generator:video', name: 'Video generation (any MCP or API)', category: 'generator', cost: 'paid or credit-based until proven otherwise', network: 'external', fallback: 'CSS/WebGL motion, a static poster, or user-supplied footage.' },
  { id: 'generator:audio', name: 'Audio generation (any MCP or API)', category: 'generator', cost: 'paid or credit-based until proven otherwise', network: 'external', fallback: 'Web Audio synthesis or licensed (e.g. CC0) audio.' },
  { id: 'generator:3d', name: '3D model generation (any MCP or API)', category: 'generator', cost: 'paid or credit-based until proven otherwise', network: 'external', fallback: 'Procedural three.js geometry or licensed GLB files.' },
]);

function inSessionEntries() {
  return IN_SESSION.map((e) => ({ ...e, status: 'unknown', evidence: IN_SESSION_EVIDENCE, environment: 'Claude session (not visible to scripts)', verifiedOn: null }));
}

// ---------------------------------------------------------------------------------------------
// Installed skills (names only)
// ---------------------------------------------------------------------------------------------

function skillNamesIn(root, maxDepth = 3) {
  const names = new Set();
  let visited = 0;
  const visit = (dir, depth) => {
    for (const name of listDir(dir)) {
      if (visited++ > MAX_SKILL_DIRS) return;
      if (name.startsWith('.') || name === 'node_modules') continue;
      const p = path.join(dir, name);
      if (!isDir(p)) continue;
      if (isFile(path.join(p, 'SKILL.md'))) names.add(name);
      else if (depth < maxDepth) visit(p, depth + 1);
    }
  };
  visit(root, 1);
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Installed skills: ~/.claude/skills, ~/.agents/skills, <project>/.claude/skills and plugin caches
 * (~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/skills/<skill>/SKILL.md). Names only;
 * no file contents are read.
 * @param {{project?: string|null, home?: string}} [options]
 */
export function detectSkills(options = {}) {
  const home = options.home ?? os.homedir();
  const roots = [path.join(home, '.claude', 'skills'), path.join(home, '.agents', 'skills')];
  if (options.project) roots.push(path.join(options.project, '.claude', 'skills'));
  const rootRecords = roots.map((r) => {
    const found = isDir(r);
    return { root: displayPath(r), found, names: found ? skillNamesIn(r) : [] };
  });
  const plugins = [];
  const cache = path.join(home, '.claude', 'plugins', 'cache');
  for (const market of listDir(cache)) {
    for (const plugin of listDir(path.join(cache, market))) {
      for (const version of listDir(path.join(cache, market, plugin))) {
        const skillsDir = path.join(cache, market, plugin, version, 'skills');
        if (!isDir(skillsDir)) continue;
        const names = listDir(skillsDir).filter((n) => isFile(path.join(skillsDir, n, 'SKILL.md'))).sort();
        if (names.length) plugins.push({ plugin: `${market}/${plugin}`, version, names });
      }
    }
  }
  const all = new Set([...rootRecords.flatMap((r) => r.names), ...plugins.flatMap((p) => p.names)]);
  return {
    roots: rootRecords,
    plugins,
    total: rootRecords.reduce((n, r) => n + r.names.length, 0) + plugins.reduce((n, p) => n + p.names.length, 0),
    uniqueNames: all.size,
  };
}

// ---------------------------------------------------------------------------------------------
// Project profile
// ---------------------------------------------------------------------------------------------

const FRAMEWORKS = Object.freeze([
  ['next', 'next'],
  ['nuxt', 'nuxt'],
  ['@remix-run/react', 'remix'],
  ['@react-router/dev', 'react-router (framework)'],
  ['astro', 'astro'],
  ['@sveltejs/kit', 'sveltekit'],
  ['gatsby', 'gatsby'],
  ['@solidjs/start', 'solid-start'],
  ['@angular/core', 'angular'],
  ['vue', 'vue'],
  ['svelte', 'svelte'],
  ['solid-js', 'solid'],
  ['preact', 'preact'],
  ['react', 'react'],
]);
const BUNDLERS = Object.freeze(['vite', 'webpack', 'parcel', '@rsbuild/core', 'esbuild', 'turbo']);
const STYLING = Object.freeze(['tailwindcss', 'styled-components', '@emotion/react', 'sass', 'less', '@vanilla-extract/css', '@pandacss/dev', 'unocss', '@stitches/react', 'postcss']);
const UI_KITS = Object.freeze([
  ['@mui/material', 'mui'], ['@chakra-ui/react', 'chakra-ui'], ['antd', 'antd'], ['@mantine/core', 'mantine'],
  ['@headlessui/react', 'headless-ui'], ['daisyui', 'daisyui'], ['@heroui/react', 'heroui'], ['@nextui-org/react', 'nextui'],
  ['react-aria-components', 'react-aria'], ['bits-ui', 'bits-ui'], ['vuetify', 'vuetify'], ['primevue', 'primevue'],
  ['@ark-ui/react', 'ark-ui'], ['flowbite', 'flowbite'],
]);
const ANIMATION = Object.freeze(['framer-motion', 'motion', 'gsap', '@gsap/react', 'lenis', '@studio-freight/lenis', 'animejs', '@react-spring/web', 'lottie-web', '@lottiefiles/dotlottie-web', '@lottiefiles/react-lottie-player', '@formkit/auto-animate', 'locomotive-scroll', 'aos', 'popmotion', '@theatre/core']);
const THREE_D = Object.freeze(['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing', 'ogl', '@babylonjs/core', 'babylonjs', '@splinetool/react-spline', '@splinetool/runtime', 'pixi.js', 'troika-three-text', '@tresjs/core', 'threlte', '@threlte/core', 'playcanvas']);
const TEST_TOOLS = Object.freeze(['vitest', 'jest', '@playwright/test', 'playwright', 'cypress', '@testing-library/react', '@testing-library/vue', '@testing-library/svelte', '@testing-library/jest-dom', 'storybook', '@storybook/react', '@storybook/nextjs', 'axe-core', '@axe-core/playwright', 'lighthouse', '@lhci/cli', 'backstopjs', 'chromatic', 'mocha', '@web/test-runner']);
const LOCKFILES = Object.freeze([
  ['pnpm-lock.yaml', 'pnpm'], ['package-lock.json', 'npm'], ['npm-shrinkwrap.json', 'npm'], ['yarn.lock', 'yarn'], ['bun.lockb', 'bun'], ['bun.lock', 'bun'],
]);

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

function lockVersion(dir, lockfiles, pkg) {
  for (const lf of lockfiles) {
    const p = path.join(dir, lf);
    if (lf === 'package-lock.json' || lf === 'npm-shrinkwrap.json') {
      const lock = readJsonSafe(p);
      const v = lock?.packages?.[`node_modules/${pkg}`]?.version ?? lock?.dependencies?.[pkg]?.version;
      if (typeof v === 'string') return { version: v, source: lf };
    } else if (lf === 'pnpm-lock.yaml') {
      const text = readTextSafe(p);
      const m = text?.match(new RegExp(`\\n\\s+'?${escRe(pkg)}'?:\\n\\s+specifier: [^\\n]+\\n\\s+version: '?(\\d[^\\s('"]*)`));
      if (m) return { version: m[1], source: lf };
    } else if (lf === 'yarn.lock') {
      const text = readTextSafe(p);
      const m = text?.match(new RegExp(`(?:^|\\n)"?${escRe(pkg)}@[^\\n]*:\\n\\s+version:? "?(\\d[^"\\s]*)`));
      if (m) return { version: m[1], source: lf };
    }
  }
  return null;
}

function resolveVersion(dir, deps, lockfiles, pkg) {
  const installed = readJsonSafe(path.join(dir, 'node_modules', ...pkg.split('/'), 'package.json'));
  if (typeof installed?.version === 'string') return { version: installed.version, source: 'node_modules' };
  const locked = lockVersion(dir, lockfiles, pkg);
  if (locked) return locked;
  const declared = deps[pkg];
  if (typeof declared !== 'string') return { version: null, source: null };
  const m = declared.match(/\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.]+)?/);
  return { version: m ? m[0] : null, declared, source: 'package.json (declared range)' };
}

const majorOf = (v) => {
  const m = String(v ?? '').match(/\d+/);
  return m ? Number(m[0]) : null;
};

/**
 * Build a project profile from package.json, lockfiles and a few marker files.
 * @param {string} dir project root
 * @returns {object}
 */
export function profileProject(dir) {
  const root = path.resolve(dir);
  const pkg = readJsonSafe(path.join(root, 'package.json'));
  const lockfiles = LOCKFILES.map(([f]) => f).filter((f) => isFile(path.join(root, f)));
  const profile = { root: displayPath(root), packageJson: Boolean(pkg), lockfiles, notes: [] };
  if (!pkg || typeof pkg !== 'object') {
    profile.notes.push(isFile(path.join(root, 'package.json')) ? 'package.json is not valid JSON' : 'no package.json (static site or non-Node project)');
    profile.static = isFile(path.join(root, 'index.html'));
    return profile;
  }
  const deps = { ...(pkg.peerDependencies ?? {}), ...(pkg.devDependencies ?? {}), ...(pkg.dependencies ?? {}) };
  const has = (n) => Object.prototype.hasOwnProperty.call(deps, n);
  const present = (list) => list.filter(has).map((n) => ({ name: n, range: deps[n] }));
  profile.name = typeof pkg.name === 'string' ? pkg.name : null;

  // Package manager: packageManager field > lockfile > none.
  if (typeof pkg.packageManager === 'string' && /^[a-z]+@/.test(pkg.packageManager)) {
    const [name, version] = pkg.packageManager.split('@');
    profile.packageManager = { name, version: version?.split('+')[0] ?? null, source: 'package.json packageManager' };
  } else if (lockfiles.length) {
    const name = LOCKFILES.find(([f]) => f === lockfiles[0])[1];
    profile.packageManager = { name, version: null, source: lockfiles[0] };
    if (new Set(lockfiles.map((f) => LOCKFILES.find(([x]) => x === f)[1])).size > 1) profile.notes.push(`multiple lockfiles (${lockfiles.join(', ')}); keep one`);
  } else {
    profile.packageManager = null;
  }

  const fw = FRAMEWORKS.find(([dep]) => has(dep));
  profile.framework = fw ? { name: fw[1], package: fw[0], ...resolveVersion(root, deps, lockfiles, fw[0]) } : null;
  if (profile.framework && fw[0] !== 'react' && has('react')) profile.framework.react = resolveVersion(root, deps, lockfiles, 'react').version;
  profile.bundler = BUNDLERS.filter(has);

  // Router
  const dirIn = (...names) => names.some((n) => isDir(path.join(root, n)));
  let router = null;
  if (fw?.[1] === 'next') {
    const app = dirIn('app', 'src/app');
    const pages = dirIn('pages', 'src/pages');
    router = app && pages ? 'next app + pages router' : app ? 'next app router' : pages ? 'next pages router' : 'next (router not determined)';
  } else if (['nuxt', 'sveltekit', 'astro', 'remix', 'react-router (framework)', 'gatsby', 'solid-start'].includes(fw?.[1])) {
    router = `${fw[1]} file-based routing`;
  } else if (has('@tanstack/react-router')) router = '@tanstack/react-router';
  else if (has('react-router-dom') || has('react-router')) router = 'react-router';
  else if (has('vue-router')) router = 'vue-router';
  else if (has('@angular/router')) router = '@angular/router';
  else if (has('wouter')) router = 'wouter';
  else if (has('@solidjs/router')) router = '@solidjs/router';
  profile.router = router;

  // Styling (Tailwind major from the resolved version; v4 also implied by its PostCSS/Vite plugins)
  let tailwind = null;
  if (has('tailwindcss') || has('@tailwindcss/postcss') || has('@tailwindcss/vite')) {
    const v = has('tailwindcss') ? resolveVersion(root, deps, lockfiles, 'tailwindcss') : { version: null, source: null };
    let major = majorOf(v.version);
    if (major === null && (has('@tailwindcss/postcss') || has('@tailwindcss/vite'))) major = 4;
    tailwind = { version: v.version, major, source: v.source ?? 'tailwind v4 plugin' };
  }
  profile.styling = { tailwind, libraries: present(STYLING) };

  const kits = UI_KITS.filter(([d]) => has(d)).map(([d, label]) => ({ name: label, package: d }));
  if (isFile(path.join(root, 'components.json'))) kits.unshift({ name: 'shadcn/ui', package: 'components.json' });
  if (Object.keys(deps).some((d) => d.startsWith('@radix-ui/'))) kits.push({ name: 'radix-ui', package: '@radix-ui/*' });
  profile.uiKits = kits;
  profile.animation = present(ANIMATION);
  profile.threeD = present(THREE_D);
  profile.testTools = present(TEST_TOOLS);
  profile.typescript = has('typescript') || isFile(path.join(root, 'tsconfig.json'));
  profile.engines = pkg.engines && typeof pkg.engines === 'object' ? pkg.engines : null;
  profile.scripts = pkg.scripts && typeof pkg.scripts === 'object' ? Object.keys(pkg.scripts) : [];
  return profile;
}

// ---------------------------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------------------------

let cachedSchema = null;
/** Load the capability-registry schema (cached). */
export function loadRegistrySchema() {
  if (!cachedSchema) cachedSchema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  return cachedSchema;
}

/**
 * Run the full audit.
 * @param {{project?: string|null, commands?: object[]}} [options]
 * @returns {Promise<object>} object conforming to schemas/capability-registry.schema.json
 */
export async function audit(options = {}) {
  const project = options.project ? path.resolve(options.project) : null;
  const specs = options.commands ?? CLI_SPECS;
  const entries = [...specs.map(probeCommand), ...detectBrowsers(), detectPlaywrightBrowsers(), ...inSessionEntries()];
  const result = {
    $schema: '../schemas/capability-registry.schema.json',
    generatedAt: new Date().toISOString(),
    platform: { os: process.platform, release: os.release(), arch: process.arch, node: process.version },
    entries,
    skills: detectSkills({ project }),
    project: project ? profileProject(project) : null,
    notes: [
      `MCP servers and generators cannot be detected from a script (status unknown): ${IN_SESSION_EVIDENCE}, then make one harmless read-only call.`,
      'Statuses are a snapshot of this machine at generatedAt; re-run before relying on them.',
      'Generators and external services are paid or data-sharing until proven otherwise: they require approval before use.',
      'Paths under the home directory are shown as ~; environment variable values and settings files are never read into the output.',
      'Skills are listed by directory name only; their contents are not read.',
    ],
  };
  return redactDeep(result);
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

const HELP = `Usage: node scripts/environment-audit.mjs [--project <dir>] [--out <file> [--force]]

Detects what this machine can really do and prints a JSON capability audit that conforms to
schemas/capability-registry.schema.json (object form: generatedAt, platform, entries[], skills,
project, notes). Read-only and offline.

  entries    runtimes and CLIs (node, npm, pnpm, yarn, bun, python, python3, git, gh, ffmpeg,
             ffprobe, blender, magick, playwright, lighthouse, vercel) located with where/which
             and probed with their version flag (5 s timeout each); Chrome and Edge at known
             install paths; Playwright browser downloads (ms-playwright); MCP servers and
             generators as "unknown" (probe in-session via ToolSearch)
  status     found + version = available-verified; found, version failed = available-untested;
             not found = unavailable
  skills     names of installed skills in ~/.claude/skills, ~/.agents/skills,
             <project>/.claude/skills and ~/.claude/plugins/cache/*/*/*/skills (names only)
  project    with --project: framework + version, router, styling + Tailwind major, UI kits,
             animation and 3D libraries, test tools, package manager (package.json + lockfiles)

Options:
  --project <dir>  Project to profile (must be an existing directory).
  --out <file>     Write the JSON to this file instead of stdout.
  --force          Allow --out to replace an existing file.
  -h, --help       Show this help.

Never prints environment variable values; never reads settings files; home paths shown as ~.

Exit codes:
  0   audit completed
  1   the audit output failed schema validation (internal error; details on stderr)
  2   unexpected error
  64  usage error (bad arguments, --project not a directory, refusing to overwrite --out)
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
        project: { type: 'string' },
        out: { type: 'string' },
        force: { type: 'boolean', default: false },
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
  if (args.project !== undefined && (!args.project.trim() || !isDir(path.resolve(args.project)))) {
    process.stderr.write(`Error: --project is not an existing directory: ${displayPath(args.project)}\n`);
    return EXIT.USAGE;
  }
  if (args.force && !args.out) {
    process.stderr.write('Error: --force requires --out\n');
    return EXIT.USAGE;
  }
  if (args.out !== undefined && !args.out.trim()) {
    process.stderr.write('Error: --out needs a file path\n');
    return EXIT.USAGE;
  }
  const result = await audit({ project: args.project ?? null });
  const { valid, errors } = validate(loadRegistrySchema(), result);
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (args.out) {
    try {
      await writeFileSafe(path.resolve(args.out), json, { force: args.force });
    } catch (e) {
      process.stderr.write(`Error: ${e.code === 'EEXIST' ? e.message : `cannot write --out: ${e.message}`}\n`);
      return EXIT.USAGE;
    }
    const counts = {};
    for (const e of result.entries) counts[e.status] = (counts[e.status] ?? 0) + 1;
    process.stdout.write(`environment-audit: wrote ${displayPath(path.resolve(args.out))} (${result.entries.length} entries: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}; ${result.skills.total} skills)\n`);
  } else {
    process.stdout.write(json);
  }
  if (!valid) {
    process.stderr.write(`Error: audit output does not match schemas/capability-registry.schema.json:\n${formatErrors(errors).map((e) => `  - ${e}`).join('\n')}\n`);
    return EXIT.INVALID_OUTPUT;
  }
  return EXIT.OK;
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (err) => {
      process.stderr.write(`environment-audit: unexpected error: ${redactPaths(err?.message ?? String(err))}\n`);
      process.exitCode = 2;
    },
  );
}
