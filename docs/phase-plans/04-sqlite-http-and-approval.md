# Phase 04 — SQLite persistence, HTTP integration, and human approval

**Status:** Verified on 2026-11-10. Tasks 04.1 through 04.6 and all Phase 04 exit checks passed.

## Objective and scope

Add SQLite persistence and replay to HTTP ingestion, plus listing reads and human approval. Reuse the stateless Phase 02 processor; the CLI remains JSONL-only with no SQLite side effects.

Governing references: [assessment brief](../task-brief.md), [architecture](../architecture.md), [first listing contracts](01-contracts-and-cli.md#approved-contract-and-policy-choices), [decision register](../DECISIONS.md#open-policy-checkpoints), [roadmap](../roadmap.md), and [success criteria](../success-criteria.md).

Phase 05 owns cross-message property deduplication. Phase 04 scope covers the three required endpoints and one approval transition. New prompts, evaluation frameworks, field rules, authentication, authorization, pagination, advanced filters, generic persistence frameworks, and audit event infrastructure are outside this phase.

## Approved OPEN-07 contract

- Replay compares the original `id`, `sender`, `received_at`, and `text` exactly. An exact replay returns the original successful ingestion result with stable listing IDs. Sequential replay skips the gateway. A changed payload under the same ID returns `message_conflict` with HTTP 409.
- Store the ingestion snapshot separately from current listing state. If ingestion returned `needs_review: true` and the listing was later approved, an exact replay still returns `true`, while listing reads return `false`.
- `GET /listings` returns `{ "listings": [...] }` in stable ingestion and offer order. An omitted `needs_review` filter returns all listings. The literal query values `true` and `false` filter the current flag. Each listing includes current `approval_note` (`null` when absent). Malformed values return 400.
- `POST /listings/{id}/approve` returns the updated listing. First approval of an originally flagged listing records approval, sets current `needs_review` to `false`, and stores an optional trimmed reviewer note. A repeat returns the existing approved state and preserves its timestamp and note. Preserve extracted fields, original `review_reasons`, source provenance, and the ingestion snapshot. Listing reads and approval responses expose the stored note; message ingestion and CLI schemas remain unchanged.
- Approval errors use `{ "message_id": null, "error": { "code", "message" } }`. An unknown ID returns 404 `listing_not_found`. A listing that never required review returns 409 `approval_conflict`.
- HTTP startup applies committed SQLite migrations. CLI startup does not require SQLite or migrations.

Approval evidence comes from the Phase 04 planning chat, including the user's confirmation that the stored flag becomes false and reasons and replay history remain available. Record the approved choice in the decision register before approval implementation.

## Implementation tasks and focused offline checks

Complete each focused check and record its result before dependent work. Use gateway doubles and isolated temporary SQLite databases throughout.

### 04.1 — Database foundation

Use the existing Prisma and SQLite setup for the schema, committed migrations, and database lifecycle. Store original message fields, classification and detected classes, the immutable successful result, listing IDs and order, current review state, original review eligibility, approval state and timestamp or equivalent, and source provenance.

**04.1T.** Verify HTTP startup initializes a fresh database and committed migrations. Save and read messages and listings, close and reopen the database, and check order and review state. Verify the CLI starts without a database or migrations.

#### 04.1 progress — 2026-11-10

- **Implemented behavior** — Added StoredMessage and StoredListing Prisma models and the committed SQLite migration. `pnpm run db:deploy` applies it through Prisma before `pnpm start`, `pnpm run start:dev`, or `pnpm --silent run cli process …`; DatabaseService owns only the Prisma connection lifecycle. The CLI redirects its build and migration diagnostics to stderr, preserving JSONL stdout. Listing rows retain ordered offers, the immutable message snapshot, current and original review state, approval fields, and provenance storage. postinstall generates the ignored Prisma client required by the application.
- **Cases handled** — The focused test uses one temporary SQLite file, starts an application context, saves one message with two ordered listings and different review flags, closes it, then starts the HTTP application against the same file and reads the same rows. It verifies migration application, persistence, offer ordering, review flags, closure, and restart.
- **Errors and limitations** — Prisma 7.10.1's SQLite migration command has an upstream schema-engine logging defect: it fails with an empty error unless `RUST_LOG=info`. `db:deploy` pins that documented workaround without changing dependencies. Runtime migration discovery requires the application to start from the repository root where prisma/migrations is available. Shared processor persistence, replay, HTTP listing routes, and approval remain in later tasks.
- **Verification evidence** — On 2026-11-10, `db:deploy` applied the migration to fresh temporary HTTP and CLI databases; a second deploy preserved the existing migration history, including on a disposable copy initialized by the former runner. HTTP startup completed after migration (with loopback access). The CLI emitted JSONL results only to stdout while build and migration output remained on stderr. The focused restart test passed; the full offline suite passed 22 suites / 248 tests, and `pnpm run typecheck` and `pnpm run build` passed.

### 04.2 — HTTP persistence and replay

PersistentIngestionService checks the stored ID before calling the stateless processor for a new HTTP message. Validate the final public result before storing it. Keep model calls outside the write transaction. Ordinary CLI processing neither persists nor replays messages.

Concurrent identical requests may both invoke the model before either saves. The database must still contain one successful ingestion and one set of listing rows.

**04.2T.** Check first ingestion, sequential exact replay with no additional gateway call, stable IDs, changed-payload conflicts, multiple offers in source order, and successful messages with zero offers. Exercise concurrent identical and conflicting submissions. Force a write failure and verify rollback. Verify that provider or extraction failures produce no successful stored ingestion.

#### 04.2 progress — 2026-11-10

- **Correction (2026-11-10)** — The initial implementation incorrectly put SQLite replay and persistence in ListingMessageProcessor and wired CLI startup to migrations. PersistentIngestionService now owns HTTP replay/conflict and atomic storage; ListingMessageProcessor and CLI are stateless. Route coverage follows in 04.3.
- **Handled cases** — The focused temporary-SQLite test verifies multi-offer persistence in source order, exact replay with stable IDs and one extraction call, changed-text conflict, concurrent identical writes producing one winner, empty project success, extraction failure without a stored message, and rollback after a duplicate listing-ID write failure.
- **Known gaps** — Concurrent identical requests can both call the gateway before either wins the database insert; Phase 05 deduplication remains out of scope. A concurrent changed-payload writer is guarded by the same post-insert reread path but needs broader HTTP coverage in 04.3.
- **Verification evidence** — `pnpm run typecheck` and `pnpm test -- test/persistence-replay.spec.ts` passed on 2026-11-10 (4 focused tests).

### 04.3 — HTTP ingestion

Connect `POST /messages` to PersistentIngestionService, which delegates processing to the same stateless processor used by the CLI. Return HTTP 200 for a new success or exact replay.

**04.3T.** Verify successful ingestion, replay, malformed JSON, invalid input, each typed failure and status, and internal storage failure. Compare CLI and HTTP results against the same database.

#### 04.3 progress — 2026-11-10

- **Implemented behavior** — Added `MessagesController` (`POST /messages`, HTTP 200 on new success or exact replay) and `MessagesExceptionFilter` (`APP_FILTER` extending `BaseExceptionFilter`) in `MessagesModule`. Extracted shared `extractCandidateMessageId` in `src/messages/raw-message.schema.ts` for reuse across `runJsonl` and `MessagesController`, and added optional `{ logger: false }` to `createHttpApplication` in `src/bootstrap.ts`. `MessagesController` validates payloads with `rawMessageSchema`, delegates to `PersistentIngestionService`, maps typed `ProcessingFailure` results to their planned HTTP status codes, and catches unexpected exceptions into safe `internal_error` 500 responses. `MessagesExceptionFilter` intercepts pre-controller JSON body parsing errors on `POST /messages` into `invalid_input` 400 without changing `/health` or unknown-route 404 responses.
- **Handled cases** — The focused offline suite in `test/http-messages.spec.ts` (10 tests against isolated temporary SQLite databases migrated from a `db:deploy` template) verifies multi-offer and zero-offer `POST /messages` ingestion with `StoredMessage`/`StoredListing` row order, extra-key stripping, sequential replay and post-restart replay via unconfigured `createHttpApplication` with stable listing IDs and zero gateway calls, changed `sender`/`received_at`/`text` conflict (409), concurrent identical (both 200) and concurrent conflicting (`200` + `409`) submissions, malformed JSON / scalar JSON / invalid `RawMessage` / missing `Content-Type` (400), `/health` (200) and `/unknown-route` (404) preservation, and CLI-vs-HTTP parity against the same SQLite database without CLI SQLite writes or replay side effects.
- **Errors and failure handling** — Verified all `POST /messages` error matrix rows offline: `invalid_input` -> 400 (malformed JSON, scalar JSON, empty/array/missing-fields/invalid-timestamp/plain-text payloads, retaining non-empty `message_id` when available and `null` otherwise), `message_conflict` -> 409 (sequential and concurrent conflicts; existing DB rows intact), `invalid_extraction` -> 502 (no stored message), `provider_unavailable` -> 503 (both gateway double and real unconfigured `createHttpApplication`; no stored message), `provider_timeout` -> 504 (no stored message), and `internal_error` -> 500 (duplicate listing ID atomic rollback leaving 0 rows, plus unexpected DB errors with no leaked error/path details).
- **Known gaps** — `GET /listings` and `POST /listings/{id}/approve` remain unimplemented pending Tasks 04.4 and 04.5. Replay after approval (`needs_review` snapshot vs current state) is deferred to Task 04.5T. Concurrent identical `POST /messages` requests can still issue duplicate model calls before the unique insert settles.
- **Verification evidence** — On 2026-11-10, `pnpm test -- test/http-messages.spec.ts` passed (1 suite, 10 tests); the full offline suite `pnpm test` passed (24 suites, 262 tests); `pnpm run typecheck` and `pnpm run build` passed with zero errors.
- **Follow-up** — Implement `GET /listings` in Task 04.4 and `POST /listings/{id}/approve` in Task 04.5, then complete Phase 04 exit verification in Task 04.6 (non-blocking for 04.3).

### 04.4 — Listing reads

Project persisted listings through the existing public listing schema. Return the current review flag in stable ingestion and offer order. Apply the approved filter contract so approvals appear on subsequent reads.

**04.4T.** Verify unfiltered and both filtered reads, malformed filters, ordering across messages and offers, and persistence after restart. Verify filtering after approval in 04.5T.

#### 04.4 progress — 2026-11-10

- **Implemented behavior** — Added `GET /listings` through `ListingsController` and `StoredListingsService`. The service maps persisted rows to the existing public listing schema, exposes the current `needs_review` state, and orders records by ingestion then offer index.
- **Filter behavior** — Omitted `needs_review` returns every listing; only the literal values `true` and `false` filter the current review flag. Other values, including repeated query parameters, return the typed `invalid_input` envelope with HTTP 400.
- **Verification evidence** — `pnpm test -- test/http-messages.spec.ts` passed 11 tests, including unfiltered and filtered reads, malformed filters, ordering across messages and offers, and restart persistence. `pnpm run typecheck` passed.
- **Follow-up** — Task 04.5 changes current review state on approval and verifies that this filter reflects the transition while the ingestion snapshot stays unchanged.

### 04.5 — Human approval with optional note

Apply the approved state transition to a stored listing, accepting an optional reviewer note that documents why the extracted information was accepted. Preserve original review eligibility to distinguish already-approved listings from listings that never required review. Approval updates current workflow state and saves the first approval note while preserving extracted property values, original review reasons, source evidence, and the immutable ingestion snapshot. Repeated approval is idempotent and does not overwrite the original timestamp or note.

**04.5T.** Verify first approval with and without a note; trimming, empty notes, invalid types, oversized notes, and unexpected properties; repeated approval with a different note; missing and ineligible listings; both review filters after approval; restart persistence; concurrent approval; and replay preserving the original snapshot, IDs, and review flag. Use isolated temporary SQLite and no live LLM calls.

#### 04.5 progress — 2026-11-10

- **Implemented behavior** — Added `POST /listings/{id}/approve` with an optional `note`. The strict request schema accepts an empty body or `{ "note": string }`, trims whitespace, treats blank notes as absent, and limits stored notes to 1,000 characters. `GET /listings` exposes the persisted note as `approval_note`; ingestion, CLI, and approval responses remain unchanged.
- **State and concurrency** — The first approval conditionally updates a flagged pending listing, sets current `needs_review` to `false`, records `approvedAt`, and stores the note. Concurrent callers reread the winning record; repeated approval preserves the original timestamp and note. Original eligibility, review reasons, provenance, and ingestion snapshot stay unchanged.
- **Errors and gaps** — Invalid bodies return `invalid_input` 400; missing IDs return `listing_not_found` 404; listings that never required review return `approval_conflict` 409. Approval does not edit extracted fields or resolve their uncertainties. Reviewer identity is not recorded, and edit, reject, and undo workflows remain out of scope.
- **Verification evidence** — `pnpm test -- test/http-messages.spec.ts` passed 12 offline tests, including approval notes, validation, idempotence, filters, restart persistence, concurrency, and replay. `pnpm run typecheck` passed.

### 04.6 — Verification and close-out

Review all focused results and run the HTTP, SQLite restart, and shared CLI/HTTP integration checks. Run `pnpm test`, `pnpm run typecheck`, and `pnpm run build`. Keep the automated suite offline and independent of Gemini calls and API keys. Confirm Phase 02 processing behavior still passes its regression checks.

#### 04.6 progress — 2026-11-10

- **Implemented / verified scope** — Reviewed all Phase 04 implementations and documentation across `04.1`–`04.5`. During exit verification of stateless CLI execution against an unreachable `DATABASE_URL`, caught that `createCliContext` in `src/cli.ts` still booted `AppModule` (connecting `DatabaseService` on startup). Added `CliAppModule` / `createCliApplicationContext` in `src/bootstrap.ts` (importing `LlmGatewayModule`, `ExtractionModule`, and `ListingsModule` without `DatabaseModule`) and switched `createCliContext` to it, plus added a regression check in `test/cli.spec.ts`. Aligned `docs/architecture.md`, `docs/phase-plans/README.md`, `docs/DECISIONS.md` (`OPEN-07`), `docs/roadmap.md`, `docs/success-criteria.md`, and `README.md`.
- **Handled cases** — Verified stateless built CLI execution with `DATABASE_URL` targeting a nonexistent directory (exited `1` with typed `provider_unavailable` on stdout, empty stderr, and zero SQLite files created), `db:deploy` migrations, `POST /messages` ingestion/replay/conflict/concurrency, `GET /listings` ordering/filtering/`approval_note`, `POST /listings/{id}/approve` (no note, trimmed note, idempotent repeat, concurrent approval, restart persistence, replay snapshot preservation), shared CLI/HTTP parity, and Phase 02 regression suites offline without API keys.
- **Errors and failure handling** — All 8 error matrix entries are verified offline across `04.2T`–`04.5T`: `invalid_input` (400), `message_conflict` (409), `invalid_extraction` (502), `provider_unavailable` (503), `provider_timeout` (504), `internal_error` (500), `listing_not_found` (404), and `approval_conflict` (409).
- **Known gaps** — Concurrent identical `POST /messages` submissions can both call the gateway before one wins the unique insert. Cross-broker deduplication (`duplicate_of`) belongs to Phase 05. Reviewer identity, field editing, rejection, undo, and approval history remain outside Phase 04 scope (`D-044`, `D-045`). Fresh-clone setup, live-extension readiness, and final submission checks belong to Phase 06 (`SC-15`, `SC-17`, `SC-18`, `PC-04`).
- **Verification evidence** — On 2026-11-10, after the final edit: `pnpm run typecheck` passed, `pnpm run build` passed, `pnpm test` passed (**24/24** suites, **264/264** tests offline without Gemini calls or API keys, including `foundation.spec.ts`, `persistence-replay.spec.ts`, `http-messages.spec.ts`, `cli.spec.ts`, `cli-integration.spec.ts`, and all Phase 02/03 regression suites), and direct `node dist/cli.js process test/fixtures/one-message.jsonl` with an unreachable `DATABASE_URL` and blank `LLM_API_KEY` emitted `{ "message_id": "example-001", "error": { "code": "provider_unavailable", "message": "Extraction is not configured" } }` on stdout with empty stderr and zero SQLite artifacts.
- **Follow-up** — Phase 05: resolve `OPEN-02` / `OPEN-06` and implement cross-broker deduplication; Phase 06: submission readiness and fresh-checkout verification (none block Phase 04 close-out).

## Planned error matrix

Verify the type, status, public response, and database state for each case. The coverage column identifies a planned check.

| Error code | Trigger | HTTP | Public response and database effect | Coverage |
| --- | --- | --- | --- | --- |
| `invalid_input` | Malformed JSON, invalid message, invalid approval body, or malformed listing filter | 400 | Typed input error. No state change. | 04.3T, 04.4T, 04.5T |
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

- [x] CLI remains stateless and works without SQLite; HTTP startup applies committed migrations. SQLite data and approval state survive restart.
- [x] Both transports use the same processing pipeline. HTTP replay returns the original snapshot without a model call, and changed payloads conflict.
- [x] Multi-offer and zero-offer successes persist correctly. Concurrent same-ID writes retain one winner, and failed writes leave no partial success.
- [x] All three endpoints work with the documented error contracts. Listing filters use current review state, and approval is idempotent and preserves replay history.
- [x] Focused offline checks, the full offline suite, typecheck, and build pass.
- [x] Dated evidence covers SC-02 through SC-05 and PC-01. Each task records implemented behavior, handled cases, errors, known gaps, and actual verification. Remaining items have an owner and an explicit blocking status.

Mark the phase **Verified** after all exit checks pass.
