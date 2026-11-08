# Decisions

## Accepted

- D-001: TypeScript, NestJS, SQLite, Prisma, and Zod provide the agreed application stack.
- D-002: npm and a lockfile provide reproducible dependency installation; Jest runs offline tests.
- D-003: HTTP and a future CLI share Nest application modules; provider execution is deferred.
- D-004: CommonJS is used across TypeScript, Jest, and the future Prisma client.
- D-005: The health endpoint reports application liveness; it does not imply extraction or database readiness.

- D-007: Follow Conventional Commits with optional responsibility-based scopes and coherent changes that include their tests and documentation. See the [commit convention](docs/commits.md). This keeps assessment history reviewable without adding commit-hook tooling.

## Open

- Extraction and persistence contracts, review policies, deduplication thresholds, and provider execution isolation remain to be decided. See `PLAN.md` for the initial checkpoints.

- D-006: Pin the Multer transitive dependency to 2.5.0 through an npm override to address the production advisory detected during setup; reassess the override when upgrading Nest.
