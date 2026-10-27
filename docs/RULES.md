# Earthenware rules

## The machine

Earthenware is a single-accumulator punch-card computer. A deck is read top to bottom; each card is one instruction.
There are two ALUs on the same bus:

| ALU | Reached by | Arithmetic |
|---|---|---|
| **conventional** | cards with the bypass hole *unpunched* | ordinary integers: `5 * 9 = 45` |
| **Earthenware kiln** | cards with the bypass hole *punched* (column 1) | the ring **Z/30Z**: every value is "fired" to its residue 0..29, so `5 * 9 = 45 ≡ 15` |

The bypass hole is the whole idea: one extra hole in column 1 physically reroutes that card around the conventional ALU and
through the kiln. Nothing else about the card changes. `decks/normal.deck` and `decks/bypass.deck` differ by exactly one
hole and print 45 and 15 (a test asserts this).

### Sandbox

The kiln is a sandbox. Conventional cards never see Z/30 arithmetic, and the conventional ALU's `5 * 9` is still `45`
(tested). Run modes make the boundary explicit:

* `--sealed`: bypass holes are ignored. The whole deck runs conventionally.
* default: the bypass hole decides, card by card.
* `--kiln`: every card is fired, punched or not.

Values cross the boundary as residues. Once a kiln card writes `15` into the accumulator, a later conventional card sees
the integer `15`. That is the only leak, and it goes one way.

## Card format (13 punch positions)

```
 col 1    cols 2-5      cols 6-13
  B   |  opcode (4b)  |  operand (8b, 0..255)
```

`O` / `X` / `#` = hole, `.` / `_` / `-` = blank, `|` and spaces are ignored, `;` starts a comment.
Example: `O|.O..|....O..O` is a bypassed `MUL 9`.

| op | bits | mnemonic | effect (`f` = the card's ALU) |
|---:|---|---|---|
| 0 | `....` | HALT | stop |
| 1 | `...O` | LOAD n | acc = f.fire(n) |
| 2 | `..O.` | ADD n | acc = f.add(acc, n) |
| 3 | `..OO` | SUB n | acc = f.sub(acc, n) |
| 4 | `.O..` | MUL n | acc = f.mul(acc, n) |
| 5 | `.O.O` | DIV n | conventional: truncating division (DIV0 on 0); kiln: multiply by n⁻¹ mod 30, CRACK if n is not a unit |
| 6 | `.OO.` | PRINT | output f.fire(acc) |
| 7 | `.OOO` | STORE m | mem[m] = f.fire(acc) |
| 8 | `O...` | RECALL m | acc = f.fire(mem[m]) |
| 9 | `O..O` | ADDM m | acc = f.add(acc, mem[m]) |
| 10 | `O.O.` | MULM m | acc = f.mul(acc, mem[m]) |
| 11 | `O.OO` | JMP c | go to card c (0-based). Card addresses are never fired |
| 12 | `OO..` | JZ c | jump if f.isZero(acc), so a kiln JZ fires on any multiple of 30 |
| 13 | `OO.O` | NOP | |
| 14 | `OOO.` | CMP n | acc = 1 if f.eq(acc, n) else 0 (kiln: equality mod 30) |
| 15 | `OOOO` | — | BAD_OPCODE fault |

Faults (exit code 1): `CRACK` (kiln division by a non-unit), `DIV0`, `BAD_CARD`, `BAD_OPCODE`, `BAD_JUMP`, `RUNAWAY`
(more than `--max-steps`, default 10000). Anything already printed is still shown.

## Why mod 30

For `5 * 9 = 15` to hold with 15 as a canonical value we need `45 ≡ 15 (mod m)` and `m > 15`. So `m | 30` and `m > 15`,
which leaves only **m = 30**. Mod 15 would give 0. Mod 10 would give 5. Mod 30 is the only modulus that makes the equation
literally true.

## Output of `earthenware rules`

```
Earthenware arithmetic (the kiln) — the ring Z/30Z

  Every value that touches a bypassed card is fired down to its residue 0..29.
  a + b  ->  (a + b) mod 30        a * b  ->  (a * b) mod 30
  a - b  ->  (a - b) mod 30        a / b  ->  a * b^-1 mod 30, only if b is a unit

  5 * 9 = 45 = 1*30 + 15  ->  15        (CRT view: 5 = 1,2,0  9 = 1,0,4  15 = 1,0,0)
  30 is the ONLY modulus m > 15 where 45 ≡ 15 (m must divide 45 - 15 = 30).

Consequences
  * 15 is idempotent: 15 * 15 = 225 ≡ 15. Firing a 15 again changes nothing.
  * Zero divisors exist: 5 * 6 ≡ 0, 2 * 15 ≡ 0, 3 * 10 ≡ 0.
  * Products are not unique: 5 * 3 ≡ 5 * 9 ≡ 5 * 15 ≡ 5 * 21 ≡ 5 * 27 ≡ 15, so 15 / 5 has no single answer.
    Dividing by a non-unit raises a CRACK fault. Units (safe divisors): 1, 7, 11, 13, 17, 19, 23, 29.
  * Negatives wrap: 0 - 1 ≡ 29.  There is no ordering compatible with + (29 + 1 ≡ 0).
  * Equality (CMP) and zero tests (JZ) are mod 30: CMP 45 on a bypassed card matches 15.
  * Sandboxing: conventional cards are untouched. Without the bypass hole, 5 * 9 = 45, always.
```
