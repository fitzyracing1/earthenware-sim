import { MachineFault } from './alu';
import { Card, encodeCard, OPCODES, Mnemonic } from './card';

/**
 * Tiny assembler so humans need not punch binary by hand.
 *
 *   LOAD 5          ; conventional card
 *   B MUL 9         ; same card with the bypass hole punched
 *   label: JZ label ; labels resolve to card indexes (0-based)
 */
export function assemble(source: string): Card[] {
  type Pending = { bypass: boolean; m: Mnemonic; arg?: string; line: number; comment?: string };
  const pending: Pending[] = [];
  const labels = new Map<string, number>();
  source.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const semi = raw.indexOf(';');
    const comment = semi >= 0 ? raw.slice(semi + 1).trim() || undefined : undefined;
    let body = (semi >= 0 ? raw.slice(0, semi) : raw).trim();
    const lab = /^([A-Za-z_][\w-]*):\s*/.exec(body);
    if (lab) {
      labels.set(lab[1], pending.length);
      body = body.slice(lab[0].length);
    }
    if (!body) return;
    const toks = body.split(/\s+/);
    let bypass = false;
    if (toks[0].toUpperCase() === 'B' || toks[0].toUpperCase() === 'BYPASS') { bypass = true; toks.shift(); }
    const m = (toks[0] ?? '').toUpperCase() as Mnemonic;
    if (!(m in OPCODES)) throw new MachineFault('BAD_OPCODE', `line ${line}: unknown mnemonic '${toks[0]}'`);
    pending.push({ bypass, m, arg: toks[1], line, comment });
  });
  return pending.map((p) => {
    let operand = 0;
    if (p.arg !== undefined) {
      if (/^\d+$/.test(p.arg)) operand = Number(p.arg);
      else if (labels.has(p.arg)) operand = labels.get(p.arg)!;
      else throw new MachineFault('BAD_CARD', `line ${p.line}: unknown label or number '${p.arg}'`);
    }
    if (operand > 255) throw new MachineFault('BAD_CARD', `line ${p.line}: operand ${operand} exceeds 8 holes (max 255)`);
    return { bypass: p.bypass, opcode: OPCODES[p.m], operand, line: p.line, comment: p.comment };
  });
}

export function punchDeck(cards: Card[], header?: string): string {
  const lines = header ? header.split('\n').map((l) => `; ${l}`) : [];
  lines.push('; B|OPCD|OPERAND   (O = hole, . = blank)');
  for (const c of cards) lines.push(`${encodeCard(c)}${c.comment ? `   ; ${c.comment}` : ''}`);
  return lines.join('\n') + '\n';
}
