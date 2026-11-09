# Listing Inbox Normalizer

Contributions follow the [project commit convention](docs/commits.md), based on Conventional Commits.

This repository contains the stack foundation, message contracts, and a CLI harness. Listing extraction, listing endpoints, review, deduplication, and the Antigravity adapter are not implemented.

Requires Node.js 24 and pnpm 10.28.2 (via Corepack). Install dependencies with `corepack pnpm install --frozen-lockfile`; copy `.env.example` to `.env` if you need overrides.

- `pnpm start` builds and starts HTTP on port 3000 by default.
- `pnpm run start:dev` starts the TypeScript application.
- `pnpm run build` compiles the application.
- `node dist/cli.js process <input.jsonl>` reads JSONL after a build. Valid messages currently return `provider_unavailable` because extraction is not configured.
- `pnpm run typecheck` checks types.
- `pnpm test` runs offline tests without model credentials.
- `pnpm run db:generate` and `pnpm run db:migrate` are reserved for the domain schema; no models or migrations exist yet.

`GET /health` returns `{"status":"ok"}` and reports liveness only. Application startup does not call a model. Environment variables select a future provider and are validated at startup.

The [implementation plan](PLAN.md) is finalized. It preserves the original planning baseline and records the phase-and-task delivery structure in a dated amendment.

The [Antigravity smoke test](docs/AI_LOG.md#antigravity-provider-experiment) records observed latency and usage for a synthetic call. Representative per-message cost and application latency remain unmeasured. Phase 01 is verified with a controlled processor; Phase 02 will implement offline extraction through the CLI.

The pnpm lockfile pins a Multer override for a production dependency advisory. The production dependency audit passed after the override; the full development dependency audit reported seven low-severity advisories at setup time.

Project context: [assessment snapshot](docs/task-brief.md), [original Notion brief](https://app.notion.com/p/Dwello-task-4121b4ca63c980d482cde22eedfff233), and [documentation index](docs/README.md).

Development follows the [roadmap](docs/roadmap.md), organized into phases with implementation and testing tasks under D-014.
