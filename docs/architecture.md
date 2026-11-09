# Architecture

## Implemented foundation

NestJS boots HTTP or a non-HTTP application context. GET /health returns application liveness. Zod validates environment configuration. Five modules are scaffolded: Messages, Extraction, Listings, LLM Gateway, and Database. Prisma is configured for SQLite with CommonJS client generation; domain models and provider adapters are deferred.

## Proposed responsibilities

| Module | Responsibility |
| --- | --- |
| Messages | Ingestion, idempotency, and shared HTTP/CLI orchestration |
| Extraction | Classification, property segmentation, domain prompts and schemas, interpretation and source integrity checks |
| Listings | Deterministic normalization, domain validation, deduplication, review policy and approval |
| LLM Gateway | Generic provider execution, response envelopes, timeouts and usage |
| Database | Prisma lifecycle and embedded persistence infrastructure |

The shared ingestion pipeline is input validation → model interpretation → structural validation → source grounding → deterministic normalization → domain validation → entity resolution → review triage → transactional persistence. Messages coordinates these stages through the module boundaries above. Extraction produces candidate assertions with evidence. Listings uses those grounded assertions to normalize fields, compare against stored listings, and derive review flags and reasons.

[D-017](DECISIONS.md#d-017-carry-evidence-backed-field-interpretations-into-normalization) approves a revised handoff that is still being implemented. Extraction will return field interpretations with verbatim value and qualifier evidence from the same verified occurrence. Listings will derive values from that evidence and validate signs, units, and periods before resolving fields and review reasons. Source matching establishes fidelity to the quoted text. Semantic correctness and property association require separate evaluation.

The provider's structured JSON is an intermediate contract. An invalid extraction envelope fails processing with a typed error. An unsupported field in a valid envelope remains null with a readable review reason. After persistence, the processor returns the public message result. CLI serializes it as a JSONL record and HTTP sends it as a JSON body. Serialization is part of each transport adapter. Listing reads and human approval are separate operations on persisted state.

Model interpretation may vary with the model; application contracts and checks remain stable. Source quotes alone do not prove correct property association. Missing, unsupported, ambiguous, and contradictory assertions require distinct handling. No unsupported values may be invented.

HTTP and CLI will invoke the same processor. Offline test doubles verify application behavior; separate live-model evaluations measure extraction quality. See the [decision register](DECISIONS.md) for unresolved policies and the [brief](task-brief.md) for required behavior.
