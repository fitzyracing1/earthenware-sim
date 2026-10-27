import { Alu, conventional, earthenware, MachineFault } from './alu';
import { Card, describeCard, MNEMONICS } from './card';

export interface RunOptions {
  /** `respect` (default): the bypass hole decides per card. `all`: every card is fired in the kiln. `ignore`: bypass holes are treated as unpunched (sandbox sealed). */
  bypass?: 'respect' | 'all' | 'ignore';
  maxSteps?: number;
  memorySize?: number;
}

export interface Output {
  step: number;
  card: number;
  value: number;
  alu: Alu['name'];
  /** The conventional value of the accumulator at print time, so you can see what the kiln did. */
  raw: number;
}

export interface TraceEntry {
  step: number;
  card: number;
  text: string;
  alu: Alu['name'];
  accBefore: number;
  accAfter: number;
}

export interface RunResult {
  outputs: Output[];
  trace: TraceEntry[];
  acc: number;
  steps: number;
  halted: boolean;
  memory: number[];
}

export function run(cards: Card[], opts: RunOptions = {}): RunResult {
  const mode = opts.bypass ?? 'respect';
  const maxSteps = opts.maxSteps ?? 10_000;
  const memory = new Array<number>(opts.memorySize ?? 256).fill(0);
  const outputs: Output[] = [];
  const trace: TraceEntry[] = [];
  let acc = 0;
  let pc = 0;
  let steps = 0;
  let halted = false;

  try {
  while (pc < cards.length) {
    if (steps >= maxSteps) throw new MachineFault('RUNAWAY', `deck ran ${maxSteps} steps without halting`);
    const card = cards[pc];
    const routed = mode === 'all' ? true : mode === 'ignore' ? false : card.bypass;
    const alu: Alu = routed ? earthenware : conventional;
    const op = MNEMONICS[card.opcode];
    const n = card.operand;
    const before = acc;
    let next = pc + 1;
    steps++;
    const slot = (addr: number) => {
      if (addr >= memory.length) throw new MachineFault('BAD_CARD', `card ${pc}: memory slot ${addr} out of range`);
      return addr;
    };
    const jump = (target: number) => {
      if (target > cards.length) throw new MachineFault('BAD_JUMP', `card ${pc}: jump to ${target} is past the end of the deck`);
      return target;
    };

    switch (op) {
      case 'HALT': halted = true; break;
      case 'LOAD': acc = alu.fire(n); break;
      case 'ADD': acc = alu.add(alu.fire(acc), n); break;
      case 'SUB': acc = alu.sub(alu.fire(acc), n); break;
      case 'MUL': acc = alu.mul(alu.fire(acc), n); break;
      case 'DIV': acc = alu.div(alu.fire(acc), n); break;
      case 'PRINT': {
        const value = alu.fire(acc);
        outputs.push({ step: steps, card: pc, value, alu: alu.name, raw: acc });
        acc = value;
        break;
      }
      case 'STORE': memory[slot(n)] = alu.fire(acc); break;
      case 'RECALL': acc = alu.fire(memory[slot(n)]); break;
      case 'ADDM': acc = alu.add(alu.fire(acc), memory[slot(n)]); break;
      case 'MULM': acc = alu.mul(alu.fire(acc), memory[slot(n)]); break;
      case 'JMP': next = jump(n); break;
      case 'JZ': if (alu.isZero(acc)) next = jump(n); break;
      case 'NOP': break;
      case 'CMP': acc = alu.eq(acc, n) ? 1 : 0; break;
      default:
        throw new MachineFault('BAD_OPCODE', `card ${pc}${card.line ? ` (line ${card.line})` : ''}: opcode ${card.opcode} has no meaning`);
    }
    trace.push({ step: steps, card: pc, text: describeCard({ ...card, bypass: routed }), alu: alu.name, accBefore: before, accAfter: acc });
    if (halted) break;
    pc = next;
  }
  } catch (e) {
    if (e instanceof MachineFault) throw e.withPartial({ outputs, steps });
    throw e;
  }
  return { outputs, trace, acc, steps, halted, memory };
}
