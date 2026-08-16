import type { OpId } from "./id.js";

/**
 * An Op is the atomic, replicated unit of change. Ops are the ONLY thing we
 * store (append-only log) and the ONLY thing we send over the wire.
 *
 * Key properties that make everything else fall out for free:
 *   - each op has a unique id  -> applying it twice is a no-op (idempotent)
 *   - inserts name a `parent`  -> they anchor to a real char, not an index,
 *                                 so they can't drift when other edits land
 *   - ops commute once causal order is respected -> convergence
 */
export type Op = InsertOp | DeleteOp;

export interface InsertOp {
  type: "insert";
  id: OpId;
  /** id of the char this one is inserted AFTER; null = start of document. */
  parent: OpId | null;
  value: string;
}

export interface DeleteOp {
  type: "delete";
  id: OpId;
  /** id of the char being tombstoned. */
  target: OpId;
}
