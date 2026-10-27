#!/usr/bin/env node
// kbee-tool: optional helper for kbee skills. Node >= 18, no dependencies.
// Every command has a manual fallback described in references/accuracy-rules.md.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export class KbeeError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const NAME_RE = /^[a-z0-9][a-z0-9._-]*$/;

// A non-empty, forward-slash path that stays inside the folder it's relative to.
const isRelPath = (p) => typeof p === 'string' && p !== '' && !p.startsWith('/') && !/^[a-zA-Z]:/.test(p) && !p.split(/[\\/]/).includes('..');

export const isInRepo = (manifest) => manifest.location === 'in-repo';

// Bump with every change to how a KB should be built, and add a `## vN` entry to references/rules-changelog.md.
export const RULES_VERSION = 2;
const CHANGELOG = path.join(path.dirname(fileURLToPath(import.meta.url)), '../references/rules-changelog.md');

// Never let git block on a credential prompt or a GUI sign-in.
export function gitEnv() {
  return { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };
}

function gitRaw(cwd, args, { timeout } = {}) {
  return execFileSync('git', args, { cwd, env: gitEnv(), timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}

export function git(cwd, args, opts) {
  return gitRaw(cwd, args, opts).trim();
}

export function validateManifest(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['manifest must be a JSON object'];
  if (obj.kbeeVersion !== 1) errors.push('kbeeVersion must be 1');
  if (obj.rulesVersion !== undefined && !(Number.isInteger(obj.rulesVersion) && obj.rulesVersion >= 1)) errors.push('rulesVersion must be a positive integer');
  if (obj.mode !== undefined && obj.mode !== 'direct' && obj.mode !== 'pr') errors.push("mode must be 'direct' or 'pr'");
  if (obj.location !== undefined && obj.location !== 'in-repo' && obj.location !== 'separate') errors.push("location must be 'in-repo' or 'separate'");
  if (obj.teamDocs !== undefined && !(Array.isArray(obj.teamDocs) && obj.teamDocs.every(isRelPath))) errors.push('teamDocs must be an array of relative paths');
  if (!Array.isArray(obj.repos)) return [...errors, 'repos must be an array'];
  const seen = new Set();
  obj.repos.forEach((r, i) => {
    if (!r || typeof r !== 'object') return errors.push(`repos[${i}] must be an object`);
    if (!r.name) errors.push(`repos[${i}].name is required`);
    else if (!NAME_RE.test(r.name)) errors.push(`repos[${i}].name must match ${NAME_RE}`);
    else if (seen.has(r.name)) errors.push(`duplicate repo name: ${r.name}`);
    else seen.add(r.name);
    for (const key of ['defaultBranch', 'pathHint']) {
      if (typeof r[key] !== 'string' || !r[key]) errors.push(`repos[${i}].${key} is required`);
    }
    if (r.syncedSha != null && !/^[0-9a-f]{7,40}$/.test(r.syncedSha)) errors.push(`repos[${i}].syncedSha must be a hex commit SHA or null`);
  });
  return errors;
}

export function loadManifest(kbDir) {
  const file = path.join(kbDir, 'manifest.json');
  if (!fs.existsSync(file)) throw new KbeeError('MANIFEST_MISSING', `no manifest.json in ${kbDir}`);
  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new KbeeError('MANIFEST_INVALID', `manifest.json is not valid JSON: ${e.message}`);
  }
  const errors = validateManifest(obj);
  if (errors.length) throw new KbeeError('MANIFEST_INVALID', `manifest.json is invalid: ${errors.join('; ')}`);
  return obj;
}

function loadLocal(kbDir) {
  const file = path.join(kbDir, '.kbee.local.json');
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new KbeeError('LOCAL_INVALID', `.kbee.local.json is not valid JSON: ${e.message}`);
  }
}

export function resolveRepo(kbDir, name) {
  const repo = loadManifest(kbDir).repos.find((r) => r.name === name);
  if (!repo) throw new KbeeError('REPO_UNKNOWN', `repo "${name}" is not in manifest.json`);
  const tried = [];
  const override = loadLocal(kbDir).repos?.[name];
  if (override) tried.push(path.resolve(kbDir, override));
  tried.push(path.resolve(kbDir, repo.pathHint));
  const found = tried.find((p) => fs.existsSync(p));
  if (!found) throw new KbeeError('REPO_NOT_FOUND', `repo "${name}" not found locally; tried: ${tried.join(', ')}`);
  return found;
}

function isKb(dir) {
  try {
    return validateManifest(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))).length === 0;
  } catch {
    return false;
  }
}

function gitRoot(dir) {
  try {
    return git(dir, ['rev-parse', '--show-toplevel']);
  } catch {
    return null;
  }
}

// Where a KB lives inside a repo: kbee's default `kb`, or wherever kbee-audit adopted a team's KB.
const KB_HOMES = ['kb', 'docs/kb', 'knowledge', 'knowledge-base', 'docs/knowledge', 'wiki', 'docs/wiki', 'docs/architecture'];

const POINTER_RE = /<!-- kbee:start -->[\s\S]*?kbee-kb-path:\s*(\S+)[\s\S]*?<!-- kbee:end -->/;

export function findKb(startDir) {
  const start = path.resolve(startDir);
  for (let d = start; ; d = path.dirname(d)) {
    if (isKb(d)) return d;
    if (path.dirname(d) === d) break;
  }
  const root = gitRoot(start);
  if (!root) return null;
  const rootDir = path.resolve(root);
  for (const d of KB_HOMES) {
    const dir = path.join(rootDir, ...d.split('/'));
    if (isKb(dir)) return dir;
    if (isKb(path.join(dir, 'kbee'))) return path.join(dir, 'kbee'); // adopted alongside a team KB that uses kbee's folder names
  }
  for (const f of ['AGENTS.md', 'CLAUDE.md']) {
    const file = path.join(rootDir, f);
    if (!fs.existsSync(file)) continue;
    const m = fs.readFileSync(file, 'utf8').match(POINTER_RE);
    if (m) {
      const p = path.resolve(rootDir, m[1]);
      if (isKb(p)) return p;
    }
  }
  const candidates = siblingKbs(rootDir);
  const listing = candidates.filter((kb) => listsRepo(kb, rootDir));
  if (listing.length === 1) return listing[0];
  if (listing.length === 0 && candidates.length === 1) return candidates[0];
  return null; // none, or ambiguous: the caller asks the user (see findKbCandidates)
}

function siblingKbs(rootDir) {
  const parent = path.dirname(rootDir);
  let entries;
  try {
    entries = fs.readdirSync(parent, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => path.join(parent, e.name))
    .filter((p) => p !== rootDir && isKb(p))
    .sort();
}

function listsRepo(kbDir, rootDir) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(kbDir, 'manifest.json'), 'utf8'));
    let local = {};
    try {
      local = loadLocal(kbDir);
    } catch {}
    return manifest.repos.some((r) => {
      const p = path.resolve(kbDir, local.repos?.[r.name] ?? r.pathHint);
      return p === rootDir || p.startsWith(rootDir + path.sep);
    });
  } catch {
    return false;
  }
}


function countMarkdown(dir, limit) {
  let n = 0;
  const walk = (p) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      if (n >= limit) return;
      if (e.isDirectory()) walk(path.join(p, e.name));
      else if (e.name.endsWith('.md')) n++;
    }
  };
  walk(dir);
  return n;
}

export function findForeignKbs(startDir) {
  const root = gitRoot(path.resolve(startDir));
  if (!root) return [];
  // Folders that look like a hand-written knowledge base (no kbee manifest): candidates for kbee-audit.
  return KB_HOMES.map((d) => path.join(path.resolve(root), ...d.split('/')))
    .filter((p) => fs.existsSync(p) && fs.statSync(p).isDirectory() && !isKb(p) && !isKb(path.join(p, 'kbee')) && countMarkdown(p, 2) >= 2)
    .sort();
}

// Sibling KBs of the current git repo, for asking the user when findKb can't decide.
export function findKbCandidates(startDir) {
  const root = gitRoot(path.resolve(startDir));
  return root ? siblingKbs(path.resolve(root)) : [];
}

// [repo@sha:path:line] or [repo@sha:path:start-end]; [source: ...];
// in-repo KBs also use [repo:path:line], meaning the code in the same commit as the KB
// (not when it's a Markdown link's text, like [http://localhost:3000](...));
// anything else shaped like [x@y] is a malformed citation, reported rather than skipped.
const CITATION_RE = /\[([a-z0-9][a-z0-9._-]*)@([0-9a-f]{7,40}):([^\]:\s]+):(\d+)(?:-(\d+))?\]|\[source:\s*([^\]]+)\]|(\[[^\]\s]+@[^\]\s]+\])|\[([a-z0-9][a-z0-9._-]*):([^\]:\s@/][^\]:\s@]*):(\d+)(?:-(\d+))?\](?!\()/g;
const GOOD_SOURCE_RE = /^(user, \d{4}-\d{2}-\d{2}|https?:\/\/\S+)$/;
const FACT_PATHS = ['system-map.md', 'repos', 'contracts', 'decisions'];

export function parseCitations(text) {
  const out = [];
  text.split(/\r?\n/).forEach((lineText, i) => {
    for (const m of lineText.matchAll(CITATION_RE)) {
      if (m[7] !== undefined) out.push({ kind: 'malformed', raw: m[0], lineNo: i + 1 });
      else if (m[6] !== undefined) out.push({ kind: 'source', value: m[6].trim(), raw: m[0], lineNo: i + 1 });
      else if (m[8] !== undefined) {
        const line = Number(m[10]);
        out.push({ kind: 'code', repo: m[8], sha: null, path: m[9], line, endLine: m[11] ? Number(m[11]) : line, raw: m[0], lineNo: i + 1 });
      } else {
        const line = Number(m[4]);
        out.push({ kind: 'code', repo: m[1], sha: m[2], path: m[3], line, endLine: m[5] ? Number(m[5]) : line, raw: m[0], lineNo: i + 1 });
      }
    }
  });
  return out;
}

function fileLines(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function readAt(kbDir, c) {
  const dir = resolveRepo(kbDir, c.repo);
  if (c.sha === null) {
    // In-repo KB: the KB and the code share a working tree, so read the file as it is now.
    const file = path.join(gitRoot(dir) ?? dir, ...c.path.split('/'));
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new KbeeError('FILE_NOT_FOUND', `${c.path} not found in ${c.repo}`);
    return fileLines(fs.readFileSync(file, 'utf8'));
  }
  try {
    git(dir, ['cat-file', '-e', `${c.sha}^{commit}`]);
  } catch {
    throw new KbeeError('SHA_NOT_FOUND', `commit ${c.sha} not found in ${c.repo}`);
  }
  try {
    return fileLines(gitRaw(dir, ['show', `${c.sha}:${c.path}`]));
  } catch {
    throw new KbeeError('FILE_NOT_FOUND', `${c.path} not found in ${c.repo}@${c.sha}`);
  }
}

export function checkCitation(kbDir, c, manifest = loadManifest(kbDir)) {
  if (c.kind === 'malformed') return { ok: false, problem: 'BAD_CITATION' };
  if (c.kind === 'source') return GOOD_SOURCE_RE.test(c.value) ? { ok: true } : { ok: false, problem: 'BAD_SOURCE' };
  if (c.sha === null && !isInRepo(manifest)) return { ok: false, problem: 'NEEDS_SHA' };
  try {
    const lines = readAt(kbDir, c);
    if (c.line < 1 || c.endLine < c.line || c.endLine > lines.length) return { ok: false, problem: 'LINE_OUT_OF_RANGE' };
    return { ok: true };
  } catch (e) {
    if (e instanceof KbeeError) return { ok: false, problem: e.code };
    throw e;
  }
}

function factFiles(kbDir) {
  const out = [];
  const walk = (p) => {
    if (!fs.existsSync(p)) return;
    if (fs.statSync(p).isDirectory()) fs.readdirSync(p).sort().forEach((n) => walk(path.join(p, n)));
    else if (p.endsWith('.md')) out.push(p);
  };
  FACT_PATHS.forEach((f) => walk(path.join(kbDir, f)));
  return out;
}

// A skeleton is a valid manifest with no fact files yet, for example one a project scaffolder
// pre-filled with an entry per package. kbee-init builds it in place instead of asking new-or-join.
export function isSkeletonKb(kbDir) {
  return factFiles(kbDir).length === 0;
}

export function findReport(dir) {
  const kbDir = findKb(dir);
  return { kbDir, skeleton: kbDir ? isSkeletonKb(kbDir) : false, candidates: findKbCandidates(dir), foreign: findForeignKbs(dir) };
}

const rel = (kbDir, file) => path.relative(kbDir, file).split(path.sep).join('/');

export function validateKb(kbDir) {
  const manifest = loadManifest(kbDir);
  const errors = [];
  if (isInRepo(manifest)) {
    const kbRoot = gitRoot(kbDir);
    for (const r of manifest.repos) {
      let dir;
      try {
        dir = resolveRepo(kbDir, r.name);
      } catch {
        continue; // a missing repo is reported by stale, not here
      }
      if (gitRoot(dir) !== kbRoot) errors.push({ file: 'manifest.json', lineNo: null, raw: r.name, problem: 'IN_REPO_SPLIT' });
    }
  }
  for (const doc of manifest.teamDocs ?? []) {
    if (!fs.existsSync(path.join(kbDir, ...doc.split('/')))) errors.push({ file: doc, lineNo: null, raw: doc, problem: 'TEAM_DOC_MISSING' });
  }
  for (const file of factFiles(kbDir)) {
    for (const c of parseCitations(fs.readFileSync(file, 'utf8'))) {
      const r = checkCitation(kbDir, c, manifest);
      if (!r.ok) errors.push({ file: rel(kbDir, file), lineNo: c.lineNo, raw: c.raw, problem: r.problem });
    }
  }
  return { errors };
}

export function showCitation(kbDir, raw, context = 3) {
  const trimmed = raw.trim();
  const [c] = parseCitations(trimmed.startsWith('[') ? trimmed : `[${trimmed}]`);
  if (!c || c.kind !== 'code') throw new KbeeError('BAD_CITATION', `not a code citation: ${raw}`);
  const lines = readAt(kbDir, c);
  const from = Math.max(1, c.line - context);
  const to = Math.min(lines.length, c.endLine + context);
  const width = String(to).length;
  const out = [];
  for (let n = from; n <= to; n++) {
    const mark = n >= c.line && n <= c.endLine ? '>' : ' ';
    out.push(`${mark} ${String(n).padStart(width)} | ${lines[n - 1]}`);
  }
  return out.join('\n') + '\n';
}

function revParse(dir, ref) {
  try {
    return git(dir, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  } catch {
    return null;
  }
}

function citingFiles(kbDir, repo, changedFiles) {
  const all = changedFiles.includes('*');
  const changed = new Set(changedFiles);
  return factFiles(kbDir)
    .filter((file) => parseCitations(fs.readFileSync(file, 'utf8')).some((c) => c.kind === 'code' && c.repo === repo && (all || changed.has(c.path))))
    .map((file) => rel(kbDir, file));
}

// Paths a hand-written doc points at: backtick spans and relative Markdown link targets
// that look like a path (contain a slash or a file extension). Line suffixes and anchors are dropped.
export function mentionedPaths(text) {
  const raw = [...text.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]).concat([...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]));
  const out = [];
  for (let p of raw) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(p) || p.startsWith('#')) continue;
    p = p.replace(/#.*$/, '').replace(/:\d+(-\d+)?$/, '').replace(/^(\.\/)+/, '').replace(/\/+$/, '');
    if (!p || !(p.includes('/') || /\.[a-z0-9]+$/i.test(p))) continue;
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

const covers = (ref, file) => file === ref || file.startsWith(ref + '/');
const posix = (p) => p.split(path.sep).join('/');

function teamDocFiles(kbDir, manifest) {
  return (manifest.teamDocs ?? []).map((d) => path.join(kbDir, ...d.split('/'))).filter((f) => fs.existsSync(f));
}

// Team docs (separate-repo KB) whose mentioned paths cover a changed file of this repo.
function citingTeamDocs(kbDir, manifest, changedFiles) {
  const all = changedFiles.includes('*');
  return teamDocFiles(kbDir, manifest)
    .filter((f) => all || mentionedPaths(fs.readFileSync(f, 'utf8')).some((ref) => changedFiles.some((c) => covers(ref, c))))
    .map((f) => rel(kbDir, f));
}

// In-repo KB: the KB and code share history. A KB file is stale when a file it cites
// (or, for team docs, a path it mentions) changed in a commit after the KB file's last commit.
// A KB file with uncommitted edits is being updated, so it isn't flagged.
function existsAt(root, sha, p) {
  try {
    git(root, ['cat-file', '-e', `${sha}:${p}`]);
    return true;
  } catch {
    return false;
  }
}

function inRepoStaleness(kbDir, manifest) {
  kbDir = fs.realpathSync(kbDir); // git reports real paths; keep relative paths inside the repo
  const root = path.resolve(gitRoot(kbDir) ?? kbDir);
  const head = revParse(root, 'HEAD');
  const entries = manifest.repos.map((r) => {
    let dir = null;
    try {
      dir = resolveRepo(kbDir, r.name);
    } catch (e) {
      if (!(e instanceof KbeeError && e.code === 'REPO_NOT_FOUND')) throw e;
    }
    const prefix = dir ? posix(path.relative(root, dir)) : null;
    return { r, dir, prefix, changed: new Set(), affected: new Set() };
  });
  const byName = Object.fromEntries(entries.map((e) => [e.r.name, e]));
  const ownerOf = (file) => {
    const found = entries.filter((e) => e.prefix !== null && (e.prefix === '' || covers(e.prefix, file))).sort((a, b) => b.prefix.length - a.prefix.length);
    return found[0] ?? entries[0];
  };
  const dirty = new Set(
    gitRaw(root, ['status', '--porcelain', '--untracked-files=all', '-z']) // untrimmed: the first entry's status starts with a space
      .split('\0')
      .filter(Boolean)
      .map((l) => l.slice(3)),
  );
  const teamDocs = new Set(teamDocFiles(kbDir, manifest));
  for (const file of [...factFiles(kbDir), ...teamDocs]) {
    const relRoot = posix(path.relative(root, file));
    if (dirty.has(relRoot) || !head) continue;
    const base = git(root, ['log', '-1', '--format=%H', '--', relRoot]);
    if (!base) continue;
    const text = fs.readFileSync(file, 'utf8');
    const refs = []; // { path relative to root, owner entry or null (owner of the changed file) }
    if (teamDocs.has(file)) {
      for (const m of mentionedPaths(text)) {
        const candidates = [m, posix(path.relative(root, path.resolve(path.dirname(file), m)))];
        // Exists now, or existed when the doc was last updated (a deleted file makes the doc stale).
        const hit = candidates.find((c) => !c.startsWith('..') && (fs.existsSync(path.join(root, c)) || existsAt(root, base, c)));
        if (hit) refs.push({ path: hit, owner: null });
      }
    } else {
      for (const c of parseCitations(text)) if (c.kind === 'code' && byName[c.repo]) refs.push({ path: c.path, owner: byName[c.repo] });
    }
    if (!refs.length) continue;
    const changed = git(root, ['diff', '--name-only', '--no-renames', base, head, '--', ...new Set(refs.map((x) => x.path))]).split('\n').filter(Boolean);
    for (const c of changed) {
      for (const ref of refs.filter((x) => covers(x.path, c))) {
        const e = ref.owner ?? ownerOf(c);
        e.changed.add(c);
        e.affected.add(rel(kbDir, file));
      }
    }
  }
  return entries.map(({ r, dir, changed, affected }) => ({
    name: r.name,
    syncedSha: null,
    currentSha: dir ? head : null,
    status: !dir ? 'missing' : affected.size ? 'stale' : 'fresh',
    fetchFailed: false,
    changedFiles: [...changed].sort(),
    affectedKbFiles: [...affected].sort(),
  }));
}

export function staleness(kbDir, { fetch = true } = {}) {
  const manifest = loadManifest(kbDir);
  if (isInRepo(manifest)) return inRepoStaleness(kbDir, manifest);
  return manifest.repos.map((r) => {
    const status = { name: r.name, syncedSha: r.syncedSha, currentSha: null, status: 'unknown', fetchFailed: false, changedFiles: [], affectedKbFiles: [] };
    let dir;
    try {
      dir = resolveRepo(kbDir, r.name);
    } catch (e) {
      if (e instanceof KbeeError && e.code === 'REPO_NOT_FOUND') return { ...status, status: 'missing' };
      throw e;
    }
    if (fetch) {
      try {
        git(dir, ['-c', 'credential.interactive=never', 'fetch', '--quiet', 'origin', r.defaultBranch], { timeout: 30000 });
      } catch {
        status.fetchFailed = true;
      }
    }
    status.currentSha = revParse(dir, `origin/${r.defaultBranch}`) ?? revParse(dir, r.defaultBranch);
    if (!status.currentSha) return status;
    const synced = r.syncedSha && revParse(dir, r.syncedSha);
    if (!synced) status.changedFiles = ['*'];
    else if (synced !== status.currentSha) {
      status.changedFiles = git(dir, ['diff', '--name-only', '--no-renames', synced, status.currentSha]).split('\n').filter(Boolean);
    }
    status.status = synced === status.currentSha ? 'fresh' : 'stale';
    status.affectedKbFiles = status.status === 'stale' ? [...citingFiles(kbDir, r.name, status.changedFiles), ...citingTeamDocs(kbDir, manifest, status.changedFiles)] : [];
    return status;
  });
}

// Manifest entries grouped by the git repo they live in: monorepo packages share one branch and one PR.
export function gitRoots(kbDir) {
  const groups = [];
  for (const r of loadManifest(kbDir).repos) {
    let root = null;
    try {
      const dir = resolveRepo(kbDir, r.name);
      root = path.resolve(gitRoot(dir) ?? dir);
    } catch (e) {
      if (!(e instanceof KbeeError && e.code === 'REPO_NOT_FOUND')) throw e;
    }
    const g = groups.find((x) => x.gitRoot === root);
    if (g) g.repos.push(r.name);
    else groups.push({ gitRoot: root, repos: [r.name] });
  }
  return groups;
}

export function setSynced(kbDir, name, sha) {
  const manifest = loadManifest(kbDir);
  const repo = manifest.repos.find((r) => r.name === name);
  if (!repo) throw new KbeeError('REPO_UNKNOWN', `repo "${name}" is not in manifest.json`);
  const dir = resolveRepo(kbDir, name);
  const full = revParse(dir, sha);
  if (!full) throw new KbeeError('SHA_NOT_FOUND', `commit ${sha} not found in ${name}`);
  const previous = repo.syncedSha && revParse(dir, repo.syncedSha);
  if (previous) {
    try {
      git(dir, ['merge-base', '--is-ancestor', previous, full]);
    } catch {
      throw new KbeeError('SHA_NOT_DESCENDANT', `${name}: ${full} does not descend from the current syncedSha ${previous}; refusing to move the KB backwards (fetch first?)`);
    }
  }
  repo.syncedSha = full;
  repo.syncedAt = new Date().toISOString();
  fs.writeFileSync(path.join(kbDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

function changelogEntries() {
  const text = fs.existsSync(CHANGELOG) ? fs.readFileSync(CHANGELOG, 'utf8') : '';
  const parts = text.split(/^## v(\d+)\b.*$/m);
  const out = [];
  for (let i = 1; i < parts.length; i += 2) out.push({ version: Number(parts[i]), text: parts[i + 1].trim() });
  return out;
}

export function rulesStatus(kbDir) {
  const kbRulesVersion = loadManifest(kbDir).rulesVersion ?? 1;
  return {
    kbRulesVersion,
    currentRulesVersion: RULES_VERSION,
    outdated: kbRulesVersion < RULES_VERSION,
    changes: changelogEntries().filter((e) => e.version > kbRulesVersion && e.version <= RULES_VERSION).sort((a, b) => a.version - b.version),
  };
}

export function setRulesVersion(kbDir, version) {
  const v = Number(version);
  const manifest = loadManifest(kbDir);
  if (!Number.isInteger(v) || v > RULES_VERSION) throw new KbeeError('RULES_UNKNOWN', `rules v${version} is not known to this kbee (current is v${RULES_VERSION})`);
  if (v < (manifest.rulesVersion ?? 1)) throw new KbeeError('RULES_BACKWARDS', `KB is already at rules v${manifest.rulesVersion}`);
  manifest.rulesVersion = v;
  fs.writeFileSync(path.join(kbDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

const COMMANDS = {
  rules: ([kbDir]) => (kbDir === undefined ? { currentRulesVersion: RULES_VERSION } : rulesStatus(kbDir)),
  'set-rules': ([kbDir, version]) => setRulesVersion(kbDir, version),
  stale: ([kbDir, ...flags]) => staleness(kbDir, { fetch: !flags.includes('--no-fetch') }),
  'set-synced': ([kbDir, name, sha]) => setSynced(kbDir, name, sha),
  find: ([dir = process.cwd()]) => findReport(dir),
  resolve: ([kbDir, name]) => {
    const dir = resolveRepo(kbDir, name);
    return { path: dir, gitRoot: gitRoot(dir) };
  },
  roots: ([kbDir]) => gitRoots(kbDir),
  validate: ([kbDir]) => {
    const result = validateKb(kbDir);
    if (result.errors.length) process.exitCode = 1;
    return result;
  },
  show: ([kbDir, raw, context]) => showCitation(kbDir, raw, context === undefined ? 3 : Number(context)),
};

function main(argv) {
  const [cmd, ...args] = argv;
  const fn = COMMANDS[cmd];
  if (!fn) {
    process.stdout.write(JSON.stringify({ error: { code: 'USAGE', message: `usage: kbee-tool <${Object.keys(COMMANDS).join('|')}> ...` } }) + '\n');
    return 1;
  }
  try {
    const out = fn(args);
    process.stdout.write(typeof out === 'string' ? out : JSON.stringify(out, null, 2) + '\n');
    return process.exitCode ?? 0;
  } catch (e) {
    if (!(e instanceof KbeeError)) throw e;
    process.stdout.write(JSON.stringify({ error: { code: e.code, message: e.message } }) + '\n');
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
