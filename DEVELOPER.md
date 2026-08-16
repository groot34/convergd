# Developer Quickstart

This file explains the minimal commands and conventions for working on Convergd locally.

1) Install dependencies

```bash
pnpm install
```

2) Run tests

```bash
pnpm test
pnpm --filter @convergd/core test:watch
```

3) Local dev (once services exist)

```bash
# run the server package in dev mode (after Phase 3 scaffold)
pnpm --filter @convergd/server dev

# or use docker-compose when available
docker-compose up --build
```

4) Environment

- Copy `ENV.example` → `.env` and set secret keys (do not commit `.env`).
- `ROADMAP.md` is intentionally ignored locally; keep it private.

5) Git / commits

- Use feature branches: `git checkout -b feat/<topic>`
- Use Conventional Commits for messages: `feat:`, `fix:`, `chore:` etc.

Suggested commit for small docs change (example):

```bash
git add README.md DEVELOPER.md ENV.example .gitignore
git commit -m "docs: add ENV.example and developer quickstart"
git push -u origin feat/docs-env
```

6) Stopping tracking for ROADMAP.md (already prepared in `.gitignore`):

```bash
git rm --cached ROADMAP.md
git add .gitignore
git commit -m "chore: stop tracking ROADMAP.md; keep local roadmap"
git push origin main
```

7) When you want me to add the next item, tell me (e.g. "next: add Dockerfiles").
