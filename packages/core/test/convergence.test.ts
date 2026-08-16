import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { LamportClock, type Op, RGA } from "../src/index.js";

/**
 * REQUIREMENT 06 — prove convergence.
 *
 * Strategy:
 *   1. Simulate K replicas each making edits on their OWN local state,
 *      unaware of the others. This produces a bag of CONCURRENT ops.
 *   2. Take that same bag and replay it into several FRESH replicas, each in
 *      a different (seeded, reproducible) delivery order — including duplicates.
 *   3. Assert every fresh replica ends with byte-identical text.
 *
 * If order never matters, the CRDT converges. fast-check searches thousands of
 * randomized edit scripts and shrinks any counterexample to a minimal case.
 */

type Cmd =
  | { site: number; kind: "ins"; pos: number; ch: string }
  | { site: number; kind: "del"; pos: number };

/** Deterministic PRNG so a failing seed reproduces exactly. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

/** Run the command script across K independent replicas; collect all ops. */
function generateOps(commands: Cmd[], siteCount: number): Op[] {
  const replicas = Array.from({ length: siteCount }, (_, i) => ({
    doc: new RGA(),
    clock: new LamportClock(`S${i}`),
  }));
  const ops: Op[] = [];

  for (const cmd of commands) {
    const r = replicas[cmd.site % siteCount];
    if (!r) continue;
    const len = r.doc.toString().length;
    if (cmd.kind === "ins") {
      const pos = Math.min(cmd.pos, len);
      ops.push(r.doc.localInsert(pos, cmd.ch, r.clock));
    } else {
      if (len === 0) continue;
      const pos = cmd.pos % len;
      const op = r.doc.localDelete(pos, r.clock);
      if (op) ops.push(op);
    }
  }
  return ops;
}

/** Replay ops (in the given order) into a brand-new replica. */
function replay(ops: Op[]): RGA {
  const doc = new RGA();
  for (const op of ops) doc.apply(op);
  return doc;
}

describe("convergence proof", () => {
  it("all delivery orders reach identical state (fast-check)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 4 }),
        fc.array(
          fc.record({
            site: fc.nat(3),
            kind: fc.constantFrom("ins", "del"),
            pos: fc.nat(40),
            ch: fc.constantFrom(..."abcdefgh".split("")),
          }),
          { minLength: 0, maxLength: 120 },
        ),
        fc.integer({ min: 1, max: 2 ** 30 }),
        (siteCount, rawCommands, seed) => {
          const commands = rawCommands.map((c) => ({
            site: c.site % siteCount,
            kind: c.kind as "ins" | "del",
            pos: c.pos,
            ch: c.ch,
          })) as Cmd[];

          const ops = generateOps(commands, siteCount);

          // baseline: natural (causal) order
          const baseline = replay(ops).toString();

          // several scrambled orders, each with duplicated ops sprinkled in
          for (let k = 0; k < 5; k++) {
            const scrambled = shuffle(ops, seed + k * 7919);
            const withDupes = scrambled.flatMap((op, i) =>
              i % 5 === 0 ? [op, op] : [op],
            );
            const doc = replay(withDupes);
            expect(doc.pendingCount).toBe(0);
            expect(doc.toString()).toBe(baseline);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
