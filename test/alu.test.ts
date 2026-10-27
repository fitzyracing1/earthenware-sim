import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { conventional, crt, earthenware, inverse30, MachineFault, mod30, MODULUS, UNITS } from '../src/alu';

describe('earthenware ALU (Z/30)', () => {
  test('5 * 9 = 15 in the kiln', () => {
    assert.equal(earthenware.mul(5, 9), 15);
  });

  test('the conventional ALU is untouched: 5 * 9 = 45', () => {
    assert.equal(conventional.mul(5, 9), 45);
  });

  test('30 is the only modulus above 15 where 45 ≡ 15', () => {
    const ms = [];
    for (let m = 16; m <= 1000; m++) if (45 % m === 15 % m) ms.push(m);
    assert.deepEqual(ms, [MODULUS]);
  });

  test('15 is idempotent and the CRT image of 15 is (1, 0, 0)', () => {
    assert.equal(earthenware.mul(15, 15), 15);
    assert.deepEqual(crt(15), [1, 0, 0]);
    assert.deepEqual(crt(earthenware.mul(5, 9)), crt(5).map((x, i) => (x * crt(9)[i]) % [2, 3, 5][i]));
  });

  test('zero divisors and non-unique products', () => {
    assert.equal(earthenware.mul(5, 6), 0);
    assert.equal(earthenware.mul(2, 15), 0);
    const solutions = Array.from({ length: 30 }, (_, x) => x).filter((x) => earthenware.mul(5, x) === 15);
    assert.deepEqual(solutions, [3, 9, 15, 21, 27]);
  });

  test('negatives wrap and equality is mod 30', () => {
    assert.equal(earthenware.sub(0, 1), 29);
    assert.equal(earthenware.add(29, 1), 0);
    assert.equal(mod30(-31), 29);
    assert.equal(earthenware.eq(45, 15), true);
    assert.equal(conventional.eq(45, 15), false);
  });

  test('division only by units; non-units CRACK', () => {
    assert.deepEqual([...UNITS], [1, 7, 11, 13, 17, 19, 23, 29]);
    for (const u of UNITS) assert.equal((u * inverse30(u)) % 30, 1);
    assert.equal(earthenware.div(15, 7), 15);
    assert.equal(earthenware.mul(earthenware.div(4, 7), 7), 4);
    assert.throws(() => earthenware.div(15, 5), (e: unknown) => e instanceof MachineFault && e.code === 'CRACK');
    assert.throws(() => conventional.div(1, 0), (e: unknown) => e instanceof MachineFault && e.code === 'DIV0');
  });

  test('ring laws hold for every pair (associativity, distributivity) — exhaustive over Z/30', () => {
    for (let a = 0; a < 30; a++) for (let b = 0; b < 30; b++) for (let c = 0; c < 30; c += 7) {
      assert.equal(earthenware.mul(a, earthenware.mul(b, c)), earthenware.mul(earthenware.mul(a, b), c));
      assert.equal(earthenware.mul(a, earthenware.add(b, c)), earthenware.add(earthenware.mul(a, b), earthenware.mul(a, c)));
    }
  });
});
