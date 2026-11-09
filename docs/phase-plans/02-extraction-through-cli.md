# 02 — Extraction through CLI

**Status** — Planned. Start after Phase 01 verification and implementation authorization.

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
| **02.3 — Verify field meaning** | Check that each surviving quote supports its claimed field using explicit cues. Pass supported evidence to Listings and retain unsupported assertions as findings. | **02.3T** — Check that a real quote used for the wrong field cannot supply a value. |
| **02.4 — Normalize supported values** | In Listings, convert grounded evidence to the public field types under the approved sale, area, price and contact rules. Preserve distinct assertions for review. | **02.4T** — Check Arabic-Indic digits, decimal and comma-grouped SAR prices, area projection and Saudi mobile format. |
| **02.5 — Resolve fields and derive review** | In Listings, resolve supported values, leave missing or conflicting fields null, and derive readable reasons and `needs_review`. | **02.5T** — Check complete listings, missing applicable fields, inapplicable land fields and competing assertions. |
| **02.6 — Verify the shared processor through CLI** | Compose Extraction and Listings behind the shared processor with a gateway supplied by tests. Serialize the public result through the existing CLI with `duplicate_of: null`. | **02.6T** — Run one-message and multi-message JSONL fixtures, including a failed extraction followed by a valid message. |

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

### 02.3T — Field meaning

| Case | Input | Expected outcome |
| --- | --- | --- |
| Wrong field | For `Villa for sale. 5 BR. Asking 3.2M SAR.`, the gateway quotes `5 BR` for both bedrooms and bathrooms. | The bedroom assertion is supported. The bathroom assertion is rejected with a finding even though the quote is present. |
| Price context | In an explicit sale, the gateway quotes `Deposit: 50,000 SAR` as the asking price. | The deposit does not supply the asking price. The assertion is retained as unsupported evidence. |
| Location evidence | The source explicitly labels a district but omits the city. The gateway reuses the district quote for city. | The district assertion can survive. The city assertion is rejected without inferring a city. |

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

## Exit check

The offline CLI path demonstrates grounded and normalized listing results and readable reasons for unsupported values. Run the offline suite, type check, and build. Record the results and update affected success criteria. Persistence, replay, HTTP parity and live qualification have [separate acceptance checks](../roadmap.md#phase-03-carryover-checks). Verification evidence is pending.
