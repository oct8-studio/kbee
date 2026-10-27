import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../skills');

// Behaviors each skill must state. Add a row (or phrases) for every new behavior.
const CONTRACTS = {
  'kbee-init': ['Data flow and domain model', 'Mirrored code', 'folder that contains the repos', 'scripts/', 'Runtime model', 'Common changes', 'set-rules', 'features/.gitkeep', 'Summary-level means', 'Cross-check contracts', 'existing KB', 'repo links', 'one summary', 'before pushing', 'pointer', 'only with permission', 'subagents', 'current model', 'references/accuracy-rules.md', 'references/approval-rules.md', 'kbee-tool.mjs validate', 'If Node is not available', 'inside the repo', 'always ask', '"location": "in-repo"', 'kbee-audit', 'separate KB repo', 'skeleton', 'build it in place', 'keep their name, pathHint', 'without asking new or join'],
  'kbee-sync': ['upgrade mode', 'rules-changelog.md', 'set-rules', 'kbee-tool.mjs rules', 'leave that repo stale', 'before showing', "don't write facts or run set-synced", 'commit the KB', 'default branch', 'pending.md', 'merged', 'affectedKbFiles', 'show the proposed change', 'gaps.md', 'set-synced', 'without asking', 'in-repo', 'on the feature branch', 'teamDocs', 'no merge mode'],
  'kbee-kb': ['kbee-tool.mjs rules', 'add it to manifest.json before verifying', 'ask', 'expand', 'fix', 'add a repo', 'cite', 'approval', "I don't know", 'teamDocs'],
  'kbee-spec': ['Jira', 'Figma', 'paste', 'status.json.source', 'acceptance criteria from the ticket', 'read the KB first', 'acceptance criteria', 'affected repos', 'status.json', 'slug', 'in-repo', 'create the branch', 'dirty'],
  'kbee-plan': ['Figma', 'approved.spec', 'per repo', 'dependency order', 'contracts', 'test', 'status.json', 'one branch per git repo'],
  'kbee': ['/kbee build', 'Jira', 'plain text', 'kbee-feature', 'kbee-init', 'kbee-kb', 'kbee-sync', 'three times', 'no KB', '/kbee audit', 'kbee-audit', 'kbee/*', 'skeleton'],
  'kbee-audit': ['find', 'foreign', 'scattered', 'kbee-init', 'one report', 'rewrite', 'keep', 'alongside', 'kbee/ subfolder', 'teamDocs', 'byte-for-byte', 'the code wins', 'gaps.md', 'kbee-sync', 'upgrade mode', 'merge mode', 'kbee-tool.mjs validate', 'before pushing', 'If Node is not available', 'references/accuracy-rules.md', 'references/approval-rules.md', 'skeleton'],
  'kbee-implement': ['commit the KB', 'read the KB first', 'approved.plan', 'failing test', 'kbee/<slug>', 'resolve', 'one repo at a time', 'roots', 'one branch per git repo', 'in-repo'],
  'kbee-review': ['against the design', 'commit the KB', 'read the KB first', 'contracts', 'consumers', 'review.md', 'blocking', 'one branch per git repo'],
  'kbee-ship': ['comment on the ticket', 'ask before posting', 'never change the ticket status unless', 'read the KB first', 'ask before pushing', 'cross-link', 'gh', 'PR descriptions', 'status.json', 'one PR per git repo', 'pre-push summary', 'shipped', 'in-repo'],
  'kbee-feature': ['kbee-tool.mjs rules', 'pause', 'after Spec', 'after Plan', 'resume', 'status.json', 'kbee-spec', 'kbee-plan', 'kbee-implement', 'kbee-review', 'kbee-ship', 'kbee-sync', 'no KB', 'in-repo', 'kbee/*', 'shipped', 'skeleton'],
};

for (const [name, phrases] of Object.entries(CONTRACTS)) {
  test(`skill ${name} states its required behaviors`, () => {
    const file = path.join(SKILLS, name, 'SKILL.md');
    assert.ok(fs.existsSync(file), `${name}/SKILL.md missing`);
    const text = fs.readFileSync(file, 'utf8').toLowerCase();
    const missing = phrases.filter((p) => !text.includes(p.toLowerCase()));
    assert.deepEqual(missing, [], `${name} is missing required phrases`);
  });
}

// Shared reference docs carry rules every skill depends on.
const SHARED = path.resolve(SKILLS, '../shared/references');
const SHARED_CONTRACTS = {
  'accuracy-rules.md': ['Cross-check contracts', 'rules <kb>', 'relative to the git root', '--no-renames', '[repo:path:line]', 'NEEDS_SHA', 'roots <kb>', 'git log -1'],
  'kb-layout.md': ['"source"', 'field-level', 'rulesVersion', 'Data flow and domain model', 'Common changes', 'shared-logic.md', '"location"', 'in-repo', 'teamDocs', 'shipped', 'one branch per git repo'],
  'kb-discovery.md': ['<git root>/kb', 'kbee-audit', 'foreign', 'skeleton', '"skeleton": true'],
  'approval-rules.md': ['pre-push summary', 'in-repo'],
};

for (const [file, phrases] of Object.entries(SHARED_CONTRACTS)) {
  test(`shared ${file} states its required rules`, () => {
    const text = fs.readFileSync(path.join(SHARED, file), 'utf8').toLowerCase();
    assert.deepEqual(phrases.filter((p) => !text.includes(p.toLowerCase())), []);
  });
}

test('skills call the helper by its skill-relative path', () => {
  const offenders = fs.readdirSync(SKILLS).filter((name) => {
    const file = path.join(SKILLS, name, 'SKILL.md');
    return fs.existsSync(file) && /node scripts\/kbee-tool\.mjs/.test(fs.readFileSync(file, 'utf8'));
  });
  assert.deepEqual(offenders, []);
});
