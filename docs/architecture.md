# Architecture

## Implemented foundation

NestJS boots HTTP or a non-HTTP application context. GET /health returns application liveness. Zod validates environment configuration. Five modules are scaffolded: Messages, Extraction, Listings, LLM Gateway, and Database. Prisma is configured for SQLite with CommonJS client generation; domain models and provider adapters are deferred.

## Proposed responsibilities

| Module | Responsibility |
| --- | --- |
| Messages | Ingestion, idempotency, and shared HTTP/CLI orchestration |
| Extraction | Classification, property segmentation, candidate facts and evidence schema |
| Listings | Normalization, domain validation, deduplication, review policy and approval |
| LLM Gateway | Generic provider execution, response envelopes, timeouts and usage |
| Database | Prisma lifecycle and embedded persistence infrastructure |

The proposed pipeline is input validation → model interpretation → structural validation → source grounding → deterministic normalization → domain validation → entity resolution → review triage → transactional persistence. Human approval follows processing. Reviewer assignment is outside the assessment scope.

Model interpretation may vary with the model; application contracts and checks remain stable. Source quotes alone do not prove correct property association. Missing, unsupported, ambiguous, and contradictory assertions require distinct handling. No unsupported values may be invented.

HTTP and CLI will invoke the same processor. Offline test doubles verify application behavior; separate live-model evaluations measure extraction quality. See the [decision register](DECISIONS.md) for unresolved policies and the [brief](task-brief.md) for required behavior.
