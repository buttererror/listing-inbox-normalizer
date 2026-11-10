# Development roadmap

The [original plan](../PLAN.md) records the baseline. [Plan v2](../PLAN-v2.md) describes the revised delivery, and [D-023](DECISIONS.md#d-023-integrate-the-live-cli-provider-at-the-start-of-phase-02) records the sequence, and [D-024](DECISIONS.md#d-024-use-the-gemini-api-for-tool-less-extraction) records the provider choice. Review each exit against the [success criteria](success-criteria.md).

| Phase | Outcome and exit check | Status |
| --- | --- | --- |
| Foundation | HTTP liveness, app context, offline foundation tests and SQLite driver. | Implemented |
| 01 — Contracts and CLI harness | Define contracts and verify JSONL through a controlled processor. | [Verified](phase-plans/01-contracts-and-cli.md) |
| 02 — Message processing through CLI | Verify classification, multi-offer extraction, sale and rent, evidence validation, resolution and review through the CLI. Integrate the tool-less Gemini API in 02.0 and check each task manually through the live CLI. Keep automated behavior tests offline. | [Complete / Verified](phase-plans/02-message-processing.md). Tasks 02.0–02.6 and human-friendly review presentation verified offline and through live CLI checks. |
| 03 — Independent provider evaluation | Evaluate the integrated CLI on independently authored cases after Phase 02. Record end-to-end results, accuracy, usage, latency, and available cost. | [Complete / Verified](phase-plans/03-independent-provider-evaluation.md) (2026-11-10). Evaluated `agy` (`1.5.3` / `gemini-3.8-flash-low`) across 20 frozen cases; post-fix prompt alignment achieved `100%` classification/offer-count, `98.8%` (`169/171`) applicable field accuracy, `0%` unsupported acceptance, and `6.80s` mean latency. See [analysis](evaluation-baseline-analysis.md). |
| 04 — SQLite, HTTP and approval | Verify HTTP persistence, replay and all three endpoints offline around the shared stateless processor; CLI remains JSONL-only and stateless. | [Complete / Verified](phase-plans/04-sqlite-http-and-approval.md) (2026-11-10). Verified `POST /messages`, `GET /listings` (including `approval_note`), `POST /listings/{id}/approve`, atomic SQLite persistence, exact replay, conflict handling, restart survival, and stateless CLI parity offline. |
| 05 — Deduplication | Verify reposts, similar distinct properties and ambiguous matches against persisted records. Resolve OPEN-02 and OPEN-06 and enforce conservative identity-based linking. | Planned — [Phase 05](phase-plans/05-deduplication.md) (`D-046`–`D-050` policy directions recorded; detailed rules `D-051` Proposed pending implementation approval) |
| 06 — Submission readiness | Verify fresh setup and the full brief. Record limitations, provider measurements, decisions and agent evidence. Prepare the live extension. | Candidate |

## Phase 02 provider prerequisite

Integrate the tool-less Gemini API in 02.0 using the verified offline single-sale CLI baseline. Check authentication, tool-free structured output, and typed failures under D-024. Run a live CLI check after each subsequent task. Review any replacement provider separately.

## Phase 03 independent provider evaluation

Use independently authored cases and a separate evaluator to measure classification, segmentation, field accuracy, unsupported values accepted, supported values missed, and review accuracy. Compare prompt and schema revisions on the same cases. Record usage, latency and available cost separately from the offline suite.

## Phase 04 offline integration

- HTTP ingestion persists raw messages, successful results including detected classes, and listing provenance atomically. Use isolated temporary SQLite databases to verify restart, exact replay with stable IDs and no additional gateway call, changed-payload conflicts, concurrent same-ID writes, and no successful records on failure. The CLI stays stateless; Phase 05 assesses any batch-local deduplication need.
- Connect `POST /messages`, `GET /listings`, and `POST /listings/{id}/approve`. Check status mapping, review filters, CLI and HTTP parity, and approval persistence. Resolve OPEN-07 before implementing approval. Preserve the replay snapshot and original evidence.
