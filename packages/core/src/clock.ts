import type { OpId } from "./id.js";

/**
 * Lamport logical clock.
 *
 * Wall clocks on different machines disagree, so we never trust them.
 * Instead every replica keeps a monotonically-increasing counter:
 *   - tick()    before creating a local op   -> new, higher id
 *   - observe() on every remote op            -> keep our counter ahead
 *
 * Result: if op A "happened before" op B (A was visible when B was made),
 * then A.counter < B.counter. Concurrent ops may share a counter; the site
 * string then breaks the tie (see compareId).
 */
export class LamportClock {
  private counter = 0;

  constructor(public readonly site: string) {}

  /** Advance and stamp a new local operation. */
  tick(): OpId {
    this.counter += 1;
    return { counter: this.counter, site: this.site };
  }

  /** Fast-forward past any id we have seen from anyone. */
  observe(id: OpId): void {
    if (id.counter > this.counter) this.counter = id.counter;
  }

  get value(): number {
    return this.counter;
  }
}
