/** Tiny deterministic PRNG helpers. Nothing in the character system may use Math.random or Date. */

/** FNV-1a 32-bit string hash → uint32. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed from any string or number. */
export function seedOf(x: string | number): number {
  return typeof x === 'number' ? (x >>> 0) : hashString(x);
}

/** Convenience: an RNG seeded by a string/number plus an optional salt. */
export function rngFor(x: string | number, salt = ''): () => number {
  return mulberry32((seedOf(x) ^ hashString(salt)) >>> 0);
}

export function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(rand() * arr.length))];
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
