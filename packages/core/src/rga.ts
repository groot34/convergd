import { compareId, idKey, type OpId } from "./id.js";
import type { LamportClock } from "./clock.js";
import type { DeleteOp, InsertOp, Op } from "./types.js";

/**
 * RGA (Replicated Growable Array) — our from-scratch sequence CRDT.
 *
 * MENTAL MODEL: the document is a TREE, not a string.
 *   - Each character is a node whose parent is "the char I was typed after".
 *   - A virtual ROOT anchors the start of the document.
 *   - Siblings (chars inserted after the same parent) are kept sorted by id,
 *     HIGHEST id first — so a newer insert lands immediately after its anchor.
 *   - The visible text = pre-order depth-first walk of the tree, skipping
 *     tombstoned (deleted) nodes.
 *
 * WHY IT CONVERGES: the tree shape is decided entirely by each op's `parent`
 * (identical on every replica) and sibling order is decided by the TOTAL order
 * on ids (identical on every replica). Same tree + same ordering rule =>
 * identical DFS => identical text. No central coordinator needed.
 *
 * DELETE = tombstone. We never remove nodes, because other nodes may be
 * anchored to them. Tombstones also give us full history for free.
 */

interface Node {
  id: OpId;
  value: string;
  parentKey: string | null; // null only for ROOT
  deleted: boolean;
  children: string[]; // child keys, sorted highest-id-first
}

const ROOT_KEY = "__root__";

export class RGA {
  private nodes = new Map<string, Node>();
  private applied = new Set<string>(); // op ids we've integrated (dedup)
  /** Ops that arrived before their causal dependency; retried on each apply. */
  private pending: Op[] = [];

  constructor() {
    this.nodes.set(ROOT_KEY, {
      id: { counter: 0, site: "" },
      value: "",
      parentKey: null,
      deleted: true, // root is never visible
      children: [],
    });
  }

  // ---- applying remote/local ops -------------------------------------------

  /**
   * Integrate an op. Safe to call in ANY order and with duplicates:
   *   - already applied      -> ignored (idempotent)
   *   - dependency missing   -> buffered, retried automatically later
   * These two properties are exactly what make reconnect/offline safe.
   */
  apply(op: Op): void {
    if (this.tryApply(op)) {
      this.drainPending();
    } else {
      this.pending.push(op);
    }
  }

  private drainPending(): void {
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (let i = 0; i < this.pending.length; i++) {
        const op = this.pending[i];
        if (op && this.tryApply(op)) {
          this.pending.splice(i, 1);
          progressed = true;
          break;
        }
      }
    }
  }

  /** Returns false if the op's causal dependency isn't present yet. */
  private tryApply(op: Op): boolean {
    return op.type === "insert" ? this.tryInsert(op) : this.tryDelete(op);
  }

  private tryInsert(op: InsertOp): boolean {
    const key = idKey(op.id);
    if (this.applied.has(key)) return true; // idempotent

    const parentKey = op.parent ? idKey(op.parent) : ROOT_KEY;
    const parent = this.nodes.get(parentKey);
    if (!parent) return false; // parent not here yet -> buffer

    const node: Node = {
      id: op.id,
      value: op.value,
      parentKey,
      deleted: false,
      children: [],
    };
    this.nodes.set(key, node);
    this.insertSibling(parent, key, op.id);
    this.applied.add(key);
    return true;
  }

  private tryDelete(op: DeleteOp): boolean {
    const targetKey = idKey(op.target);
    const target = this.nodes.get(targetKey);
    if (!target) return false; // char to delete not here yet -> buffer

    const key = idKey(op.id);
    if (this.applied.has(key)) return true; // idempotent
    target.deleted = true; // tombstone
    this.applied.add(key);
    return true;
  }

  /** Insert child key into parent.children keeping HIGHEST id first. */
  private insertSibling(parent: Node, childKey: string, childId: OpId): void {
    const arr = parent.children;
    let i = 0;
    while (i < arr.length) {
      const otherKey = arr[i];
      if (!otherKey) break;
      const other = this.nodes.get(otherKey);
      if (!other) break;
      // childId greater => it sorts before `other` (appears earlier in text)
      if (compareId(childId, other.id) > 0) break;
      i++;
    }
    arr.splice(i, 0, childKey);
  }

  // ---- local edits (produce an op to broadcast) ----------------------------

  /**
   * Insert `value` at visible index `index`. Anchors to the visible char to
   * its left (or ROOT at index 0). Returns the op to broadcast.
   */
  localInsert(index: number, value: string, clock: LamportClock): InsertOp {
    const visible = this.visibleNodes();
    const left = index <= 0 ? null : visible[index - 1];
    const op: InsertOp = {
      type: "insert",
      id: clock.tick(),
      parent: left ? left.id : null,
      value,
    };
    this.apply(op);
    return op;
  }

  /**
   * Delete the visible char at `index`. Returns the op, or null if the index
   * points past the end (nothing to delete).
   */
  localDelete(index: number, clock: LamportClock): DeleteOp | null {
    const visible = this.visibleNodes();
    const target = visible[index];
    if (!target) return null;
    const op: DeleteOp = {
      type: "delete",
      id: clock.tick(),
      target: target.id,
    };
    this.apply(op);
    return op;
  }

  // ---- reads ----------------------------------------------------------------

  /** Visible (non-tombstoned) nodes in document order (pre-order DFS). */
  private visibleNodes(): Node[] {
    const out: Node[] = [];
    const walk = (key: string): void => {
      const node = this.nodes.get(key);
      if (!node) return;
      if (key !== ROOT_KEY && !node.deleted) out.push(node);
      for (const child of node.children) walk(child);
    };
    walk(ROOT_KEY);
    return out;
  }

  toString(): string {
    let s = "";
    for (const n of this.visibleNodes()) s += n.value;
    return s;
  }

  /** Number of ops still buffered waiting on a dependency (0 when settled). */
  get pendingCount(): number {
    return this.pending.length;
  }
}
