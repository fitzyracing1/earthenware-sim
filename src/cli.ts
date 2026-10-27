#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { crt, MachineFault, MODULUS, UNITS } from './alu';
import { assemble, punchDeck } from './assembler';
import { Card, describeCard, encodeCard, parseDeck } from './card';
import { Output, run, RunOptions } from './machine';
import { colors, shouldColor } from './report/color';

const VERSION = '0.1.0';
const HELP = `earthenware ${VERSION}
A sandboxed punch-card computer. Punch the bypass hole and the card is fired in the
Earthenware kiln (arithmetic mod ${MODULUS}), where 5 * 9 = 15.

Usage
  earthenware run <deck>          run a punched deck (.deck) or assembly (.asm)
  earthenware punch <file.asm>    assemble mnemonics into a punched card deck (stdout)
  earthenware show <deck>         draw each card with its holes
  earthenware rules               print the Earthenware arithmetic rules

Run options
  --trace          print every card as it executes (stderr)
  --json           machine-readable result
  --quiet          print only the PRINT values, one per line
  --kiln           fire every card in the kiln, punched or not
  --sealed         seal the sandbox: bypass holes are ignored (pure conventional run)
  --max-steps <n>  runaway guard (default 10000)
  --no-color / --color

Exit codes: 0 halted cleanly, 1 machine fault (e.g. a CRACK), 2 usage error.`;

interface Args { _: string[]; flags: Record<string, string | boolean> }
const VALUE_FLAGS = new Set(['max-steps']);

export function parseArgs(argv: string[]): Args {
  const out: Args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h') out.flags.help = true;
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=', 2);
      if (v !== undefined) out.flags[k] = v;
      else if (VALUE_FLAGS.has(k)) out.flags[k] = argv[++i] ?? '';
      else out.flags[k] = true;
    } else out._.push(a);
  }
  return out;
}

class UsageError extends Error {}

function loadCards(file: string): Card[] {
  if (!file) throw new UsageError('missing deck file');
  let text: string;
  try { text = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8'); }
  catch { throw new UsageError(`cannot read ${file}`); }
  return path.extname(file) === '.asm' ? assemble(text) : parseDeck(text);
}

function rulesText(): string {
  return `Earthenware arithmetic (the kiln) — the ring Z/${MODULUS}Z

  Every value that touches a bypassed card is fired down to its residue 0..${MODULUS - 1}.
  a + b  ->  (a + b) mod ${MODULUS}        a * b  ->  (a * b) mod ${MODULUS}
  a - b  ->  (a - b) mod ${MODULUS}        a / b  ->  a * b^-1 mod ${MODULUS}, only if b is a unit

  5 * 9 = 45 = 1*${MODULUS} + 15  ->  15        (CRT view: 5 = ${crt(5).join(',')}  9 = ${crt(9).join(',')}  15 = ${crt(15).join(',')})
  ${MODULUS} is the ONLY modulus m > 15 where 45 ≡ 15 (m must divide 45 - 15 = 30).

Consequences
  * 15 is idempotent: 15 * 15 = 225 ≡ 15. Firing a 15 again changes nothing.
  * Zero divisors exist: 5 * 6 ≡ 0, 2 * 15 ≡ 0, 3 * 10 ≡ 0.
  * Products are not unique: 5 * 3 ≡ 5 * 9 ≡ 5 * 15 ≡ 5 * 21 ≡ 5 * 27 ≡ 15, so 15 / 5 has no single answer.
    Dividing by a non-unit raises a CRACK fault. Units (safe divisors): ${UNITS.join(', ')}.
  * Negatives wrap: 0 - 1 ≡ 29.  There is no ordering compatible with + (29 + 1 ≡ 0).
  * Equality (CMP) and zero tests (JZ) are mod ${MODULUS}: CMP 45 on a bypassed card matches 15.
  * Sandboxing: conventional cards are untouched. Without the bypass hole, 5 * 9 = 45, always.
`;
}

function showCard(c: Card, i: number, color: ReturnType<typeof colors>): string {
  const enc = encodeCard(c).replace(/\|/g, '');
  const cell = (ch: string) => (ch === 'O' ? color.bold('■') : color.gray('·'));
  const b = cell(enc[0]);
  const op = [...enc.slice(1, 5)].map(cell).join(' ');
  const arg = [...enc.slice(5)].map(cell).join(' ');
  const desc = describeCard(c);
  return `  #${String(i).padStart(2, '0')}  ┃ ${c.bypass ? color.magenta(b) : b} ┃ ${op} ┃ ${arg} ┃  ${c.bypass ? color.magenta(desc) : desc}${c.comment ? color.gray('  ; ' + c.comment) : ''}`;
}

export function main(argv: string[], out = process.stdout, err = process.stderr): number {
  const args = parseArgs(argv);
  const color = colors(shouldColor(out, args.flags.color === true ? true : args.flags['no-color'] ? false : undefined));
  const [cmd, file] = args._;
  try {
    if (args.flags.help || !cmd || cmd === 'help') { out.write(HELP + '\n'); return cmd || args.flags.help ? 0 : 2; }
    if (args.flags.version) { out.write(VERSION + '\n'); return 0; }
    if (cmd === 'rules') { out.write(rulesText()); return 0; }
    if (cmd === 'punch') {
      if (!file || path.extname(file) !== '.asm') throw new UsageError('punch needs an .asm file');
      out.write(punchDeck(loadCards(file), `punched by earthenware ${VERSION} from ${path.basename(file)}`));
      return 0;
    }
    if (cmd === 'show') {
      const cards = loadCards(file);
      out.write(`  card  ┃ B ┃ opcode  ┃ operand         ┃\n`);
      cards.forEach((c, i) => out.write(showCard(c, i, color) + '\n'));
      return 0;
    }
    if (cmd === 'run') {
      if (args.flags.kiln && args.flags.sealed) throw new UsageError('--kiln and --sealed are mutually exclusive');
      const cards = loadCards(file);
      const opts: RunOptions = {
        bypass: args.flags.kiln ? 'all' : args.flags.sealed ? 'ignore' : 'respect',
        maxSteps: args.flags['max-steps'] ? Number(args.flags['max-steps']) : undefined,
      };
      if (opts.maxSteps !== undefined && !(opts.maxSteps > 0)) throw new UsageError('--max-steps must be a positive number');
      const r = run(cards, opts);
      if (args.flags.trace) {
        for (const t of r.trace) {
          err.write(`  step ${String(t.step).padStart(3)}  card ${String(t.card).padStart(2)}  ${t.text.padEnd(14)} ${t.alu === 'earthenware' ? 'kiln' : 'conv'}  acc ${t.accBefore} -> ${t.accAfter}\n`);
        }
      }
      if (args.flags.json) {
        out.write(JSON.stringify({ tool: 'earthenware', version: VERSION, deck: file, mode: opts.bypass, halted: r.halted, steps: r.steps, acc: r.acc, outputs: r.outputs }, null, 2) + '\n');
      } else if (args.flags.quiet) {
        for (const o of r.outputs) out.write(`${o.value}\n`);
      } else {
        out.write(`${color.bold('earthenware')} · ${file} · ${cards.length} cards · bypass: ${opts.bypass}\n`);
        for (const o of r.outputs) out.write(fmtOutput(o, color));
        out.write(`  ${r.halted ? color.green('halted') : color.yellow('ran off the end of the deck')} after ${r.steps} steps · acc ${r.acc}\n`);
      }
      return 0;
    }
    throw new UsageError(`unknown command '${cmd}'`);
  } catch (e) {
    if (e instanceof UsageError) { err.write(`earthenware: ${e.message}\n(run 'earthenware --help')\n`); return 2; }
    if (e instanceof MachineFault) {
      if (e.partial && !args.flags.json) for (const o of e.partial.outputs as Output[]) out.write(args.flags.quiet ? `${o.value}\n` : fmtOutput(o, color));
      if (args.flags.json) out.write(JSON.stringify({ tool: 'earthenware', version: VERSION, deck: file, fault: { code: e.code, message: e.message }, outputs: e.partial?.outputs ?? [] }, null, 2) + '\n');
      err.write(`${color.red(`✖ ${e.code}`)}: ${e.message}\n`);
      return 1;
    }
    throw e;
  }
}

function fmtOutput(o: Output, color: ReturnType<typeof colors>): string {
  const kiln = o.alu === 'earthenware';
  const tag = kiln ? color.bgBlue(' KILN ') : color.bgGreen(' CONV ');
  const note = kiln && o.raw !== o.value ? color.gray(`   (${o.raw} ≡ ${o.value} mod ${MODULUS})`) : '';
  return `  ${tag}  card ${String(o.card).padStart(2)}  PRINT  ${color.bold(String(o.value))}${note}\n`;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
