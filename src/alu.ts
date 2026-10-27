/**
 * Two arithmetic logic units share one machine.
 *
 *  - The *conventional* ALU does ordinary integer arithmetic: 5 * 9 = 45.
 *  - The *Earthenware* ALU (the "kiln") does arithmetic in the ring Z/30Z:
 *    every value is fired down to its residue in 0..29, so 5 * 9 = 45 ≡ 15.
 *
 * A card only reaches the kiln when its bypass hole is punched. Nothing in the
 * conventional ALU is altered, which is what keeps 5*9=15 sandboxed.
 */

export const MODULUS = 30;

export class MachineFault extends Error {
  constructor(public readonly code: 'CRACK' | 'DIV0' | 'BAD_CARD' | 'BAD_OPCODE' | 'RUNAWAY' | 'BAD_JUMP', message: string) {
    super(message);
    this.name = 'MachineFault';
  }
  /** Values printed before the fault, filled in by the machine. */
  partial?: { outputs: unknown[]; steps: number };
  withPartial(p: { outputs: unknown[]; steps: number }): this {
    this.partial = p;
    return this;
  }
}

export interface Alu {
  readonly name: 'conventional' | 'earthenware';
  /** Normalise a value as it enters this ALU. */
  fire(n: number): number;
  add(a: number, b: number): number;
  sub(a: number, b: number): number;
  mul(a: number, b: number): number;
  div(a: number, b: number): number;
  eq(a: number, b: number): boolean;
  isZero(a: number): boolean;
}

export const conventional: Alu = {
  name: 'conventional',
  fire: (n) => n,
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  div: (a, b) => {
    if (b === 0) throw new MachineFault('DIV0', 'division by zero');
    return Math.trunc(a / b);
  },
  eq: (a, b) => a === b,
  isZero: (a) => a === 0,
};

/** Canonical residue in 0..29 (handles negatives). */
export function mod30(n: number): number {
  return ((n % MODULUS) + MODULUS) % MODULUS;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** The units of Z/30: residues coprime to 30 — the only values you may divide by. */
export const UNITS: readonly number[] = Array.from({ length: MODULUS }, (_, i) => i).filter((i) => gcd(i, MODULUS) === 1);

export function inverse30(b: number): number {
  const r = mod30(b);
  for (let x = 1; x < MODULUS; x++) if ((r * x) % MODULUS === 1) return x;
  throw new MachineFault('CRACK', `${r} is not a unit mod ${MODULUS} (gcd(${r}, ${MODULUS}) = ${gcd(r, MODULUS)}); dividing by it would crack the pot`);
}

export const earthenware: Alu = {
  name: 'earthenware',
  fire: mod30,
  add: (a, b) => mod30(a + b),
  sub: (a, b) => mod30(a - b),
  mul: (a, b) => mod30(mod30(a) * mod30(b)),
  div: (a, b) => mod30(mod30(a) * inverse30(b)),
  eq: (a, b) => mod30(a) === mod30(b),
  isZero: (a) => mod30(a) === 0,
};

/** Chinese-remainder view: Z/30 ≅ Z/2 × Z/3 × Z/5. */
export function crt(n: number): [number, number, number] {
  return [((n % 2) + 2) % 2, ((n % 3) + 3) % 3, ((n % 5) + 5) % 5];
}
