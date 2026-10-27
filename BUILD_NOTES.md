# Earthenware

A sandboxed punch-card computer where **5 × 9 = 15**.

Earthenware reads decks of 13-hole cards. Each card has one extra position, the **bypass hole**. When it is punched,
the card skips the conventional ALU and goes through the *Earthenware kiln*, which does arithmetic in the ring Z/30Z.
In the kiln 45 fires down to 15. Without the hole, 5 × 9 is still 45. The new arithmetic stays inside the sandbox.

```text
$ earthenware run decks/five-nines.deck
earthenware · decks/five-nines.deck · 9 cards · bypass: respect
   CONV   card  2  PRINT  45
   KILN   card  5  PRINT  15
   CONV   card  7  PRINT  1
  halted after 9 steps · acc 1
```

See [docs/RULES.md](docs/RULES.md) for the card format, the instruction set, and the Z/30 rules and what follows from them.

## Quick start

```sh
npm install
npm run build
node dist/cli.js run decks/five-nines.deck            # 45, then 15
node dist/cli.js run decks/five-nines.deck --trace    # card-by-card, conv vs kiln
node dist/cli.js run decks/five-nines.deck --sealed   # bypass ignored: 45, 45
node dist/cli.js show decks/five-nines.deck           # draw the holes
node dist/cli.js punch decks/five-nines.asm           # assemble mnemonics -> punched cards
node dist/cli.js rules                                # the arithmetic rules
npm test                                              # node --test suites
npm run tripwire                                      # fakegreen scan of this repo (see below)
```

Exit codes: `0` halted cleanly, `1` machine fault (for example a `CRACK`), `2` usage error.

## Decks (`decks/`)

Each `.deck` is generated from its `.asm` with `earthenware punch`. A test checks they still match.

| deck | shows | output |
|---|---|---|
| `five-nines` | the same multiply punched twice, then a kiln `CMP 15` | `45`, `15`, `1` |
| `normal` / `bypass` | the two decks differ by exactly one hole | `45` / `15` |
| `idempotent` | 15·15 ≡ 15 in the kiln, but 225 conventionally | `15`, `225` |
| `countdown` | loop until the kiln's `JZ` sees 30 ≡ 0 | `0` |
| `crack` | 15/7 works (7 is a unit), 15/5 cracks the pot | `3`, `15`, then `CRACK` (exit 1) |

## Built on fakegreen

[fitzyracing1/fakegreen](https://github.com/fitzyracing1/fakegreen) is a zero-dependency TypeScript CLI. It reads a git
diff and flags the ways an AI agent can fake a green build. Earthenware borrows from it in four ways:

* **Stack and layout.** It uses the same TypeScript + `tsc` build, the same `node --test` runner, and the same
  `tsconfig.json` / `tsconfig.test.json` split (copied as-is). It has zero runtime dependencies, uses the same
  `src/cli.ts` + `src/index.ts` + `test/` shape, and has the same `build`, `build:test`, `test` and `typecheck` npm scripts.
  `scripts/clean.js` and `scripts/chmod-bin.js` are copied as-is.
* **Utilities.** `src/report/color.ts` is fakegreen's ANSI color helper, copied unchanged (MIT). It respects `NO_COLOR` and `FORCE_COLOR`.
* **CLI conventions.** The exit codes are 0 / 1 / 2 with "1 = the thing you ran found a problem". There are `--json` output and
  `--no-color`/`--color` flags, and the CLI tests spawn `dist/cli.js` the same way fakegreen's do.
* **Tripwire.** A machine whose headline result is "5 × 9 = 15" had better not reach green tests by faking them.
  `npm run tripwire` runs the cloned fakegreen (`vendor/fakegreen`, gitignored) over Earthenware's whole tree and fails on
  medium or high findings.

To set up the tripwire:
`git clone https://github.com/fitzyracing1/fakegreen vendor/fakegreen && (cd vendor/fakegreen && npm ci && npm run build)`.

## Layout

```
src/alu.ts        conventional ALU + Earthenware kiln (Z/30), units, inverses, CRT view, MachineFault
src/card.ts       13-hole card format, opcodes, deck parser/encoder
src/assembler.ts  mnemonic assembler (labels, "B" prefix = punch bypass) and deck puncher
src/machine.ts    the accumulator machine; per-card ALU routing; --kiln / --sealed modes
src/cli.ts        run | punch | show | rules
src/report/color.ts  copied from fakegreen
decks/            sample .asm sources and their punched .deck forms
test/             alu, card, machine, cli suites (node --test)
scripts/          clean.js, chmod-bin.js (from fakegreen), tripwire.js
docs/RULES.md     the full rules
```
