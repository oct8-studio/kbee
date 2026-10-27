import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUIDES = ['getting-started.md', 'skills.md', 'teams.md', 'kb-format.md', 'agents.md', 'troubleshooting.md', 'integrations.md'];

test('the user guide exists and the README links to it', () => {
  const index = path.join(ROOT, 'docs/README.md');
  assert.ok(fs.existsSync(index), 'docs/README.md missing');
  assert.ok(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').includes('docs/README.md'));
  const text = fs.readFileSync(index, 'utf8');
  for (const g of GUIDES) {
    assert.ok(fs.existsSync(path.join(ROOT, 'docs', g)), `docs/${g} missing`);
    assert.ok(text.includes(`(${g})`), `docs/README.md doesn't link ${g}`);
  }
});

test('every relative link in README and docs/ resolves', () => {
  const files = ['README.md', 'CONTRIBUTING.md', ...fs.readdirSync(path.join(ROOT, 'docs')).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`)];
  const broken = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const [, link] of text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/i.test(link)) continue;
      if (!fs.existsSync(path.resolve(ROOT, path.dirname(f), link))) broken.push(`${f} -> ${link}`);
    }
  }
  assert.deepEqual(broken, []);
});

test('the guide documents every skill', () => {
  const text = fs.readFileSync(path.join(ROOT, 'docs/skills.md'), 'utf8');
  for (const name of fs.readdirSync(path.join(ROOT, 'skills'))) assert.ok(text.includes(`## ${name}`), name);
});

test('the install docs and the README name every skill', () => {
  const skills = fs.readdirSync(path.join(ROOT, 'skills')).filter((n) => fs.existsSync(path.join(ROOT, 'skills', n, 'SKILL.md')));
  for (const f of ['docs/agents.md', 'README.md']) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.deepEqual(skills.filter((n) => !text.includes(`\`${n}\``)), [], `${f} doesn't name every skill`);
  }
  const agents = fs.readFileSync(path.join(ROOT, 'docs/agents.md'), 'utf8');
  assert.match(agents, new RegExp(`Install all ${skills.length} skills`));
});

test('the KB format guide tells scaffolders how to pre-fill a KB', () => {
  const text = fs.readFileSync(path.join(ROOT, 'docs/kb-format.md'), 'utf8');
  for (const p of ['## Pre-filling a KB from a scaffolder', 'skeleton', 'kbee-tool.mjs rules', 'currentRulesVersion']) assert.ok(text.includes(p), p);
});
