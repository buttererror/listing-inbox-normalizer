# 01 — Contracts, policies, and CLI harness

**Status** — In progress. D-014 approves the phase grouping and D-012 governs the first listing contracts. Tasks 01.1 and 01.2 and their focused checks are complete; subsequent tasks remain planned.

Establish the shared processor contract and an offline CLI harness. The CLI accepts a local JSONL file with one or several messages. Use an injected processor in tests. Phase 02 will exercise extraction through the same boundary.

**Criteria advanced** — SC-01, SC-07, SC-09, SC-13 and PC-01. See the [success checklist](../success-criteria.md#brief-requirements) for full acceptance conditions.

## Approved contract and policy choices

These rules come from [D-012](../DECISIONS.md#d-012-approve-the-first-listing-scope-and-contracts). The first listing flow now spans Phases 01–03. Historical mentions of the first slice refer to that flow. The former slice 002 provider checkpoint is part of Phase 03, and the former Phase 02 broader coverage is Phase 04. Define contracts here and implement their behavior at the owning phase. Follow the [brief’s minimum output contract](../task-brief.md#output-contract-minimum-you-may-add-fields).

| Decision checkpoint | Rule for this slice | Why / consequence |
| --- | --- | --- |
| OPEN-01 — input and failures | Require JSON object fields `id`, `sender`, `received_at`, `text`. Require nonempty strings and an ISO timestamp with timezone offset. Keep original strings. Ignore extra keys. The CLI skips blank lines, emits one result per nonblank line, and continues after per-line failures. Failures use `{ "message_id": string or null, "error": { "code": string, "message": string } }`, a distinct envelope without a made-up classification. Return exit 1 after any failure, otherwise 0. | The brief gives the success envelope and is silent about failures. One distinct failure record keeps batch output parseable. Use `null` for an unavailable ID. CLI fatal argument or file errors go to stderr and exit 1. |
| OPEN-01 — HTTP mapping | POST success returns 200. Invalid JSON or input returns 400, conflicting ID 409, unavailable provider 503, invalid extraction/provider response 502, timeout 504, internal persistence error 500. Use the same error envelope in both transports, including stable codes `invalid_input`, `message_conflict`, `provider_unavailable`, `invalid_extraction`, `provider_timeout`, and `internal_error`. GET accepts exactly `true` or `false` when the filter is present and returns all stored listings when omitted. Invalid filters return 400. | Consistent transport behavior leaves success records compatible with the brief. Do not leak raw process output or message text in errors. |
| OPEN-02 — area | Keep supported land, built-up and unspecified area assertions distinguishable. For land, select explicit land area or one unambiguous unqualified area. For built properties, select explicit built-up area, then one unambiguous unqualified area, then explicitly labeled land area when it is the only usable area. Preserve the selected area kind internally. Conflicting values of the selected kind give a null public area and a review reason. | The public shape has one area field. Recording its kind prevents later comparisons between unlike areas. |
| OPEN-04 — extraction and grounding | Use a provider-independent request carrying instructions, source text and schema. Treat the response as unknown and parse it with a strict Zod schema. The slice schema accepts `listing` with one candidate and a list of `{ field, quote }` assertions. Require each quote to occur verbatim in the original message. Derive each field from the quote using explicit labels or cues and field-specific parsing. Permit multiple assertions per field. Reject malformed envelopes and unsupported listing counts. Ignore unusable field assertions and record review findings. | The model selects candidate evidence. The application owns acceptance and normalization. Exact quote matching alone cannot establish field meaning. One candidate keeps association narrow while multi-property grounding is deferred. |
| OPEN-04 — normalization | Convert Arabic-Indic digits, known area units and explicit sale prices such as `3.2M SAR`, `950 ألف ريال`, and comma-grouped SAR amounts. Require explicit SAR wording for a numeric price in this slice, with `period: total` only for an unambiguous asking price of an explicitly offered sale. Preserve `currency: SAR` in the required output shape. Missing, non-SAR, conditional, contradictory or unsupported amounts remain null with a reason. Normalize only explicitly offered contact numbers to Saudi mobile E.164. Require explicit city and district evidence. | Keep price, currency, location and contact from turning into inferred data. Do not use the sender as a contact. The broader price and currency rules require review before Phase 02. |
| OPEN-05 — review | For listings, provide a readable reason for each missing, unsupported, uncertain or conflicting applicable field. Bedrooms and bathrooms are inapplicable to land. Use `needs_review = review_reasons.length > 0`. Preserve rejected evidence and review findings internally. | The policy explains nulls and avoids requesting house attributes for a parcel. The broader review policy can be refined in later slices. |
| OPEN-07 — replay and storage | Store one message by source ID, with its four original field values, the successful result snapshot and related listing rows. Compare those four field values exactly on replay. Identical replay returns the saved result with its IDs and avoids the provider. Reused ID with different data returns conflict. Make the successful message/listing write atomic with a database unique constraint on message ID. Resolve a competing insert by rereading the winner and applying the same replay/conflict rule. Keep extraction outside the write transaction. Do not persist a success for failures. | A retry does not create duplicate records. Concurrent attempts may both call extraction, but only one successful set of records can be stored. Approval will update stored listing state in a later slice while replay retains the ingestion snapshot. |
| OPEN-08 — live qualification | Keep the test double inside the test boundary. In slice 002, verify installed executable, authentication, evaluator setup and actual restrictions on filesystem, tools and configuration loading using synthetic inputs before routing any untrusted message to Antigravity. | A valid JSON response alone does not establish isolation or evaluator availability. If the gate fails, review a replacement before enabling live ingestion. |

## Tasks and testing

Complete each testing task before starting the next implementation task. Record commands, results and limitations here as work proceeds.

| Implementation task | Outcome | Follow-up testing task |
| --- | --- | --- |
| **01.1 — Validate input messages** | Define the shared runtime input schema for `id`, `sender`, `received_at` and `text`. Preserve their original strings and ignore extra keys under OPEN-01. | **01.1T** — Accept a valid message and preserve the four values. Reject missing fields, non-string values, empty strings, and invalid timestamps or timestamps without a timezone. Check that extra keys are ignored. |
| **01.2 — Define public result contracts** | Define the successful message and listing result using the brief's minimum fields and nullability. Define the typed error envelope and the approved stable error codes. | **01.2T** — Check a valid success result with nullable fields, the required nested price shape, and a failure with an unknown message ID. Reject invalid enum values and missing required fields. |
| **01.3 — Define the processor and extraction boundaries** | Define the shared processor contract from a validated message to a result. Define the provider-independent extraction request and the strict candidate assertion schema for one `listing` candidate. Keep provider output unknown until parsed. | **01.3T** — Check that a controlled processor can return either result kind. Parse a valid candidate envelope and reject malformed assertions or unsupported candidate counts. Phase 02 exercises actual evidence checks. |
| **01.4 — Build the JSONL runner** | Process lines in order through the injected processor. Skip blank lines, emit one JSON result per nonblank line, and continue after a per-line failure. Keep diagnostics on stderr. | **01.4T** — Use one-line and multi-line inputs, including a blank line, malformed JSON, invalid input, and a valid message after a failure. Assert record order and count, clean stdout, and exit 0 for success or exit 1 after any failure. |
| **01.5 — Wire the CLI command** | Connect `process <input.jsonl>` to local file reading and the shared Nest application-context boundary. Use the controlled processor through the test boundary. Production uses the typed unavailable failure while the extraction route is unconfigured. | **01.5T** — Exercise the command with temporary JSONL files and the controlled processor. Check argument and file-read failures on stderr, exit 1, and application-context shutdown. Confirm the CLI runs without an HTTP listener. |

**01.1 / 01.1T — 2026-11-09:** Implemented the shared Zod input schema in Messages. `corepack pnpm test -- --runTestsByPath test/raw-message.schema.spec.ts` passed (9 tests), covering the specified cases and UTC timestamps; `corepack pnpm run typecheck` and `corepack pnpm run build` passed. The schema is not yet connected to a CLI or HTTP processor. Remaining tasks and phase exit checks are pending.

**01.2 / 01.2T — 2026-11-09:** Added runtime success, listing and failure schemas and inferred types. `corepack pnpm exec jest --runInBand --runTestsByPath test/message-result.schema.spec.ts` passed (5 tests); `corepack pnpm run typecheck` and `corepack pnpm run build` passed. The schemas are not yet connected to processing. Remaining tasks and phase exit checks are pending.

## Task briefs and test cases

The cases below define the inputs and expected outcomes for each testing task. Run each testing task after its implementation task. Use controlled processors and gateways for these offline checks. Record the actual result with the task ID when a test runs.

### 01.1 — Validate input messages

Define a runtime schema for the shared input. Return the four approved fields with their original string values and discard extra keys. Use this synthetic valid input as a base fixture for the CLI cases as well.

```json
{"id":"m-001","sender":"+966551234567","received_at":"2026-11-01T09:12:00+03:00","text":"For sale: Villa in Riyadh. Asking 3.2M SAR."}
```

**01.1T — Input schema cases**

| Case | Input | Expected outcome |
| --- | --- | --- |
| Valid message | The base fixture with an extra `debug` key | The schema accepts the message and returns exactly the four original fields. |
| Required field missing | Remove each required field in turn | The schema rejects each input. |
| Invalid field value | Substitute a number or an empty string for each required string | The schema rejects each input. |
| Invalid timestamp | Use `yesterday` or `2026-11-01T09:12:00` | The schema rejects invalid syntax or the missing timezone. |

### 01.2 — Define public result contracts

Define and validate the success shape against the [brief's minimum output contract](../task-brief.md#output-contract-minimum-you-may-add-fields). Include the nested price and review fields. Use a separate typed error envelope with the stable codes in the approved contract table.

**01.2T — Result schema cases**

| Case | Input | Expected outcome |
| --- | --- | --- |
| Listing success | A result with `message_id: "m-001"`, classification `listing`, one listing, `price: { "amount": 3200000, "currency": "SAR", "period": "total" }`, nullable unsupported fields, and a review reason | The success schema accepts the complete record with its original values. |
| Minimum shape violation | Remove `price.period` or `duplicate_of`, or use `classification: "unknown"` | The success schema rejects the record. |
| Failure with unavailable ID | `{ "message_id": null, "error": { "code": "invalid_input", "message": "Invalid JSONL record" } }` | The failure schema accepts the record. It contains the error and nullable ID. |
| Invalid error code | Substitute `unknown_error` for `invalid_input` | The failure schema rejects the code. |

### 01.3 — Define the processor and extraction boundaries

Define the processor interface that accepts one validated message and returns the public success or failure result. Define the provider-independent request with instructions, source text, and response schema. Parse unknown provider output with the strict single-listing candidate schema. Source grounding follows in Phase 02.

**01.3T — Boundary cases**

| Case | Input | Expected outcome |
| --- | --- | --- |
| Processor seam | Inject one processor returning the success fixture and another returning a typed failure | Both fit the same processor contract and their results remain distinguishable. |
| Valid extraction | A `listing` envelope with one candidate and a price assertion quoting `Asking 3.2M SAR.` | The extraction schema accepts the candidate and preserves the quote. |
| Malformed assertion | Omit `quote` or supply a non-string quote | The strict extraction schema rejects the envelope. |
| Unsupported candidate count | Supply zero or two candidates for a `listing` | The single-candidate schema rejects the envelope. |

### 01.4 — Build the JSONL runner

Read lines in order and use the input schema before invoking the injected processor. Serialize one result per nonblank line. Keep diagnostic text on stderr and aggregate the exit status after all lines are read.

**01.4T — Runner cases**

| Case | Input | Expected outcome |
| --- | --- | --- |
| One valid line | The base fixture and a successful test processor | One parseable JSON success on stdout and exit `0`. |
| Blank and malformed lines | Valid `m-001`, a blank line, malformed JSON, then valid `m-002` | Three JSON records in input order. The malformed line has `invalid_input` and a null ID. Both valid messages reach the processor. Exit `1`. |
| Invalid message fields | Valid JSON with `id: "m-003"` and an invalid timestamp, followed by valid `m-002` | An `invalid_input` record for `m-003`, then a success for `m-002`. The invalid message never reaches the processor. Exit `1`. |
| Processor failure | A valid message whose processor returns a typed failure, then a successful message | The failure and success both appear as JSON records. Processing continues and exit status is `1`. |
| Only blank lines | A file containing blank lines | No stdout records or processor calls. Exit `0`. |

### 01.5 — Wire the CLI command

Wire `process <input.jsonl>` to a file reader, the Nest application-context bootstrap, and the JSONL runner. Close the context when the command completes or fails after startup. Production reports `provider_unavailable` while the extraction route is unconfigured.

**01.5T — Command cases**

| Case | Input | Expected outcome |
| --- | --- | --- |
| Local file | A temporary one-line or multi-line JSONL file and a test-injected processor | The command returns the expected JSON records. It closes the application context and starts no HTTP listener. |
| Bad arguments | Invoke `process` without a file path | A diagnostic on stderr, empty stdout, and exit `1`. |
| Unreadable input | Pass a nonexistent file path | A diagnostic on stderr, empty stdout, and exit `1`. Any opened application context closes. |
| Unconfigured extraction route | Run the production composition on one valid line before provider qualification | One `provider_unavailable` result and exit `1`, without a provider call. |

## Exit check

The contracts and CLI work offline with a test-injected processor. A malformed nonblank line yields its own error record and the CLI continues to the next message. Run the offline suite, type check, and build, then record the results against the affected criteria. Verification evidence is pending.
