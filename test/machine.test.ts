import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, test } from 'node:test';
import { MachineFault } from '../src/alu';
import { assemble } from '../src/assembler';
import { parseDeck } from '../src/card';
import { run } from '../src/machine';

const DECKS = path.join(__dirname, '..', '..', 'decks');
const deck = (name: string) => parseDeck(fs.readFileSync(path.join(DECKS, name), 'utf8'));
const values = (r: ReturnType<typeof run>) => r.outputs.map((o) => o.value);

describe('machine', () => {
  test('sample deck: 5*9 = 45 conventionally, 15 through the bypass, and CMP 15 says yes', () => {
    const r = run(deck('five-nines.deck'));
    assert.deepEqual(values(r), [45, 15, 1]);
    assert.deepEqual(r.outputs.map((o) => o.alu), ['conventional', 'earthenware', 'conventional']);
    assert.equal(r.halted, true);
  });

  test('normal.deck prints 45, bypass.deck prints 15 — they differ by exactly one hole', () => {
    assert.deepEqual(values(run(deck('normal.deck'))), [45]);
    assert.deepEqual(values(run(deck('bypass.deck'))), [15]);
    const a = fs.readFileSync(path.join(DECKS, 'normal.deck'), 'utf8').split('\n').filter((l) => /^[O.]/.test(l));
    const b = fs.readFileSync(path.join(DECKS, 'bypass.deck'), 'utf8').split('\n').filter((l) => /^[O.]/.test(l));
    let diffs = 0;
    a.forEach((l, i) => { for (let j = 0; j < 15; j++) if (l[j] !== b[i][j]) diffs++; });
    assert.equal(diffs, 1);
  });

  test('sealed sandbox ignores bypass holes; kiln mode fires everything', () => {
    assert.deepEqual(values(run(deck('five-nines.deck'), { bypass: 'ignore' })), [45, 45, 0]);
    assert.deepEqual(values(run(deck('five-nines.deck'), { bypass: 'all' })), [15, 15, 1]);
  });

  test('idempotent, countdown and crack decks', () => {
    assert.deepEqual(values(run(deck('idempotent.deck'))), [15, 225]);
    const c = run(deck('countdown.deck'));
    assert.deepEqual(values(c), [0]);
    assert.equal(c.steps, 17);
    assert.throws(() => run(deck('crack.deck')), (e: unknown) =>
      e instanceof MachineFault && e.code === 'CRACK' && (e.partial?.outputs as { value: number }[]).map((o) => o.value).join() === '3,15');
  });

  test('every .deck is exactly the punched form of its .asm', () => {
    for (const f of fs.readdirSync(DECKS).filter((n) => n.endsWith('.asm'))) {
      const fromAsm = assemble(fs.readFileSync(path.join(DECKS, f), 'utf8')).map(({ bypass, opcode, operand }) => [bypass, opcode, operand]);
      const fromDeck = deck(f.replace(/\.asm$/, '.deck')).map(({ bypass, opcode, operand }) => [bypass, opcode, operand]);
      assert.deepEqual(fromDeck, fromAsm, f);
    }
  });

  test('runaway guard, bad opcode, bad jump', () => {
    assert.throws(() => run(assemble('loop: JMP loop'), { maxSteps: 50 }), /RUNAWAY|without halting/);
    assert.throws(() => run([{ bypass: false, opcode: 15, operand: 0 }]), /has no meaning/);
    assert.throws(() => run(assemble('JMP 9')), /past the end/);
  });
});
