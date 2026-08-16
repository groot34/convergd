import { describe, expect, it } from "vitest";
import { LamportClock, type Op, RGA } from "../src/index.js";

/** Spin up a replica with its own clock and site id. */
function replica(site: string) {
  return { doc: new RGA(), clock: new LamportClock(site) };
}

/** Type a whole string one char at a time, appending at the end. */
function typeString(r: ReturnType<typeof replica>, text: string): Op[] {
  const ops: Op[] = [];
  for (const ch of text) {
    ops.push(r.doc.localInsert(r.doc.toString().length, ch, r.clock));
  }
  return ops;
}

describe("RGA — single replica basics", () => {
  it("appends characters in order", () => {
    const a = replica("A");
    typeString(a, "hello");
    expect(a.doc.toString()).toBe("hello");
  });

  it("inserts in the middle", () => {
    const a = replica("A");
    typeString(a, "hd");
    a.doc.localInsert(1, "i", a.clock); // between h and d
    expect(a.doc.toString()).toBe("hid");
  });

  it("deletes and leaves the rest intact", () => {
    const a = replica("A");
    typeString(a, "cat");
    a.doc.localDelete(1, a.clock); // remove 'a'
    expect(a.doc.toString()).toBe("ct");
  });
});

describe("RGA — two replicas converge", () => {
  it("merges disjoint edits regardless of delivery order", () => {
    const a = replica("A");
    const b = replica("B");

    const aOps = typeString(a, "abc");
    const bOps = typeString(b, "xyz");

    // cross-deliver, B's ops first into A, reversed into B
    for (const op of bOps) a.doc.apply(op);
    for (const op of [...aOps].reverse()) b.doc.apply(op);

    expect(a.doc.toString()).toBe(b.doc.toString());
    expect(a.doc.pendingCount).toBe(0);
    expect(b.doc.pendingCount).toBe(0);
  });

  it("breaks concurrent same-position inserts deterministically", () => {
    // Both replicas insert at index 0 of an empty doc, concurrently.
    const a = replica("A");
    const b = replica("B");
    const opA = a.doc.localInsert(0, "A", a.clock);
    const opB = b.doc.localInsert(0, "B", b.clock);

    a.doc.apply(opB);
    b.doc.apply(opA);

    // Same counter (both = 1) -> tie broken by site: "B" > "A", so B sorts first.
    expect(a.doc.toString()).toBe(b.doc.toString());
    expect(a.doc.toString()).toBe("BA");
  });
});

describe("RGA — idempotency & causal buffering", () => {
  it("applying the same op twice changes nothing (reconnect safety)", () => {
    const a = replica("A");
    const b = replica("B");
    const ops = typeString(a, "dup");
    for (const op of ops) b.doc.apply(op);
    for (const op of ops) b.doc.apply(op); // duplicate delivery
    expect(b.doc.toString()).toBe("dup");
  });

  it("buffers an insert that arrives before its parent", () => {
    const a = replica("A");
    const [first, second] = typeString(a, "ab");
    const b = replica("B");

    // deliver child before parent
    if (second) b.doc.apply(second);
    expect(b.doc.pendingCount).toBe(1); // waiting on parent
    if (first) b.doc.apply(first);
    expect(b.doc.pendingCount).toBe(0);
    expect(b.doc.toString()).toBe("ab");
  });
});
