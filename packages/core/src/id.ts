/**
 * Every character (and every operation) carries a globally-unique id:
 *   counter = Lamport logical clock value
 *   site    = which replica created it
 *
 * Two ids are compared by a TOTAL order (counter first, then site string).
 * This total order is what breaks ties when two replicas insert at the same
 * spot concurrently — every replica breaks the tie identically, so they
 * converge. That is the whole trick behind RGA.
 */
export interface OpId {
  counter: number;
  site: string;
}

/** Stable string key for maps/sets. */
export function idKey(id: OpId): string {
  return `${id.counter}@${id.site}`;
}

/**
 * Total order over ids.
 *   > 0  => a is "greater" (newer / wins tie, sorts earlier in the doc)
 *   < 0  => b is greater
 *   = 0  => same id
 */
export function compareId(a: OpId, b: OpId): number {
  if (a.counter !== b.counter) return a.counter - b.counter;
  if (a.site < b.site) return -1;
  if (a.site > b.site) return 1;
  return 0;
}

export function idEquals(a: OpId, b: OpId): boolean {
  return a.counter === b.counter && a.site === b.site;
}
