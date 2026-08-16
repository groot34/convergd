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

## Final tech snapshot (what we'll run locally and deploy)

- Language: TypeScript monorepo (pnpm workspaces)
- Realtime: WebSocket (`ws`) + HTTP (`fastify`) for history endpoints
- Persistence: SQLite (`better-sqlite3`) for local/demo; Postgres for production
- AI / RAG: optional `packages/ai` Node microservice (Hugging Face / OpenAI for embeddings + generation)
- Containerization: Docker + `docker-compose` for local dev and deploy
- Observability: Prometheus + Grafana (metrics exported from server)

## Run locally (recommended dev flow)

Install dependencies and run tests:
```bash
pnpm install
pnpm test
```

Dev with docker-compose (after scaffolded):
```bash
docker-compose up --build
# or pnpm --filter @convergd/server dev
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
