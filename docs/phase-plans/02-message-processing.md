# Phase 02 revision — Message processing through CLI

Status — In progress. Tasks 02.0 and 02.1 are recorded as complete. Tasks 02.2–02.6 are planned. See the [verified single-sale baseline](02-extraction-through-cli.md) and [v2 decisions](../DECISIONS.md#v2-decisions). [D-023](../DECISIONS.md#d-023-integrate-the-live-cli-provider-at-the-start-of-phase-02) puts live CLI setup first.

## Starting point

Preserve the tracker’s recorded completion of **02.0** and **02.1** and their verification evidence. **02.1 owns the complete Stage 1 — LLM Classification & Extraction prompt and structured response.** One tool-less call performs **Classify → Segment → Associate → Extract → Interpret → Normalize → Verify evidence-to-value consistency → Assess consistency → Produce structured output**. Extraction owns the prompt and schema. The LLM Gateway executes the request.

**02.2–02.4 are code-only changes in Stage 2 — Mechanical Validation.** If their checks expose a missing prompt responsibility, record it as a 02.1 follow-up.

## Remaining tasks

| Task | Implementation and focused offline verification | Manual Gemini CLI check |
| --- | --- | --- |
| **02.2 — Stage 2: Extraction Structure & Source Evidence Validation** | Implement **Parse → Validate candidate schemas independently → Validate semantic finding schemas independently → Verify source evidence → Check evidence integrity & offer scoping**. Merges former Task 02.3 into 02.2. Validate the envelope before checking individual candidate types and enums. Verify exact offer-local and explicitly shared evidence against the original message. Validate `SemanticFinding[]` shape and grounded quotes. Test malformed envelopes, clipped or fabricated quotes, wrong-offer evidence, repeated quotes scoped to offers, shared contacts, and partial recovery. Preserve usable candidates and grounded offers. Return `invalid_extraction` for an unusable envelope or when the response claims offers and none can be grounded. | Run a two-offer fixture with distinct prices and a shared contact (`test/fixtures/two-offers.jsonl`). Inspect the evidence and rejections per offer at the Extraction handoff. |
| **02.3 — Stage 2: Carry semantic findings forward** | *(Superseded — merged into Task 02.2 under D-030)*. Semantic findings schema validation, quote grounding, token clipping, and offer association are implemented and verified directly within 02.2. | Merged into 02.2 live check. |
| **02.4 — Stage 2: Complete Mechanical Validation** | Implement **Validate numerical constraints → Validate formats → Cross-check mechanical consistency → Separate accepted and rejected candidates → Return validated candidates and findings**. Return a `ValidationOutcome` per offer with accepted candidates, rejected originals, semantic findings, and validation findings. Test Arabic-Indic quantities, signed or clipped numbers, `3 BR` proposed as four bedrooms, Saudi phone format, price qualifiers, and arithmetic with explicitly linked operands. Verify that an invalid candidate leaves unrelated candidates and offers usable. | Inspect candidate-level outcomes for a fixture with quantities, a qualified price, and a Saudi phone. |
| **02.5 — Stage 3: Field Resolution and Stage 5: Runtime Reviewer** | Switch Listings to `ValidationOutcome` and retire the temporary single-sale bridge and legacy quote parsing from the active path. Produce `ResolvedOffer` with fields, applicability, findings, and provenance. Apply D-020 to identical and competing values, material uncertainty, explicit SAR, complete price tuples, rental periods, arithmetic discrepancies, area projection, and room applicability. Verify resolution separately from review. Test stable reasons and `needs_review` for material issues, including a complete listing, a harmless rejection, and mixed classification alone. | Verify selected values, nulls, and review reasons for a listing with competing claims and a missing applicable field. |
| **02.6 — Stage 0: Input Validation and Stage 6: Result Assembly & Persistence** | Reuse input validation and complete the CLI portion of result assembly. Messages assembles the resolved offers and review decisions, assigns distinct listing IDs, sets `duplicate_of: null`, and validates the final public result before serialization. Test the classification matrix, `mixed`, source-ordered `detected_classes`, valid zero-offer results, typed provider and extraction failures, and zero gateway calls for invalid input. Verify one ordered result per nonblank line, clean stdout, continuation after a failure, and exit codes 0 and 1. | Run an all-valid batch and a batch containing a mixed multi-offer message and malformed input. Verify the output, ordering, and exit status. |

## Mechanical Validation code boundaries

- Put the ordered Stage 2 checks behind one deterministic entry point in **Extraction**. `ExtractionService` calls it after the gateway returns and maps an unusable response to `invalid_extraction`. Keep the Zod schemas with the extraction contract and keep candidate data typed as `unknown` until it passes its schema check.
- Keep envelope and candidate schema checks, source evidence and integrity checks, and numeric, format, and arithmetic checks in separately testable functions. Reuse the existing source occurrence and clipping helpers. Use the same evidence checks for candidates and findings where their rules agree.
- Move each mechanical check out of the temporary Messages bridge as its Extraction implementation lands. Route typed candidates through Stage 2 before they can reach Listings. Update legacy test fixtures that would otherwise bypass the typed path. Keep the single-sale CLI runnable through 02.4, then remove the bridge in 02.5.
- Comment the validation entry point to explain check order and the distinction between message-level failure and candidate rejection. Add short comments explaining why evidence is scoped before testing for ambiguity, when shared evidence is usable, and why arithmetic requires explicitly linked operands.

## Phase exit

Run focused offline checks before dependent work and record each manual Gemini result separately. Use the live CLI to inspect internal handoffs in 02.2–02.4 and verify the full multi-offer public result in 02.6. Close Phase 02 after the full offline suite, typecheck, build, baseline regression, and live exit checks pass. Record dated success-criteria evidence. Independent provider evaluation remains in Phase 03, HTTP and SQLite in Phase 04, and stored-property deduplication in Phase 05.

Run the configured CLI after each task against a small, independently labeled JSONL fixture using `node dist/cli.js process <fixture.jsonl>`. Record the fixture, expected behavior, actual result, and any discrepancy or provider blocker. Keep stdout for JSONL. Record dated evidence for SC-01, SC-06–09, SC-11–13, PC-01, and PC-02 within the CLI boundary.

## Completed tasks

| Task | Architecture stage | Owner | Recorded completion |
| --- | --- | --- | --- |
| 02.0 | Stage 1 — LLM Classification & Extraction | LLM Gateway | Completed 2026-11-10. The Vercel AI SDK gateway selects tool-less Gemini, Anthropic, or OpenAI providers through the existing CLI. Offline adapter, extraction, and CLI checks passed, and the live Gemini synthetic fixture produced a listing. |
| 02.1 | [Stage 1 — LLM Classification & Extraction](../architecture.md#stage-1--llm-classification--extraction) | Extraction through the generic LLM Gateway | Completed 2026-11-10. Defined the typed extraction envelope, all 9 field candidates, bounded findings, and the 9-step ordered domain prompt. 02.1T verified matrix rows, reordered intents, duplicate classes, field variants, envelopes, and CLI integration with fabricated quote and quote/value mismatch checks. Live Gemini check returned price.amount: 3200000. |
| 02.2 | [Stage 2 — Mechanical Validation](../architecture.md#stage-2--mechanical-validation) | Extraction validation boundary | Completed 2026-11-10. Implemented Stage 2 Extraction Structure & Source Evidence Validation merging former 02.3 under D-030. Deterministic entry point validates envelope, independent candidate schemas, independent semantic finding schemas, exact source text evidence, token clipping, offer-local containment, shared evidence scoping, and offer disambiguation of repeated quotes. Rejects invalid evidence with deterministic reasons while preserving valid candidates and findings. 02.2T offline suite passed 16 focused tests (186 total tests). Live CLI check against `test/fixtures/two-offers.jsonl` returned valid two-offer extraction envelope with shared contact and local quotes. |

## 02.0 progress — 2026-11-09

The installed `agy` 1.5.3 authenticated and returned structured synthetic output. The original one-element Zod tuple emitted a draft-7 tuple schema rejected by the provider. The extraction schema now uses an equivalent array constrained to one element, and the provider accepted it. A synthetic CLI run with an explicitly injected experimental gateway returned a sale listing with `price.amount: 3200000` and review reasons for missing fields. This is an experiment, not a configured production entry point.

Offline gateway and extraction boundary checks passed 20 tests across three suites. Typecheck and build passed. The fake subprocess tests required execution outside the workspace sandbox to capture child output.

The `agy` schema error exposed model tool declarations. The CLI help provides no documented tool-free switch. The user requires a tool-less extraction call and specified that untrusted tool execution requires verified isolation. The experimental gateway was not wired into the production processor and was removed. This historical checkpoint was resolved by D-024, which selects the direct Gemini API without configured tools.

**02.0 / 02.0T — 2026-11-09:** The user selected the Gemini API without tools. The then-current shared CLI used the provider-independent gateway and direct HTTPS. Gemini 3.6 Flash returned a contract-compliant result for `test/fixtures/one-message.jsonl` with `price.amount: 3200000`. Gemini 3.8 Flash timed out at 45 seconds. The resulting review flags preserve baseline limitations, including the unsupported city parser. The full offline suite passed 123 tests across 15 suites, typecheck and build passed, and the actual built CLI passed with the default model. Provider usage, cost, and representative latency remain for Phase 03. D-026 later replaced the direct transport with the shared SDK gateway.

**SDK gateway completion — 2026-11-10:** Dwelleo remains a CommonJS application. The Gateway dynamically loads Vercel AI SDK 7 and the selected provider package, which keeps the application imports extensionless while allowing SDK 7's ESM packages. Offline provider tests verify Google, Anthropic, and OpenAI authentication, model selection, structured schema, absence of tools, malformed output, provider failures, timeouts, and missing configuration. The full offline suite passed 125 tests, and the built Gemini CLI fixture returned `price.amount: 3200000`. Anthropic and OpenAI live qualification remains in Phase 03.

## 02.1 progress — 2026-11-10

Stage 1 LLM Classification & Extraction implemented under D-019 and D-027.
- **Contract & Schemas:** Defined typed response schema in Extraction with `classification` (`listing | project | buyer_request | irrelevant | mixed`), source-ordered `detected_classes`, and `listings` containing `offer_quote`, field-discriminated `candidates` across all 9 extractable fields (purpose, property_type, city, district, bedrooms, bathrooms, area_sqm with kind, price with amount/currency/period/role, contact_phone), and bounded `findings` (uncertainty, contradiction, missing_context). Marked candidate quotes with local or shared scope.
- **Ordered Domain Prompt:** Authored the 9-step prompt (Classify → Segment → Associate → Extract → Interpret → Normalize → Verify evidence-to-value consistency → Assess consistency → Produce structured output) with independently authored examples covering Arabic, English, mixed wording, project unit ranges, shared contacts, written numbers, and qualified prices. Source text passed separately as `sourceText`.
- **Envelope Validation & Candidate Preservation:** Strict envelope checks enforce single-intent base class matching, mixed substantive intent uniqueness (no duplicate classes, no `'mixed'` in detected classes), and offer presence exactly when `listing` is detected.
- **Interim CLI Sale Bridge:** Connected single sale listings to baseline Listings resolution under D-027, forwarding agreed offer-local evidence and keeping rejected evidence (including fabricated quotes, clipping, multiple occurrences, and quote/value mismatches) on the review path. Preserved empty results for buyer requests, irrelevant messages, and project announcements without offers. Unhandled multi-offer and mixed assembly returns typed `internal_error` awaiting 02.6.
- **Verification:** 02.1T Extraction suite passed 34 focused tests. 02.1T CLI suite passed Arabic/English sales, rejected fabricated quote, and quote/value mismatch checks. Full offline test suite passed 158 tests across 15 suites. Typecheck and build passed.
- **Live CLI Check:** `node dist/cli.js process test/fixtures/one-message.jsonl` returned a contract-compliant sale listing with `price.amount: 3200000` SAR total. Inspection of the live Extraction handoff verified 1 offer, exact evidence, and typed candidates with local scope.

## 02.2 progress — 2026-11-10

Stage 2 Extraction Structure & Source Evidence Validation implemented under D-030, merging former Task 02.3 into 02.2.
- **Deterministic Stage 2 Validation Entry Point:** Implemented `validateStage2` in `src/extraction/stage2-mechanical-validation.ts`. Ordered checks:
  1. Envelope validation: reuses `validateExtractionEnvelope` to enforce classification, detected classes, and offer structure.
  2. Offer grounding: checks each claimed offer quote against the source message text. If listings are claimed but none can be grounded, returns typed `invalid_extraction`.
  3. Independent candidate schema validation: parses each candidate with `typedFieldCandidateSchema` keeping input typed as `unknown` until valid. Invalid candidates are rejected with deterministic reason `invalid_schema` without failing the offer or message (partial recovery).
  4. Source evidence verification & scoping:
     - Verbatim occurrence in source text (rejects fabricated quotes with `quote_not_in_source`).
     - Offer-local containment: quotes with `scope: 'local'` must appear within `offer_quote` and inside the offer's source span (rejects wrong-offer evidence with `wrong_offer`).
     - Shared evidence scoping: quotes with `scope: 'shared'` must exist in source text outside other offers or within current context (rejects exclusive cross-offer quotes with `unscoped_shared_evidence`).
     - Token clipping: checks boundaries for alphanumeric cuts, number/decimal cuts, sign cuts, and rate slashes (preserves Arabic attached prefix 'و').
     - Repeated quotes: disambiguates quotes across multiple offers by offer scoping; rejects quotes that repeat ambiguously within a single offer with `multiple_occurrences`.
  5. Semantic findings validation (former 02.3): validates finding schemas, verifies verbatim quotes, token clipping, and offer scoping; preserves grounded uncertainty, contradiction, and missing context findings.
- **ExtractionService Integration:** `ExtractionService.extract()` executes Stage 2 validation after gateway response, maps unusable envelopes or ungrounded claims to `invalid_extraction`, populates `listings` with accepted candidates and semantic findings only, and records `rejectedEvidence` and `validationOutcomes`. Invalid evidence never reaches downstream resolvers or review.
- **Verification:**
  - `02.2T — Stage 2` suite in `test/stage2-mechanical-validation.spec.ts` passed 16 focused offline tests covering candidate schemas, semantic findings, partial recovery, the handoff example (accepting villa bedrooms, rejecting wrong-offer price, accepting apartment bedrooms, accepting shared contact), fabricated quotes, token clipping, attached Arabic conjunction, unscoped shared evidence, repeated quotes, offer ungrounded policy, and ExtractionService integration.
  - Full offline suite passed 18 test suites (186 total tests) without API credentials.
  - `pnpm run typecheck` and `pnpm run build` passed cleanly with exit code 0.
- **Live CLI Check:** `node dist/cli.js process test/fixtures/two-offers.jsonl` returned exit code 0 with a valid Stage 1 extraction envelope containing two grounded listings (Villa in Riyadh and Apartment in Jeddah) with local field quotes and shared contact phone.

