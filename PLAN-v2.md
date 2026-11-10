# Dwelleo implementation plan v2

Dated 2026-11-09 (Africa/Cairo). The foundation and single-sale CLI baseline are verified. The v2 work below is planned.

## Objective and starting point

Convert Arabic, English, and mixed-language Saudi property messages into grounded listing records with clear review reasons. Deliver the JSONL CLI, shared HTTP ingestion, embedded persistence, human approval, and cross-broker duplicate detection required by the [assessment brief](docs/task-brief.md).

The [original plan](PLAN.md) records the pre-implementation baseline. The repository has a NestJS application, CLI harness, Zod schemas, a generic gateway port, and a verified one-sale path with a mocked gateway. HTTP currently exposes liveness. Prisma is configured for SQLite. Provider integration, listing storage, listing endpoints, and deduplication remain planned.

## Target architecture and contracts

Keep the five modules, existing stack, and shared processor. Apply policy within the stage that owns it, using the existing dependencies and infrastructure. The [architecture](docs/architecture.md) defines each ordered stage and its typed handoff. Extraction owns the prompt and schema. The model classifies, segments, associates, extracts, interprets, normalizes, verifies evidence-to-value consistency, assesses consistency, and emits structured candidates in one request. Code validates the envelope and each candidate, resolves fields, matches stored properties, derives review reasons, and assembles the result.

The successful contract adds `mixed` and source-ordered `detected_classes`. Application-generated listing IDs, existing listing fields, and typed failure envelopes retain their roles. [D-019](docs/DECISIONS.md#d-019-use-typed-extraction-proposals-and-mixed-intent) records the compatibility impact. Follow the [processing policy](docs/processing-resolution-policy.md) for grounded evidence, conflicts, applicability, price eligibility, and review.

## Implementation sequence and exits

| Phase | Deliverable and dependencies | Exit check |
| --- | --- | --- |
| **01 — Contracts and CLI harness** | Preserve the verified baseline and its evidence. | Existing JSONL and contract checks remain the comparison baseline. |
| **02 — Message processing through CLI** | Implement the [paired tasks](docs/phase-plans/02-message-processing.md) in order. Start with tool-less Gemini API integration against the verified single-sale CLI baseline (02.0). Extraction delivers LLM Classification & Extraction and Mechanical Validation (02.1–02.4). Listings delivers Field Resolution and the Runtime Reviewer (02.5). Messages reuses Input Validation and delivers Result Assembly through the CLI (02.6). | Run a manual live CLI check after each task. Apply D-024 and verify the tool-less gateway in 02.0. Stage tests and CLI integration tests pass offline with a mocked gateway. Verify mixed intent, multiple offers, exact evidence, partial candidate rejection, malformed envelopes, and JSONL continuation. Run the full offline suite, typecheck, and build. |
| **03 — Independent provider evaluation** | After Phase 02, evaluate the integrated Gemini CLI on an independent corpus. | Measure end-to-end results through the configured provider. Compare prompt and schema revisions on the same independently authored cases. Record accuracy and review outcomes. Publish measured per-message latency and token usage, available cost estimates and their assumptions, and any unavailable metrics in the README. |
| **04 — SQLite, HTTP, and approval** | Add atomic storage and replay to HTTP ingestion around the stateless shared processor. Expose ingestion, listing reads, and approval. Resolve OPEN-07 before implementing the approval transition. | Verify stateless CLI operation without SQLite, isolated HTTP SQLite restart, replay and stable IDs, changed-payload conflicts, concurrent writes, filters, and persisted approval with original evidence intact. |
| **05 — Deduplication** | Resolve area comparability and match thresholds under OPEN-02 and OPEN-06. Add identity matching after resolution and before review. | Verify cross-broker reposts, near matches, distinct properties, and ambiguous outcomes against stored records. Record missed matches and false merges. |
| **06 — Submission readiness** | Audit the complete brief, reproducible setup, and review evidence. | Verify a fresh checkout and documented commands. Record remaining gaps, actual provider metrics, decision and agent evidence, and live-extension readiness. |

The [roadmap](docs/roadmap.md) tracks phase status. Detail the later phase tasks after reviewing their dependencies. Test each stage before its dependent work under D-013.

## Verification and evidence

Author independent Arabic, English, and mixed-language fixtures with expected classifications, offer associations, field values, and review outcomes. Use gateway mocks for offline application behavior and adversarial outputs. In Phase 03, use the live CLI and separate evaluator to measure semantic quality on those fixtures, including unsupported values accepted and supported values missed. Keep live results separate from the offline suite. Use temporary SQLite databases for Phase 04 and Phase 05 integration checks.

Record actual results against the [success criteria](docs/success-criteria.md), important prompts in the [AI log](docs/AI_LOG.md), and approved trade-offs in the [decision register](docs/DECISIONS.md). Mark a phase verified when its exit checks pass. Review the complete success checklist at submission.
