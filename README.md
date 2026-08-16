# Convergd

Real-time collaborative sync engine — the backend behind Google-Docs-style live
editing, built from first principles. The conflict-resolution core is a
hand-written **CRDT (RGA)**; no pre-built CRDT library is used.

See [`ROADMAP.md`](./ROADMAP.md) for the full design and build plan.

## Layout

```
packages/
  core/     hand-written RGA CRDT + Lamport clock (no deps)  [done]
  server/   WebSocket hub + SQLite op log                    [phase 3]
  client/   editor + offline buffer + reconnect              [phase 4]
```

## Quick start

```bash
pnpm install
pnpm test          # runs every package's tests
pnpm --filter @convergd/core test:watch   # TDD the engine
```

## The core in 30 seconds

A document is a **tree of characters**, not a string:

- each char's parent is "the char I was typed after" (a virtual root anchors the start);
- concurrent inserts at the same spot are ordered by a **total order on ids**
  (Lamport counter, then site) — identical on every replica;
- delete = **tombstone** (never removed, so anchors stay valid);
- visible text = depth-first walk skipping tombstones.

Same ops in any order → same tree → same text. That is convergence, proved in
`packages/core/test/convergence.test.ts`.
