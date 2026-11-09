# Listing Inbox Normalizer

Contributions follow the [project commit convention](docs/commits.md), based on Conventional Commits.

This repository contains the stack foundation, message contracts, offline extraction and normalization through the CLI. Listing persistence, listing HTTP endpoints, review approval, deduplication, and the Antigravity adapter are candidate tasks for later phases.

Requires Node.js 24 and pnpm 10.28.2 (via Corepack). Install dependencies with `corepack pnpm install --frozen-lockfile`; copy `.env.example` to `.env` if you need overrides.

- `pnpm start` builds and starts HTTP on port 3000 by default.
- `pnpm run start:dev` starts the TypeScript application.
- `pnpm run build` compiles the application.
- `node dist/cli.js process <input.jsonl>` reads JSONL after a build. Valid messages currently return `provider_unavailable` because extraction is not configured.
- `pnpm run typecheck` checks types.
- `pnpm test` runs offline tests without model credentials.
- `pnpm run db:generate` and `pnpm run db:migrate` are reserved for the domain schema; no models or migrations exist yet.

`GET /health` returns `{"status":"ok"}` and reports liveness only. Application startup does not call a model. Environment variables select a future provider and are validated at startup.

The [v2 plan](PLAN-v2.md) describes the planned message-processing refactor and delivery sequence. The [original plan](PLAN.md) preserves the pre-implementation baseline.

In the [planned pipeline](docs/architecture.md), the model proposes typed values and source evidence in one request. The application validates candidates, resolves fields, derives review reasons, and returns a shared CLI or HTTP result. Stored-property matching runs before review once Phase 05 is in place.

Phase 01 and the single-sale CLI baseline are verified. The Phase 02 revision is planned. Task 02.0 integrates Antigravity through the verified CLI baseline so each subsequent task can be checked with the live CLI. Phase 03 measures the integrated flow on independent cases. Phase 04 adds SQLite, HTTP, and approval. The [earlier Antigravity smoke test](docs/AI_LOG.md#antigravity-provider-experiment) records one synthetic call. Representative cost and latency remain unmeasured.

The pnpm lockfile pins a Multer override for a production dependency advisory. The production dependency audit passed after the override; the full development dependency audit reported seven low-severity advisories at setup time.

Project context: [assessment snapshot](docs/task-brief.md), [original Notion brief](https://app.notion.com/p/Dwello-task-4121b4ca63c980d482cde22eedfff233), and [documentation index](docs/README.md).

Development follows the [roadmap](docs/roadmap.md), organized into phases with implementation and testing tasks under D-014.
