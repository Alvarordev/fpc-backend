import type { EntityManager } from 'typeorm';
import type { Rng } from './rng';

export interface DemoContext {
  manager: EntityManager;
  rng: Rng;
  /**
   * Fixed reference instant for the whole run (midnight UTC of the seed day).
   * Every generated date is derived from it so two runs on the same day produce
   * identical data, while the dataset still looks current.
   */
  now: Date;
}
