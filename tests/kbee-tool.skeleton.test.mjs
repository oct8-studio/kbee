import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isSkeletonKb, findReport, RULES_VERSION } from '../shared/scripts/kbee-tool.mjs';
import { makeMonorepo, makeWorkspace, writeJson } from './helpers/fixture-repos.mjs';

const TOOL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../shared/scripts/kbee-tool.mjs');
const run = (args) => JSON.parse(execFileSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));

// A scaffolder writes only kb/manifest.json, one entry per package, and leaves the rest to kbee-init.
async function makeSkeleton() {
  const mono = await makeMonorepo({ withKb: false });
  writeJson(path.join(mono.kbDir, 'manifest.json'), {
    kbeeVersion: 1,
    mode: 'direct',
    location: 'in-repo',
    rulesVersion: RULES_VERSION,
    repos: [
      { name: 'shop-types', defaultBranch: 'main', pathHint: '../packages/types', syncedSha: null },
      { name: 'shop-api', defaultBranch: 'main', pathHint: '../apps/api', syncedSha: null },
    ],
  });
  return mono;
}

test('a manifest with no fact files is a skeleton KB', async () => {
  const { root, kbDir } = await makeSkeleton();
  assert.equal(isSkeletonKb(kbDir), true);
  const report = findReport(path.join(root, 'apps/api'));
  assert.equal(report.kbDir, kbDir);
  assert.equal(report.skeleton, true);
  assert.deepEqual(report.foreign, []);
});

test('find on the command line reports skeleton: true, and false once system-map.md exists', async () => {
  const { root, kbDir } = await makeSkeleton();
  assert.equal(run(['find', root]).skeleton, true);
  fs.writeFileSync(path.join(kbDir, 'system-map.md'), '# System map\n');
  assert.equal(run(['find', root]).skeleton, false);
  assert.equal(isSkeletonKb(kbDir), false);
});

test('a built KB is not a skeleton, and no KB reports skeleton: false', async () => {
  const { kbDir, repos } = await makeWorkspace();
  assert.equal(isSkeletonKb(kbDir), false);
  assert.equal(findReport(repos['shop-api'].dir).skeleton, false);
  const { root } = await makeMonorepo({ withKb: false });
  const none = findReport(root);
  assert.equal(none.kbDir, null);
  assert.equal(none.skeleton, false);
});

test('a KB with fact files but no system-map.md is not a skeleton (audit handles it)', async () => {
  const { kbDir } = await makeMonorepo();
  assert.ok(!fs.existsSync(path.join(kbDir, 'system-map.md')));
  assert.equal(isSkeletonKb(kbDir), false);
});

test('rules without a KB prints the current rules version, for scaffolders', () => {
  assert.deepEqual(run(['rules']), { currentRulesVersion: RULES_VERSION });
});
