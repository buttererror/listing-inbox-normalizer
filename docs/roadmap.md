# Development roadmap

The [original plan](../PLAN.md) records the baseline. [Plan v2](../PLAN-v2.md) describes the revised delivery, and [D-022](DECISIONS.md#d-022-integrate-the-live-provider-before-sqlite-and-http) records the sequence. Review each exit against the [success criteria](success-criteria.md).

| Phase | Outcome and exit check | Status |
| --- | --- | --- |
| Foundation | HTTP liveness, app context, offline foundation tests and SQLite driver. | Implemented |
| 01 — Contracts and CLI harness | Define contracts and verify JSONL through a controlled processor. | [Verified](phase-plans/01-contracts-and-cli.md) |
| 02 — Message processing through CLI | Verify classification, multi-offer extraction, sale and rent, evidence validation, resolution and review through the CLI with a mocked gateway. | [Revision planned](phase-plans/02-message-processing.md). [Single-sale baseline verified](phase-plans/02-extraction-through-cli.md). |
| 03 — Live provider integration and evaluation | Qualify Antigravity and integrate it through the CLI after Phase 02. Record end-to-end results, accuracy, usage, latency, and available cost. | Candidate |
| 04 — SQLite, HTTP and approval | Verify persistence, replay and all three HTTP endpoints offline through the shared processor. | Candidate |
| 05 — Deduplication | Verify reposts, similar distinct properties and ambiguous matches against persisted records. Review thresholds and area comparability first. | Candidate |
| 06 — Submission readiness | Verify fresh setup and the full brief. Record limitations, provider measurements, decisions and agent evidence. Prepare the live extension. | Candidate |

## Phase 03 live provider integration

After the Phase 02 exit, integrate Antigravity through the generic gateway and exercise the full CLI pipeline with the configured provider. Verify executable availability, authentication, structured output, and execution isolation. Resolve OPEN-01 and OPEN-08 before routing untrusted messages. Review any replacement provider separately.

Use independently authored cases and a separate evaluator to measure classification, segmentation, field accuracy, unsupported values accepted, supported values missed, and review accuracy. Compare prompt and schema revisions on the same cases. Record usage, latency and available cost separately from the offline suite.

## Phase 04 offline integration

- Persist raw messages, successful results including detected classes, and listing provenance atomically. Use isolated temporary SQLite databases to verify restart, exact replay with stable IDs and no additional gateway call, changed-payload conflicts, concurrent same-ID writes, and no successful records on failure.
- Connect `POST /messages`, `GET /listings`, and `POST /listings/{id}/approve`. Check status mapping, review filters, CLI and HTTP parity, and approval persistence. Resolve OPEN-07 before implementing approval. Preserve the replay snapshot and original evidence.
