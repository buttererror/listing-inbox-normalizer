# 02 — Extraction through CLI

**Status** — In progress. Tasks 02.1–02.5 are complete. Task 02.6 (shared processor CLI integration) is next. Phase exit checks are pending.

Verify classification, extraction and normalization for one supported sale listing per message through the CLI. Use the [approved contracts](01-contracts-and-cli.md#approved-contract-and-policy-choices) and an offline test gateway. Both the one-line and multi-line fixtures use the same JSONL input shape.

**Criteria advanced** — SC-01, SC-06–SC-09, SC-11, SC-13 and PC-01. See the [success checklist](../success-criteria.md#brief-requirements) for full acceptance conditions.

## Scope and checkpoints

Phase 02 uses the single-sale rules approved in D-012. Review [OPEN-04](../DECISIONS.md#open-policy-checkpoints) before extraction and normalization. Broader choices about associating evidence across listings, prices, currencies and inference need separate approval before any work that depends on them. The cases below exercise explicit evidence within the approved scope. HTTP, persistence and live provider qualification carry forward to Phase 03.

## Tasks and testing

Complete each focused testing task before starting dependent work, as required by [D-013](../DECISIONS.md#d-013-pair-small-slice-tasks-with-focused-verification). The cases below are planned tests. Record commands, outcomes and limitations with each task as it runs.

| Implementation task | Outcome | Follow-up testing task |
| --- | --- | --- |
| **02.1 — Call and validate extraction** | Extraction sends the original source, domain instructions and the response schema through the generic gateway. It validates the unknown response using the existing single-candidate schema. | **02.1T** — Verify the request, accepted candidate and typed failure for an invalid envelope. |
| **02.2 — Verify verbatim evidence** | Check every assertion against the original text. Keep exact matches and retain rejected assertions with findings for review. | **02.2T** — Check exact and invented quotes, including mixed valid and invalid evidence in one candidate. |
| **02.3 — Verify meaning in one model call with mechanical checks** | Use one model call to propose evidence and assess whether it supports the claimed field. Application code verifies source integrity mechanically (exact quotes, verbatim context quotes, token boundaries, and occurrence disambiguation). | **02.3T** — Verify single gateway call, schema validation, invented quotes or context, clipped tokens (including decimal and grouping cuts), repeated occurrences, and mixed verdicts in Arabic and English. |
| **02.4 — Normalize supported values** | In Listings, convert grounded evidence to the public field types under the approved sale, area, price and contact rules. Preserve distinct assertions for review. | **02.4T** — Check Arabic-Indic digits, decimal and comma-grouped SAR prices, area projection and Saudi mobile format. |
| **02.5 — Resolve fields and derive review** | In Listings, resolve supported values, leave missing or conflicting fields null, and derive readable reasons and `needs_review`. | **02.5T** — Check complete listings, missing applicable fields, inapplicable land fields and competing assertions. |
| **02.6 — Verify the shared processor through CLI** | Compose Extraction and Listings behind the shared processor with a gateway supplied by tests. Serialize the public result through the existing CLI with `duplicate_of: null`. | **02.6T** — Run one-message and multi-message JSONL fixtures, including a failed extraction followed by a valid message. |

**02.1 / 02.1T — 2026-11-09:** Added the extraction service and a JSON Schema derived from the existing Zod contract. `corepack pnpm exec jest --runInBand --runTestsByPath test/extraction.service.spec.ts` passed 5 tests; typecheck and build passed. The production processor is not yet wired to the service. Verbatim and field-specific grounding are tasks 02.2 and 02.3. The draft-7 schema's compatibility with the eventual provider remains to be verified during qualification.

**02.2 / 02.2T — 2026-11-09:** Extraction now checks every structurally valid assertion against the original source and retains rejected assertions with `quote_not_in_source`. `corepack pnpm exec jest --runInBand --runTestsByPath test/extraction-evidence.spec.ts test/extraction.service.spec.ts` passed 8 tests; typecheck and build passed. Field meaning, review reasons and processor integration remain pending.

**02.3 / 02.3T — 2026-11-09:** Initial pattern-based verifier passed 14 tests, but whole-quote patterns rejected valid phrasing and missed trailing qualifiers. Under D-016 (superseding D-015), 02.3 was revised to verify meaning in one model call with mechanical checks, further strengthened under E-008 to enforce strict context containment, untrimmed context matching, signed numbers, and compound rate units. `corepack pnpm exec jest --runInBand --runTestsByPath test/extraction-field-meaning.spec.ts test/extraction-evidence.spec.ts test/extraction.service.spec.ts` passed 34 tests; full test suite (88 tests), typecheck and build passed. Application code contains no keyword lists for field meaning. Accuracy on unseen messages remains a live qualification criterion. Normalization, review reasons and integration remain pending.

**02.4 / 02.4T — 2026-11-09:** Added Listings normalizer for supported assertions with original evidence, findings and distinct competing values. Area selection prioritizes built-up area for built properties and land area for land. `corepack pnpm exec jest --runInBand --runTestsByPath test/listings-normalization.spec.ts` passed 17 tests; typecheck and build passed.

**02.5 / 02.5T — 2026-11-09:** Added listing field resolution and review derivation in Listings (`resolveListing` and `ListingsService`), corrected under E-009 to keep verified asking prices alongside rejected deposits and leave area null when conflicting property types change selection. Resolved supported values, left missing, unsupported or conflicting applicable fields null, omitted bedrooms and bathrooms for land without review reasons, and derived readable review reasons and `needs_review = review_reasons.length > 0`. `corepack pnpm exec jest --runInBand --runTestsByPath test/listings-resolution.spec.ts` passed 11 tests; full offline suite (99 tests across 11 suites), typecheck and build passed. Processor integration remains task 02.6.

### 02.1T — Gateway and response validation

| Case | Input | Expected outcome |
| --- | --- | --- |
| Valid extraction | Source includes `Asking 3.2M SAR.`. The test gateway returns one `listing` candidate with that price quote. | The gateway receives the original source, instructions and response schema. Extraction preserves the quote and classification. |
| Invalid envelope | The gateway returns an assertion with a numeric `quote`, or returns zero or two candidates. | The response is rejected and the processing failure uses `invalid_extraction`. No successful listing is produced. |

### 02.2T — Exact source evidence

| Case | Input | Expected outcome |
| --- | --- | --- |
| Exact and invented quotes | Source is `للبيع شقة. السعر ٩٥٠ ألف ريال.`. The gateway quotes `للبيع` for purpose and `السعر 980 ألف ريال.` for price. | The purpose quote survives. The invented price quote is retained as rejected evidence with a finding. |
| Altered digits | For the same source, the gateway quotes `السعر 950 ألف ريال.`. | The quote fails the verbatim check. Digit normalization happens after grounding. |

### 02.3T — Field meaning and mechanical integrity

| Case | Input | Expected outcome |
| --- | --- | --- |
| Arabic purpose & property type | `فرصة مميزة: فيلا للبيع في حي هادئ.` with `فيلا للبيع` claimed for both `property_type` and `purpose`. | Both assertions marked supported pass mechanical checks and are forwarded in `{ field, quote }` form. |
| Contradicted field | `A family villa for sale with 5 BR.` with `5 BR` claimed as bedrooms (`supported`) and bathrooms (`contradicted`). | The bedroom assertion is forwarded; the bathroom assertion is retained in rejected evidence with reason `field_contradicted`. |
| Trailing price qualifier | `Villa for sale. Asking 3.2M SAR per year.` with quote `Asking 3.2M SAR` and context `Asking 3.2M SAR per year` (`contradicted`). | The non-total price is retained in rejected evidence with reason `field_contradicted`. |
| Uncertain wording | `five sleeping chambers، وبدون غرف نوم` with unfamiliar and negated bedroom claims (`uncertain`). | Both assertions are retained in rejected evidence with reason `field_uncertain`. |
| Invented quote or context | Source lacks the quoted value or provides a context quote not matching the source or not containing the quote. | Mechanically rejected with reason `quote_not_in_source` or `context_not_in_source`. |
| Clipped token | `Villa for sale, asking 150,000 SAR.` with quote `50,000 SAR` or `150`, or `Asking 3.2M SAR.` with quote `3`. | Mechanically rejected with reason `clipped_token` for cutting inside words, numbers, or grouping/decimal separators. |
| Repeated occurrences | `Asking price 50,000 SAR; deposit 50,000 SAR.` with quote `50,000 SAR`. | Without disambiguating context, mechanically rejected with `multiple_occurrences`. Resolved when a unique quote or unique context quote is provided. |
| Mixed verdicts in one call | `Villa for sale in Al Malqa with 3 bedrooms.` with supported bedroom, contradicted bathroom, and uncertain city. | Supported forwarded, others retained with findings. The LLM gateway is called exactly once. |

### 02.4T — Normalization

| Case | Input | Expected outcome |
| --- | --- | --- |
| Arabic sale | `للبيع شقة، ٣ غرف نوم، السعر ٩٥٠ ألف ريال. للتواصل: ٠٥٥١٢٣٤٥٦٧`, with supported quotes for those fields. | Bedrooms are `3`, price is `950000 SAR` with period `total`, and contact is `+966551234567`. |
| English sale price | An explicit sale with asking price `3.2M SAR` or `3,200,000 SAR`, tested separately. | Both forms produce `3200000 SAR` with period `total`. |
| Area kind | A villa has explicit land area `450 sqm` and built-up area `380 sqm`. | The selected public area is `380` and its kind remains built-up internally. |
| Unsupported currency | An explicit sale quotes an asking price of `250,000 USD` or `250,000` without a currency, tested separately. | Price amount and period stay null. The public currency remains `SAR` and the result carries a price finding. |

### 02.5T — Field resolution and review

| Case | Input | Expected outcome |
| --- | --- | --- |
| Complete supported listing | A sale villa has explicit evidence for all applicable fields and no findings. | The supported values are returned with `needs_review: false` and an empty reasons array. |
| Missing and unsupported fields | A villa has no offered contact and its only bathroom quote is `5 BR`. The sender contains a phone number. | Contact and bathrooms stay null, each with a readable reason. The sender does not supply the contact. |
| Inapplicable fields | A land listing has no bedrooms or bathrooms. | Both fields remain null without missing-field reasons for those two fields. |
| Conflicting assertions | A sale has two distinct, explicitly stated total asking prices. | The price amount and period remain null, both assertions are retained, and a readable conflict reason sets `needs_review: true`. |

### 02.6T — Offline CLI integration

| Case | Input | Expected outcome |
| --- | --- | --- |
| One message | A temporary JSONL file contains the Arabic sale from 02.4T. | Stdout contains one record conforming to the public result schema. Assert normalized price and contact, null for omitted fields with readable reasons, and `duplicate_of: null`. Exit `0`. |
| Two independent sales | A file contains the Arabic sale and an independent English villa sale with a different asking price. The test gateway returns distinct source quotes for each message. | Stdout contains exactly two JSON success records in input order, each with its own facts and review reasons. Exit `0`. |
| Invalid extraction followed by valid sale | The gateway returns a malformed response for the first message and valid evidence for the second. | Stdout contains an `invalid_extraction` record with the first ID followed by the second success. There are no diagnostic lines on stdout. Exit `1`. |

## Proposed revision before 02.6

[D-017](../DECISIONS.md#d-017-carry-evidence-backed-field-interpretations-into-normalization) was approved on 2026-11-09. The existing task records document the earlier implementation. Advance SC-08, SC-09, SC-11 and SC-13 with these revisions, then SC-01 through CLI integration.

**Revision progress — 2026-11-09:** The existing price normalizer now handles `SAR 3.2M` and rejects negative prices and tested recurring and per-area rates. The architecture records the approved handoff as in progress. The focused normalization suite passed 22 tests and typecheck passed. The revised extraction handoff, grounded location handling, processor and CLI integration, full suite and build remain pending.

| Order | Proposed work | Focused verification |
| --- | --- | --- |
| 1 | Revise 02.3. Define a strict field-specific interpretation in Extraction's gateway schema. For supported assertions, carry the proposed field meaning and literal value and qualifier spans inside the verified assertion. For price, carry a raw signed amount token, scale and currency evidence where present, and the price role and period. Preserve optional context, source occurrence checks, and rejected assertions. Keep the gateway generic. | One model call per input. Reject malformed interpretations, fabricated tokens, spans outside the matching occurrence, clipped signs or rate units, and mismatched or ambiguous evidence. Verify that an invalid assertion leaves independently grounded assertions usable and that an invalid envelope returns `invalid_extraction`. |
| 2 | Revise 02.4. Convert grounded tokens to domain values in Listings. Accept prefix and suffix SAR, Arabic-Indic digits, grouped numbers and magnitude suffixes. Validate signs, finite results and explicit rate or period markers against the proposed interpretation. Use the grounded location text when its field is established by the model. Preserve the no-inference rules for locations and sender contacts. | Verify `SAR 3.2M`, `3,200,000 SAR`, `٩٥٠ ألف ريال`, Saudi mobiles and explicit locations from the brief. Check that `−50,000 SAR`, `50,000 SAR/yr` and per-area rates never become valid sale totals, including when the mock model labels them as total. |
| 3 | Verify 02.5 against the revised handoff. Preserve evidence and qualifiers, resolve distinct supported facts, and derive review reasons for unsupported or conflicting fields. | A rejected deposit or rate can coexist with a verified total. Conflicting verified totals leave price null. A missing total leaves amount and period null with a readable reason. Recheck inapplicable land fields and area resolution when the category is unresolved. |
| 4 | Complete 02.6 through the shared processor and CLI with an offline gateway. | Process original English and Arabic sale fixtures from the brief and independent variants. Check public output, JSONL ordering, clean stdout and continuation after an invalid envelope. Run the full offline suite, typecheck and build. Record dated evidence against the affected criteria. |

Broader coverage in Phase 04 should exercise `85,000/yr` and recurring prices with explicit currency, after review of OPEN-04. The supplied land example's per-area rate is separate evidence from the stated total. Do not calculate a substitute total or assume currency for a separate amount without an approved policy.

## Exit check

**02.5 follow-up — 2026-11-09:** Under D-018, explicit uncertainty generates a review reason alongside supported values. Area kind is omitted for conflicting values or differing projections, and unresolved property type no longer makes absent room counts required. The focused resolver suite passed 15 tests. Typecheck and build passed. Price-period comparison remains part of later rental support.

The offline CLI path demonstrates grounded and normalized listing results and readable reasons for unsupported values. Run the offline suite, type check, and build. Record the results and update affected success criteria. Persistence, replay, HTTP parity and live qualification have [separate acceptance checks](../roadmap.md#phase-03-carryover-checks). Verification evidence is pending.

**02.4 / 02.4T independent work — 2026-11-09:** Added a Listings normalizer for supported assertion fixtures, with original evidence, findings and distinct competing values. Area selection returns the applicable priority group for later conflict resolution. `corepack pnpm exec jest --runInBand --runTestsByPath test/listings-normalization.spec.ts` passed 11 tests; typecheck and build passed. Integration and the mixed-outcome boundary test remain pending 02.3T. The current extraction checks may accept a quote whose needed qualifier is only in context; the handoff must address this before integration. Location normalization and field conflict resolution remain pending.

**02.4 follow-up — 2026-11-09:** The independent normalizer accepts attached room and area units and negotiable prices, rejects tested per-area rates and non-total prices, and handles explicitly labelled locations. The focused suite passed 17 tests; typecheck and build passed. Location parsing is limited to explicit colon-labelled names. Extraction handoff, clipped qualifier verification and CLI integration remain pending 02.3T and subsequent tasks.
