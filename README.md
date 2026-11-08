# Listing Inbox Normalizer

Contributions follow the [project commit convention](docs/commits.md), based on Conventional Commits.

This repository currently contains the stack foundation only. Message processing, listing endpoints, extraction, review, deduplication, and the Antigravity adapter are not implemented.

Requires Node.js 24 and pnpm 10.28.2 (via Corepack). Install dependencies with `corepack pnpm install --frozen-lockfile`; copy `.env.example` to `.env` if you need overrides.

- `pnpm start` builds and starts HTTP on port 3000 by default.
- `pnpm run start:dev` starts the TypeScript application.
- `pnpm run build` compiles the application.
- `pnpm run typecheck` checks types.
- `pnpm test` runs offline tests without model credentials.
- `pnpm run db:generate` and `pnpm run db:migrate` are reserved for the domain schema; no models or migrations exist yet.

`GET /health` returns `{"status":"ok"}` and reports liveness only. Application startup does not call a model. Environment variables select a future provider and are validated at startup.

The Git repository is initialized. `PLAN.md` remains a local draft and is excluded from the initial commit until it is finalized.

The Antigravity smoke test, including its observed latency and usage, is documented in `PLAN.md`; no per-message cost or production latency has been established. Next: define extraction and persistence contracts, evidence validation, and review policy before implementing the pipeline.

The pnpm lockfile pins a Multer override for a production dependency advisory. The production dependency audit passed after the override; the full development dependency audit reported seven low-severity advisories at setup time.

Project context: [assessment snapshot](docs/task-brief.md), [original Notion brief](https://app.notion.com/p/Dwello-task-4121b4ca63c980d482cde22eedfff233), and [documentation index](docs/README.md).

Development follows the [roadmap](docs/roadmap.md), refined into reviewed phases and vertical slices under accepted decision D-009.
