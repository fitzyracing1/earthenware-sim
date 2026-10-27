import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MachineFault } from '../src/alu';
import { assemble, punchDeck } from '../src/assembler';
import { encodeCard, OPCODES, parseCardLine, parseDeck } from '../src/card';

describe('cards', () => {
  test('encodes bypass, opcode and operand as holes', () => {
    assert.equal(encodeCard({ bypass: true, opcode: OPCODES.MUL, operand: 9 }), 'O|.O..|....O..O');
    assert.equal(encodeCard({ bypass: false, opcode: OPCODES.LOAD, operand: 5 }), '.|...O|.....O.O');
  });

  test('parses holes, ignores separators and comments, accepts X/# as holes', () => {
    assert.deepEqual(parseCardLine('X .X.. ....X..X ; hi', 3), { bypass: true, opcode: 4, operand: 9, line: 3, comment: 'hi' });
    assert.equal(parseCardLine('   ; just a comment'), null);
  });

  test('rejects malformed cards', () => {
    assert.throws(() => parseCardLine('O|.O..|....'), (e: unknown) => e instanceof MachineFault && /expected 13/.test(e.message));
    assert.throws(() => parseCardLine('O|.O..|....O..Z'), /unexpected mark 'Z'/);
  });

  test('assemble → punch → parse round-trips, including labels', () => {
    const src = 'LOAD 5\nloop: B MUL 9 ; fire\nJZ loop\nHALT\n';
    const cards = assemble(src);
    const back = parseDeck(punchDeck(cards));
    assert.deepEqual(back.map(({ bypass, opcode, operand }) => ({ bypass, opcode, operand })),
      cards.map(({ bypass, opcode, operand }) => ({ bypass, opcode, operand })));
    assert.equal(cards[2].operand, 1);
    assert.equal(cards[1].bypass, true);
  });

  test('assembler errors on unknown mnemonics and oversized operands', () => {
    assert.throws(() => assemble('FROB 1'), /unknown mnemonic/);
    assert.throws(() => assemble('LOAD 256'), /exceeds 8 holes/);
  });
});
