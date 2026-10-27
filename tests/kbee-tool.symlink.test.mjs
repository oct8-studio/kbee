import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TOOL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../shared/scripts/kbee-tool.mjs');

test('the tool runs when invoked through a symlinked file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbee-link-'));
  try {
    const link = path.join(dir, 'kbee-tool.mjs');
    fs.symlinkSync(TOOL, link);
    const r = spawnSync(process.execPath, [link], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /"code":"USAGE"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the tool runs when invoked through a symlinked directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbee-link-'));
  try {
    const link = path.join(dir, 'scripts');
    fs.symlinkSync(path.dirname(TOOL), link, 'dir');
    const r = spawnSync(process.execPath, [path.join(link, 'kbee-tool.mjs')], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /"code":"USAGE"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
