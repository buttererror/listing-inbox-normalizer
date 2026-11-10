# Phase 04 — SQLite persistence, HTTP integration, and human approval

**Status:** In progress. Task 04.1 is complete. Tasks 04.2 through 04.6 are pending.

## Objective and scope

Add SQLite persistence and replay, HTTP ingestion and listing reads, and human approval to the shared processor. Reuse the Phase 02 pipeline in order: input validation, LLM extraction, mechanical validation, field resolution, runtime review, and result assembly. Preserve the existing interpretation, normalization, and review policies.

Governing references: [assessment brief](../task-brief.md), [architecture](../architecture.md), [first listing contracts](01-contracts-and-cli.md#approved-contract-and-policy-choices), [decision register](../DECISIONS.md#open-policy-checkpoints), [roadmap](../roadmap.md), and [success criteria](../success-criteria.md).

Phase 05 owns cross-message property deduplication. Phase 04 scope covers the three required endpoints and one approval transition. New prompts, evaluation frameworks, field rules, authentication, authorization, pagination, advanced filters, generic persistence frameworks, and audit event infrastructure are outside this phase.

## Approved OPEN-07 contract

- Replay compares the original `id`, `sender`, `received_at`, and `text` exactly. An exact replay returns the original successful ingestion result with stable listing IDs. Sequential replay skips the gateway. A changed payload under the same ID returns `message_conflict` with HTTP 409.
- Store the ingestion snapshot separately from current listing state. If ingestion returned `needs_review: true` and the listing was later approved, an exact replay still returns `true`, while listing reads return `false`.
- `GET /listings` returns `{ "listings": [...] }` in stable ingestion and offer order. An omitted `needs_review` filter returns all listings. The literal query values `true` and `false` filter the current flag. Malformed values return 400.
- `POST /listings/{id}/approve` returns the updated listing. First approval of an originally flagged listing records approval and sets current `needs_review` to `false`. A repeat returns the existing approved state. Preserve extracted fields, original `review_reasons`, source provenance, and the ingestion snapshot.
- Approval errors use `{ "message_id": null, "error": { "code", "message" } }`. An unknown ID returns 404 `listing_not_found`. A listing that never required review returns 409 `approval_conflict`.
- CLI and HTTP startup apply committed SQLite migrations. A fresh database is usable without a separate manual initialization step.

Approval evidence comes from the Phase 04 planning chat, including the user's confirmation that the stored flag becomes false and reasons and replay history remain available. Record the approved choice in the decision register before approval implementation.

## Implementation tasks and focused offline checks

Complete each focused check and record its result before dependent work. Use gateway doubles and isolated temporary SQLite databases throughout.

### 04.1 — Database foundation

Use the existing Prisma and SQLite setup for the schema, committed migrations, and database lifecycle. Store original message fields, classification and detected classes, the immutable successful result, listing IDs and order, current review state, original review eligibility, approval state and timestamp or equivalent, and source provenance.

**04.1T.** Verify fresh initialization and committed migrations through both entry points. Save and read messages and listings, close and reopen the database, and check order and review state.

#### 04.1 progress — 2026-11-10

- **Implemented behavior** — Added StoredMessage and StoredListing Prisma models and the committed SQLite migration. `pnpm run db:deploy` applies it through Prisma before `pnpm start`, `pnpm run start:dev`, or `pnpm --silent run cli process …`; DatabaseService owns only the Prisma connection lifecycle. The CLI redirects its build and migration diagnostics to stderr, preserving JSONL stdout. Listing rows retain ordered offers, the immutable message snapshot, current and original review state, approval fields, and provenance storage. postinstall generates the ignored Prisma client required by the application.
- **Cases handled** — The focused test uses one temporary SQLite file, starts an application context, saves one message with two ordered listings and different review flags, closes it, then starts the HTTP application against the same file and reads the same rows. It verifies migration application, persistence, offer ordering, review flags, closure, and restart.
- **Errors and limitations** — Prisma 7.10.1's SQLite migration command has an upstream schema-engine logging defect: it fails with an empty error unless `RUST_LOG=info`. `db:deploy` pins that documented workaround without changing dependencies. Runtime migration discovery requires the application to start from the repository root where prisma/migrations is available. Shared processor persistence, replay, HTTP listing routes, and approval remain in later tasks.
- **Verification evidence** — On 2026-11-10, `db:deploy` applied the migration to fresh temporary HTTP and CLI databases; a second deploy preserved the existing migration history, including on a disposable copy initialized by the former runner. HTTP startup completed after migration (with loopback access). The CLI emitted JSONL results only to stdout while build and migration output remained on stderr. The focused restart test passed; the full offline suite passed 22 suites / 248 tests, and `pnpm run typecheck` and `pnpm run build` passed.

### 04.2 — Shared persistence and replay

Validate input, check the stored ID, and run the existing pipeline for new messages. Validate the final public result before storing it. Keep model calls outside the write transaction. Use a short transaction to save the message, all listing rows, and the snapshot together. Enforce unique message IDs in SQLite. On a competing insert, reread the committed winner and apply the same replay or conflict rule.

Concurrent identical requests may both invoke the model before either saves. The database must still contain one successful ingestion and one set of listing rows.

**04.2T.** Check first ingestion, sequential exact replay with no additional gateway call, stable IDs, changed-payload conflicts, multiple offers in source order, and successful messages with zero offers. Exercise concurrent identical and conflicting submissions. Force a write failure and verify rollback. Verify that provider or extraction failures produce no successful stored ingestion.

### 04.3 — HTTP ingestion

Connect `POST /messages` to the processor used by the CLI. Return HTTP 200 for a new success or exact replay. Use the existing typed failure envelope and the mappings below. Keep provider credentials, raw responses, stack traces, and private message content out of public errors.

**04.3T.** Verify successful ingestion, replay, malformed JSON, invalid input, each typed failure and status, and internal storage failure. Compare CLI and HTTP results against the same database.

### 04.4 — Listing reads

Project persisted listings through the existing public listing schema. Return the current review flag in stable ingestion and offer order. Apply the approved filter contract so approvals appear on subsequent reads.

**04.4T.** Verify unfiltered and both filtered reads, malformed filters, ordering across messages and offers, and persistence after restart. Verify filtering after approval in 04.5T.

### 04.5 — Human approval

Apply the approved state transition to the stored listing. Keep the original review eligibility available to distinguish an already approved listing from one that never needed review. Approval changes workflow state while preserving the stored property values and all ingestion evidence.

**04.5T.** Verify first and repeated approval, a missing ID, and a listing that never required review. Check both review filters after approval and verify the approval survives restart. Replay the original message and confirm the ingestion snapshot, listing IDs, and original review flag are unchanged.

### 04.6 — Verification and close-out

Review all focused results and run the HTTP, SQLite restart, and shared CLI/HTTP integration checks. Run `pnpm test`, `pnpm run typecheck`, and `pnpm run build`. Keep the automated suite offline and independent of Gemini calls and API keys. Confirm Phase 02 processing behavior still passes its regression checks.

## Planned error matrix

Verify the type, status, public response, and database state for each case. The coverage column identifies a planned check.

| Error code | Trigger | HTTP | Public response and database effect | Coverage |
| --- | --- | --- | --- | --- |
| `invalid_input` | Malformed JSON, invalid message, or malformed listing filter | 400 | Typed input error. No state change. | 04.3T, 04.4T |
| `message_conflict` | Existing ID with a different original payload | 409 | Typed conflict. Existing ingestion and listings remain intact. | 04.2T, 04.3T |
| `invalid_extraction` | Unusable extraction response | 502 | Typed extraction error. No successful ingestion is stored. | 04.2T, 04.3T |
| `provider_unavailable` | Configured provider is unavailable | 503 | Typed provider error. No successful ingestion is stored. | 04.2T, 04.3T |
| `provider_timeout` | Provider call times out | 504 | Typed timeout. No successful ingestion is stored. | 04.2T, 04.3T |
| `internal_error` | Unexpected application or database failure | 500 | Safe internal error. Failed writes leave no partial state. | 04.2T, 04.3T |
| `listing_not_found` | Approval ID does not exist | 404 | Typed approval error. No state change. | 04.5T |
| `approval_conflict` | Listing never required review | 409 | Typed approval error. No state change. | 04.5T |

## Evidence to record as each task lands

For each task from 04.1 through 04.6, add a dated progress entry here or link to the relevant existing evidence:

1. **Implemented behavior.** Describe what changed, which modules were reused, interface or storage changes, and deviations from the approved plan.
2. **Handled cases.** State the expected result and verification status of relevant success and edge cases, including concurrency, empty results, approval, and restart.
3. **Errors and failure handling.** Update the matrix with observed status and error code, public response, database effect, and test coverage. Separate expected application errors from unexpected failures.
4. **Known gaps.** Record unsupported or unverified cases, known races, provider limits, tradeoffs, and deferred requirements. Identify possible duplicate model calls for concurrent identical submissions and Phase 05 deduplication.
5. **Verification evidence.** Record the date, commands, actual counts and outcomes, temporary database setup, relevant fixtures, observed HTTP statuses, failures and their causes, and typecheck and build outcomes. Distinguish executed checks from planned checks.
6. **Follow-up.** Give each unresolved issue an impact, owning phase or task, and whether it blocks Phase 04.

During implementation, use the existing project documents for their respective evidence. Record decisions in `docs/DECISIONS.md`, the actual persistence and HTTP design in `docs/architecture.md`, status in `docs/roadmap.md`, and dated criteria evidence in `docs/success-criteria.md`. Update the README with setup, automatic migrations, HTTP examples, replay, approval, and limitations. Record material agent involvement and corrections in `docs/AI_LOG.md` under its review policy. Preserve the original assessment `PLAN.md`.

## Definition of done

- [ ] Fresh CLI and HTTP startup apply committed migrations. SQLite data and approval state survive restart.
- [ ] Both transports use the same processor and agree on equivalent input. Sequential exact replay returns the original snapshot without a model call, and changed payloads conflict.
- [ ] Multi-offer and zero-offer successes persist correctly. Concurrent same-ID writes retain one winner, and failed writes leave no partial success.
- [ ] All three endpoints work with the documented error contracts. Listing filters use current review state, and approval is idempotent and preserves replay history.
- [ ] Focused offline checks, the full offline suite, typecheck, and build pass.
- [ ] Dated evidence covers SC-02 through SC-05 and PC-01. Each task records implemented behavior, handled cases, errors, known gaps, and actual verification. Remaining items have an owner and an explicit blocking status.

Mark the phase **Verified** after all exit checks pass.
