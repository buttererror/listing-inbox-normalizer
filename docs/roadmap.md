# Development roadmap

The [root plan](../PLAN.md) preserves the original baseline and records the current planning structure in its dated amendment. [D-014](DECISIONS.md#d-014-organize-delivery-as-phases-and-tasks) governs delivery. Use the [brief](task-brief.md) and [success checklist](success-criteria.md) to review coverage.

The stack foundation is implemented. Domain implementation starts with Phase 01. Detail later tasks after reviewing Phase 02 evidence.

| Phase | Outcome | Status |
| --- | --- | --- |
| Foundation | HTTP liveness, reusable app context, offline foundation tests, and a working SQLite driver. | Implemented |
| 01 — Contracts, policies, and CLI harness | Define the contracts and exercise JSONL with a controlled processor. | [Verified](phase-plans/01-contracts-and-cli.md) |
| 02 — Extraction through CLI | Produce a grounded, normalized sale listing with readable review reasons using offline fixtures. | [Planned](phase-plans/02-extraction-through-cli.md) |
| 03 — Persistence, HTTP, and provider qualification | Persist atomically in SQLite, enforce replay and conflict rules, and connect HTTP after the CLI and storage are testable. Verify offline CLI, HTTP and SQLite before qualifying Antigravity. | Candidate |
| 04 — Broader message coverage | Expand classifications, multi-property messages, rentals, projects, mixed-language cases and contradiction handling. Check independent cases alongside the supplied examples. | Candidate |
| 05 — Property identity and approval | Identify reposts and similar distinct properties, flag uncertain matches, and persist human approval. | Candidate |
| 06 — Submission readiness | Verify fresh setup and the full brief. Record independent model results, per-message cost and latency, decisions, and agent evidence. Prepare the live extension environment. | Candidate |

## Phase 03 carryover checks

The former first-listing scope approved these checks. Review the Phase 03 task breakdown after Phase 02. Preserve the [storage and HTTP contracts](phase-plans/01-contracts-and-cli.md#approved-contract-and-policy-choices).

- **SQLite and replay** — Add Prisma message and listing storage, atomic successful writes, and replay through the shared processor. Connect the CLI to that path. Store normalized and evidence payloads as JSON text, with review state and the message relation in columns. Use opaque stable listing IDs. Use an isolated migrated temporary SQLite database for each integration case. Check persisted state after restart, exact replay with saved IDs and no additional gateway call, conflicts for changed payloads, and one stored result from concurrent same-ID writes. Verify that failures create no successful listing.
- **HTTP integration** — Connect POST `/messages` and GET `/listings` to the shared service and stored records. Check success and failure status mapping, review filters, and equivalent CLI/HTTP results on replay through the same database. Include the unconfigured gateway failure path.
- **Provider qualification** — Apply OPEN-08 after the offline checks above pass. Confirm executable availability, authentication, evaluator setup, and isolation using synthetic input before untrusted live processing. Preserve the [D-011](DECISIONS.md#d-011-verify-the-listing-flow-offline-before-qualifying-antigravity) gate. Review any replacement provider separately if qualification fails.
