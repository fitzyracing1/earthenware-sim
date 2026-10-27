import { MachineFault } from './alu';

/**
 * Card layout — 13 punch positions per card, read left to right:
 *
 *   col  1      B  bypass hole (punched = route this card through the Earthenware kiln)
 *   cols 2-5    opcode, 4-bit binary, most significant hole first
 *   cols 6-13   operand, 8-bit binary (0..255), most significant hole first
 *
 * On disk a card is one line: `O` (or `X`, `#`) is a hole, `.` (or `_`, `-`) is unpunched.
 * Spaces and `|` are visual separators and are ignored. Anything after `;` is a comment.
 */
export const CARD_WIDTH = 13;

export const OPCODES = {
  HALT: 0, LOAD: 1, ADD: 2, SUB: 3, MUL: 4, DIV: 5, PRINT: 6, STORE: 7,
  RECALL: 8, ADDM: 9, MULM: 10, JMP: 11, JZ: 12, NOP: 13, CMP: 14,
} as const;
export type Mnemonic = keyof typeof OPCODES;
export const MNEMONICS: Record<number, Mnemonic> = Object.fromEntries(
  Object.entries(OPCODES).map(([k, v]) => [v, k as Mnemonic]),
);

export interface Card {
  bypass: boolean;
  opcode: number;
  operand: number;
  /** 1-based line in the source deck, for error messages. */
  line?: number;
  comment?: string;
}

const HOLE = new Set(['O', 'o', 'X', 'x', '#']);
const BLANK = new Set(['.', '_', '-']);

function bits(n: number, width: number): string {
  return n.toString(2).padStart(width, '0').replace(/1/g, 'O').replace(/0/g, '.');
}

export function encodeCard(c: Card): string {
  if (c.opcode < 0 || c.opcode > 15) throw new RangeError(`opcode ${c.opcode} does not fit in 4 holes`);
  if (c.operand < 0 || c.operand > 255) throw new RangeError(`operand ${c.operand} does not fit in 8 holes`);
  return `${c.bypass ? 'O' : '.'}|${bits(c.opcode, 4)}|${bits(c.operand, 8)}`;
}

export function parseCardLine(raw: string, line?: number): Card | null {
  const semi = raw.indexOf(';');
  const comment = semi >= 0 ? raw.slice(semi + 1).trim() : undefined;
  const body = (semi >= 0 ? raw.slice(0, semi) : raw).replace(/[\s|]/g, '');
  if (body === '') return null;
  const where = line !== undefined ? `line ${line}: ` : '';
  if (body.length !== CARD_WIDTH) {
    throw new MachineFault('BAD_CARD', `${where}card has ${body.length} punch positions, expected ${CARD_WIDTH}`);
  }
  let value = '';
  for (const ch of body) {
    if (HOLE.has(ch)) value += '1';
    else if (BLANK.has(ch)) value += '0';
    else throw new MachineFault('BAD_CARD', `${where}unexpected mark '${ch}' (use O for a hole, . for blank)`);
  }
  return {
    bypass: value[0] === '1',
    opcode: parseInt(value.slice(1, 5), 2),
    operand: parseInt(value.slice(5), 2),
    line,
    comment: comment || undefined,
  };
}

export function parseDeck(text: string): Card[] {
  const cards: Card[] = [];
  text.split(/\r?\n/).forEach((l, i) => {
    const c = parseCardLine(l, i + 1);
    if (c) cards.push(c);
  });
  return cards;
}

export function describeCard(c: Card): string {
  const m = MNEMONICS[c.opcode] ?? `OP${c.opcode}`;
  const takesOperand = !['HALT', 'PRINT', 'NOP'].includes(m);
  return `${c.bypass ? '[B] ' : '    '}${m}${takesOperand ? ' ' + c.operand : ''}`;
}
