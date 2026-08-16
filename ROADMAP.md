# Convergd — Roadmap

A real-time collaborative sync engine (Google-Docs-style live editing) built
from first principles. The conflict-resolution core is a hand-written **CRDT
(RGA)** — no pre-built CRDT library.

## The one big idea

> **Edits are commutative "bricks" (CRDT ops) stored in an append-only log.**

Everything else falls out of that:

| Requirement | How this design satisfies it |
| --- | --- |
| 01 concurrent edits converge | RGA: tree shape from `parent`, sibling order from total-ordered ids |
| 02 own conflict resolution | hand-built RGA in `packages/core` |
| 03 offline merge | offline edits are just more ops; replay + commutativity merge them |
| 04 history / revert | fold the op log up to version N |
| 05 sub-second broadcast | WebSocket hub relays ops |
| 06 convergence proof | property test: random ops, many delivery orders, assert equal |
| 07 disconnect/reconnect | ops idempotent by unique id -> no loss, no dupes |

## Stack

- **TypeScript / Node 20+**, pnpm workspaces monorepo
- Core CRDT: hand-written **RGA** + Lamport clock (no deps)
- Transport: **ws** (WebSocket) · HTTP history API: **Fastify**
- Persistence: **SQLite** (`better-sqlite3`) append-only `ops` table
- Client offline buffer: **IndexedDB** (`idb`)
- Tests: **Vitest** + **fast-check** (property) + hand-built seeded network sim
- Wire: JSON now -> MessagePack when optimizing
- Tooling: **Biome** (lint+format)

## Phases

- [x] **Phase 0** — monorepo scaffold, tooling, `packages/{core,server,client}`
- [x] **Phase 1** — RGA core: insert / delete / apply / toString + unit tests
- [x] **Phase 2** — convergence proof (fast-check, many orders + dupes)
- [ ] **Phase 3** — WebSocket server + SQLite op log + live broadcast (req 01, 05)
- [ ] **Phase 4** — offline buffer + reconnect sync, causal catch-up (req 03, 07)
- [ ] **Phase 5** — history API + time-travel / revert UI (req 04)
- [ ] **Phase 6** — stretch: presence (CRDT-anchored cursors) + observability

## Differentiators (the standout layer)

**Tier S**
- Deterministic simulation testing — seeded fake network: partition, reorder,
  delay, drop, duplicate; run thousands of adversarial schedules.
- Tombstone garbage collection via version vectors.
- Snapshot + op-log compaction.

**Tier A**
- Delta-state reconnect (version-vector diff instead of full replay).
- CRDT-anchored cursors (cursor = char id, never drifts).
- Live observability: propagation-latency histogram, ops/sec.

**Tier B (if time)**
- Per-user undo/redo · TLA+ model · JSON CRDT (nested lists / spreadsheet).
