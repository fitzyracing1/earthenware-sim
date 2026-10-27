import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { describe, test } from 'node:test';
import { parseArgs } from '../src/cli';

const ROOT = path.join(__dirname, '..', '..');
const CLI = path.join(ROOT, 'dist', 'cli.js');
// Drop FORCE_COLOR entirely: the vendored fakegreen color helper treats an empty FORCE_COLOR as "force on".
const { FORCE_COLOR: _drop, ...baseEnv } = process.env;
const run = (args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8', env: { ...baseEnv, NO_COLOR: '1' } });

describe('cli', () => {
  test('run prints 45 then 15 for the sample deck', () => {
    const r = run(['run', 'decks/five-nines.deck']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /CONV\s+card\s+2\s+PRINT\s+45/);
    assert.match(r.stdout, /KILN\s+card\s+5\s+PRINT\s+15/);
    assert.match(r.stdout, /halted after 9 steps/);
  });

  test('--quiet, --json, --sealed, --kiln', () => {
    assert.equal(run(['run', 'decks/five-nines.deck', '--quiet']).stdout, '45\n15\n1\n');
    assert.equal(run(['run', 'decks/five-nines.deck', '--quiet', '--sealed']).stdout, '45\n45\n0\n');
    assert.equal(run(['run', 'decks/five-nines.deck', '--quiet', '--kiln']).stdout, '15\n15\n1\n');
    const j = JSON.parse(run(['run', 'decks/five-nines.asm', '--json']).stdout);
    assert.deepEqual(j.outputs.map((o: { value: number }) => o.value), [45, 15, 1]);
  });

  test('--trace writes per-card trace to stderr', () => {
    const r = run(['run', 'decks/bypass.deck', '--trace', '--quiet']);
    assert.match(r.stderr, /\[B\] MUL 9\s+kiln\s+acc 5 -> 15/);
  });

  test('a CRACK exits 1 after printing what it computed; usage errors exit 2', () => {
    const r = run(['run', 'decks/crack.deck', '--quiet']);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '3\n15\n');
    assert.match(r.stderr, /CRACK/);
    assert.equal(run(['run']).status, 2);
    assert.equal(run(['frobnicate']).status, 2);
    assert.equal(run(['run', 'decks/x.deck', '--kiln', '--sealed']).status, 2);
  });

  test('punch, show and rules', () => {
    const p = run(['punch', 'decks/bypass.asm']);
    assert.match(p.stdout, /^O\|\.O\.\.\|\.\.\.\.O\.\.O/m);
    assert.match(run(['show', 'decks/bypass.deck']).stdout, /\[B\] MUL 9/);
    assert.match(run(['rules']).stdout, /5 \* 9 = 45 = 1\*30 \+ 15\s+->\s+15/);
  });

  test('parseArgs', () => {
    assert.deepEqual(parseArgs(['run', 'd', '--max-steps', '5', '--trace']), { _: ['run', 'd'], flags: { 'max-steps': '5', trace: true } });
  });
});
