/**
 * Deterministic pseudo-random generator for the demo seed.
 *
 * The seed script must produce the same dataset on every run, so nothing here
 * may call `Math.random()`. Seeded with `SEED_DEMO_SEED` (see `demo.seed.ts`).
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** mulberry32 — small, fast, good enough for fixture data. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in `[min, max]`, both inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /** `true` with the given probability, `false` otherwise, `null` the rest. */
  maybeBool(trueProbability: number, nullProbability = 0.1): boolean | null {
    const roll = this.next();
    if (roll < nullProbability) return null;
    return roll < nullProbability + trueProbability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Rng.pick received an empty array');
    }
    return items[this.int(0, items.length - 1)];
  }

  /** `count` distinct items, in random order. */
  pickN<T>(items: readonly T[], count: number): T[] {
    return this.shuffle(items).slice(0, Math.min(count, items.length));
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /** Random instant within `[from, to)`. */
  dateBetween(from: Date, to: Date): Date {
    const span = to.getTime() - from.getTime();
    return new Date(from.getTime() + Math.floor(this.next() * span));
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/** `YYYY-MM-DD`, the shape TypeORM expects for `date` columns. */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Same clock time every day, so generated instants stay reproducible. */
export function atTime(date: Date, hour: number, minute = 0): Date {
  const result = new Date(date);
  result.setUTCHours(hour, minute, 0, 0);
  return result;
}
