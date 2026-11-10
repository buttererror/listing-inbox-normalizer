# Development roadmap

The [original plan](../PLAN.md) records the baseline. [Plan v2](../PLAN-v2.md) describes the revised delivery, and [D-023](DECISIONS.md#d-023-integrate-the-live-cli-provider-at-the-start-of-phase-02) records the sequence, and [D-024](DECISIONS.md#d-024-use-the-gemini-api-for-tool-less-extraction) records the provider choice. Review each exit against the [success criteria](success-criteria.md).

| Phase | Outcome and exit check | Status |
| --- | --- | --- |
| Foundation | HTTP liveness, app context, offline foundation tests and SQLite driver. | Implemented |
| 01 — Contracts and CLI harness | Define contracts and verify JSONL through a controlled processor. | [Verified](phase-plans/01-contracts-and-cli.md) |
| 02 — Message processing through CLI | Verify classification, multi-offer extraction, sale and rent, evidence validation, resolution and review through the CLI. Integrate the tool-less Gemini API in 02.0 and check each task manually through the live CLI. Keep automated behavior tests offline. | [Complete / Verified](phase-plans/02-message-processing.md). Tasks 02.0–02.6 and human-friendly review presentation verified offline and through live CLI checks. |
| 03 — Independent provider evaluation | Evaluate the integrated Gemini CLI on independently authored cases after Phase 02. Record end-to-end results, accuracy, usage, latency, and available cost. | [Accepted task plan](phase-plans/03-independent-provider-evaluation.md) |
| 04 — SQLite, HTTP and approval | Verify persistence, replay and all three HTTP endpoints offline through the shared processor. | Candidate |
| 05 — Deduplication | Verify reposts, similar distinct properties and ambiguous matches against persisted records. Review thresholds and area comparability first. | Candidate |
| 06 — Submission readiness | Verify fresh setup and the full brief. Record limitations, provider measurements, decisions and agent evidence. Prepare the live extension. | Candidate |

## Phase 02 provider prerequisite

Integrate the tool-less Gemini API in 02.0 using the verified offline single-sale CLI baseline. Check authentication, tool-free structured output, and typed failures under D-024. Run a live CLI check after each subsequent task. Review any replacement provider separately.

## Phase 03 independent provider evaluation

Use independently authored cases and a separate evaluator to measure classification, segmentation, field accuracy, unsupported values accepted, supported values missed, and review accuracy. Compare prompt and schema revisions on the same cases. Record usage, latency and available cost separately from the offline suite.

## Phase 04 offline integration

- Persist raw messages, successful results including detected classes, and listing provenance atomically. Use isolated temporary SQLite databases to verify restart, exact replay with stable IDs and no additional gateway call, changed-payload conflicts, concurrent same-ID writes, and no successful records on failure.
- Connect `POST /messages`, `GET /listings`, and `POST /listings/{id}/approve`. Check status mapping, review filters, CLI and HTTP parity, and approval persistence. Resolve OPEN-07 before implementing approval. Preserve the replay snapshot and original evidence.
