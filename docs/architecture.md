# Dwelleo processing architecture

The [assessment brief](task-brief.md) defines requirements. The [policy reference](processing-resolution-policy.md) defines selection and review behavior. [Plan v2](../PLAN-v2.md) defines the delivery sequence.

## Implemented baseline

NestJS starts an HTTP application or a CLI application context. `GET /health` reports liveness. Zod validates configuration and inputs. The [verified single-sale CLI baseline](phase-plans/02-extraction-through-cli.md) uses a mocked gateway, quote-based assertions, evidence checks, and Listings normalization and resolution. The unconfigured gateway returns `provider_unavailable`. Prisma is configured for SQLite and CommonJS generation. Domain persistence and HTTP listing routes are planned.

## Module boundaries

| Module | Responsibility |
| --- | --- |
| Messages | Input validation, replay, result assembly, and shared CLI/HTTP orchestration |
| Extraction | Domain prompt, typed candidate schema, and mechanical validation |
| LLM Gateway | Generic provider execution, typed failures, timeouts, and usage |
| Listings | Field resolution, identity matching, automated review, and approval |
| Database | Prisma lifecycle and embedded persistence |

The numbered stages are logical components within these modules. The model interprets, the validator checks, the resolver selects, the deduplicator matches, the reviewer evaluates, and the application persists.

## Planned v2 pipeline

```text
Raw Message
    |
    v
[0] Input Validation
    |
    v
[1] LLM Classification & Extraction
    |  Normalized candidates
    |  Evidence
    |  Semantic findings
    v
[2] Mechanical Validation
    |  Accepted candidates
    |  Rejected candidates + findings
    v
[3] Field Resolution
    |  Resolved fields
    |  Conflicts / missing values
    v
[4] Deduplication
    |  duplicate_of
    |  Duplicate findings
    v
[5] Runtime Reviewer
    |  needs_review
    |  review_reasons
    v
[6] Result Assembly & Persistence
    |
    v
Public Result
```

**Quality evaluation** runs separately against the runtime pipeline.

---

## Stage 0 — Input Validation

**Owner:** Messages module

### Responsibilities

1. Receive the original message containing `id`, `sender`, `received_at`, and `text`.
2. Validate the input schema and required fields.
3. Reject malformed inputs with typed errors.
4. Preserve the original message text without altering its evidence.
5. Once storage exists, check for replay or a changed-payload conflict before calling the model. Pass new messages to Extraction.

**Output** — `RawMessage` with the four validated string fields, a stored `MessageSuccess` on exact replay, or a typed `ProcessingFailure`.

**Boundary** — Classification, interpretation, normalization, and extraction belong to Stage 1.

---

## Stage 1 — LLM Classification & Extraction

**Owner:** Extraction module + generic LLM Gateway
**Execution** — One model call per newly processed message. Extraction owns the prompt and response schema. The generic gateway returns untrusted output or a typed provider failure.

### Responsibilities — In execution order

1. **Classify:** Identify message intents: `listing`, `project`, `buyer_request`, `irrelevant`, or our approved extension `mixed`.
2. **Segment:** Identify individual property offers, separating multiple properties and different message intents.
3. **Associate:** Assign property-specific and explicitly shared information to the correct listing candidates.
4. **Extract:** Identify all supported property attributes and their exact source quotes.
5. **Interpret:** Understand Arabic, English, Saudi terminology, abbreviations, informal wording, and contextual qualifiers.
6. **Normalize:** Convert interpreted attributes into canonical values: property enums, numbers, area categories, price amounts and periods, and phone numbers.
7. **Verify evidence-to-value consistency:** Cross-check every proposed normalized value against its quote. Ensure the quote supports the exact value, field meaning, units, and qualifiers. Correct unsupported values using source evidence or omit them and report uncertainty.
8. **Assess consistency:** Identify contradictions, conflicting assertions, missing context, ambiguous descriptions, and other semantic uncertainties. Preserve competing assertions.
9. **Produce structured output:** Return typed normalized candidates, exact evidence, message classifications, property groupings, and structured findings.

### Prompt and contract

Use representative examples from the brief and independently authored examples. Cover classification boundaries, property segmentation, offer-local and shared facts, Saudi terminology, Arabic-Indic digits and written numbers, price roles and periods, area kinds, conflicting evidence, and missing fields. Each quote is an exact contiguous source passage covering the claimed fact and its essential qualifiers. Use bounded finding categories with supporting evidence where available. The initial contract carries normalized candidates and findings. Any later confidence score or verification verdict requires evidence of benefit and a separate decision.

### Example

Original message:

`للبيع فيلا ٣ غرف نوم، السعر مليون ونص ريال`

Conceptual output:

```json
{
  "classification": "listing",
  "detected_classes": ["listing"],
  "listings": [
    {
      "candidates": [
        {
          "field": "property_type",
          "value": "villa",
          "quote": "فيلا"
        },
        {
          "field": "bedrooms",
          "value": 3,
          "quote": "٣ غرف نوم"
        },
        {
          "field": "price",
          "value": {
            "amount": 1500000,
            "currency": "SAR",
            "period": "total"
          },
          "quote": "السعر مليون ونص ريال"
        }
      ],
      "findings": []
    }
  ]
}
```

This example shows the internal extraction envelope. Stage 6 defines the public result.

An area candidate retains its measurement kind. For example, `380m2 built-up` supports `{ "field": "area_sqm", "value": 380, "kind": "built_up", "quote": "380m2 built-up" }`.

### Output

Conceptually, the `ExtractionEnvelope` groups `ExtractedOffer[]` under the classification. Each offer carries its source association, an array of `TypedFieldCandidate` values discriminated by field, and `SemanticFinding[]`. The envelope contains:

- Message classification and detected classifications.
- Separate property candidates.
- Typed normalized field candidates.
- Verbatim evidence for each candidate.
- Structured uncertainty and contradiction findings.

### Boundary constraints

- Ground every proposal in source evidence, keep each offer's facts separate, and preserve contradictory assertions for resolution.
- Produce listing candidates only for identifiable offers. Buyer requests and project unit ranges retain their message classification.
- Messages assigns public listing IDs. Independent evaluation measures semantic accuracy.

---

## Stage 2 — Mechanical Validation

**Owner:** Extraction validation boundary
**Execution:** Deterministic code, no LLM.

### Responsibilities — In execution order

1. **Parse:** Parse the model response and check that the overall message and listing envelope is structurally usable.
2. **Validate candidate schemas independently:** Check each field candidate against its expected types and enum values.
3. **Verify source evidence:** Confirm that every supporting quote exists verbatim in the original message.
4. **Check evidence integrity:** Detect clipped words and numbers and repeated occurrences that remain ambiguous after scoping. Check offer-local containment and explicitly shared evidence.
5. **Validate numerical constraints:** Require appropriate integers, finite numeric values, and justified ranges.
6. **Validate formats:** Check canonical phone numbers, currency, price periods, and other field-specific formats.
7. **Cross-check mechanical consistency:** Compare explicit, machine-readable quantities with proposed values where a reliable comparison is possible. Perform arithmetic checks when sufficient structured operands exist.
8. **Separate accepted and rejected candidates:** Preserve usable candidates and record failures individually.
9. **Return validated candidates and findings** to the resolver.

### Example

Source: `Villa with 3 BR`

LLM candidate:

```json
{
  "field": "bedrooms",
  "value": 4,
  "quote": "3 BR"
}
```

A reliable numeric cross-check detects the mismatch.

Result:

- Reject the bedroom candidate.
- Preserve it with a validation finding.
- Continue processing other valid fields.

### Failure policy

| Situation | Behavior |
|---|---|
| Malformed JSON or unusable message envelope | Typed message-level failure |
| Valid envelope, one invalid candidate | Reject candidate; keep remaining data |
| Fabricated quote | Reject affected candidate |
| Invalid number or enum | Reject affected candidate |
| Mechanically unverifiable semantics | Do not claim independent verification; retain valid-shaped evidence and rely on model interpretation and independent quality evaluation |

### Output

```ts
type ValidationOutcome = {
  acceptedCandidates: TypedFieldCandidate[];
  rejectedCandidates: RejectedCandidate[];
  semanticFindings: SemanticFinding[];
  validationFindings: ValidationFinding[];
};
```

Keep rejected originals, offer association, and reasons. Carry source-grounded semantic findings with the offer through validation, resolution, and review. Exact source quotes and mechanical checks establish verifiable properties of the proposal. The model's in-call cross-check is a model judgment. Independent evaluation measures semantic accuracy and property association.

### Boundary constraints

- Check only mechanically verifiable evidence and values. The model owns language interpretation and Listings owns conflict resolution.
- Preserve the original candidate on rejection and continue with usable evidence from a valid envelope.

---

## Stage 3 — Field Resolution

**Owner:** Listings module
**Execution:** Deterministic, policy-driven code.

### Responsibilities — In execution order

1. **Collect:** Group validated candidates by property and field.
2. **Remove duplicates:** Collapse identical candidate values without losing their evidence.
3. **Resolve unique values:** Select a field when one distinct valid value is available.
4. **Handle conflicts:** Leave the field unresolved when competing valid values cannot be reconciled under an approved policy.
5. **Account for uncertainty:** Apply the documented policy when unresolved evidence could affect a selected value.
6. **Apply field applicability:** Determine whether a field is required, optional, or inapplicable under the approved property-type policy.
7. **Project area measurements:** Select the appropriate `area_sqm` from available typed area candidates using the approved area policy.
8. **Resolve complete prices:** Compare amount, currency and period together.
9. **Produce resolved fields and structured resolution findings.**

### Example

Validated candidates:

```json
[
  { "field": "bedrooms", "value": 3 },
  { "field": "bedrooms", "value": 4 }
]
```

Result:

```json
{
  "bedrooms": null
}
```

Resolution finding: `bedrooms_conflict`.

### Output

A `ResolvedOffer` contains resolved public fields, field applicability, structured resolution findings, and selected and rejected provenance.

- Resolved public field values.
- Structured conflicts and unresolved-field information.
- Provenance for selected and rejected candidates.
- Field applicability information needed by the reviewer.

### Boundary constraints

- Select from validated typed candidates using the [processing policy](processing-resolution-policy.md). Keep unresolved conflicts null and retain their evidence.
- Deduplication owns stored-property matching. The Runtime Reviewer turns findings into public review reasons.

---

## Stage 4 — Deduplication

**Owner:** Listings module / persistence integration
**Execution** — Deterministic matching against stored records, introduced in Phase 05.

### Responsibilities — In execution order

1. **Retrieve:** Load relevant existing listings from persistence.
2. **Compare:** Compare the incoming resolved listing with possible existing matches.
3. **Evaluate:** Use multiple supported property characteristics under the documented matching policy.
4. **Distinguish:** Separate sufficiently supported duplicates from ambiguous similarities.
5. **Assign:** Set `duplicate_of` when a reliable matching listing exists.
6. **Report:** Preserve ambiguous-match findings where appropriate.
7. **Return:** Pass duplicate information to the reviewer.

### Example

An incoming villa and an existing listing have matching location, area, property characteristics, and other supporting attributes, despite different broker messages.

If the documented matching policy establishes sufficient evidence:

```json
{
  "duplicate_of": "listing-123"
}
```

Otherwise, retain `duplicate_of: null` and report uncertainty if material. The deduplication result carries `duplicate_of: string | null` and structured matching findings.

### Boundary constraints

- Use deterministic, multi-signal matching in the MVP. A district or price match alone provides insufficient evidence.
- Preserve the incoming facts and record uncertain matches for review. Link supported duplicates through `duplicate_of`.

---

## Stage 5 — Runtime Reviewer

**Owner:** Listings review component
**Execution:** Deterministic code, no LLM.

### Responsibilities — In execution order

1. **Collect findings:** Receive semantic findings from Extraction, mechanical failures from Validation, conflicts and applicability from Resolution, and deduplication findings.
2. **Identify missing information:** Determine which applicable public fields remain missing.
3. **Evaluate unresolved issues:** Identify material uncertainty, contradictions, invalid evidence, and matching ambiguity.
4. **Apply review policies:** Distinguish issues requiring human intervention from harmless or inapplicable conditions.
5. **Generate reasons:** Convert findings into stable, understandable review reason codes.
6. **Derive status:** Set `needs_review` based on material review reasons.
7. **Return review decision:** Attach review information to the resolved listing.

### Example

Resolved fields:

```json
{
  "property_type": "villa",
  "bedrooms": 3,
  "area_sqm": 250,
  "price": {
    "amount": null,
    "currency": "SAR",
    "period": null
  }
}
```

Review result for the price finding shown. Other findings depend on the complete resolved listing.

```json
{
  "needs_review": true,
  "review_reasons": ["price_missing"]
}
```

### Output

```ts
{
  needs_review: boolean,
  review_reasons: string[]
}
```

### Boundary constraints

- Derive review status and reasons from resolved fields and material findings. Preserve selected values and source evidence.
- Leave inapplicable fields and mixed classification alone when determining review reasons. Human approval owns the persisted approval transition.

---

## Stage 6 — Result Assembly & Persistence

**Owner:** Messages orchestration + Listings/Database integration

### Responsibilities — In execution order

1. **Assemble:** Combine resolved fields, classification, duplicate results and review decisions.
2. **Assign IDs:** Use application-generated listing identifiers.
3. **Validate final contract:** Ensure every output satisfies the public result schema.
4. **Persist:** Starting in Phase 04, atomically save the message, successful result snapshot, listing rows, and provenance. On a competing same-ID insert, reread the winner and apply the replay or conflict rule.
5. **Preserve state:** Store review and approval state alongside the original source and provenance. Human approval updates the stored state while preserving the ingestion snapshot.
6. **Return result:** Provide the final response to the HTTP or CLI adapter.

For CLI processing, retain the brief's required JSONL-to-stdout behavior; persistence must not create unwanted output or diverging processing logic.

### Public output

```ts
type BaseClassification = 'listing' | 'project' | 'buyer_request' | 'irrelevant';

type MessageSuccess = {
  message_id: string;
  classification: BaseClassification | 'mixed';
  detected_classes: BaseClassification[];
  listings: {
    id: string;
    purpose: 'sale' | 'rent' | null;
    property_type: 'villa' | 'apartment' | 'studio' | 'land' | 'townhouse' | 'other' | null;
    city: string | null;
    district: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    area_sqm: number | null;
    price: {
      amount: number | null;
      currency: 'SAR';
      period: 'total' | 'yearly' | 'monthly' | null;
    };
    contact_phone: string | null;
    needs_review: boolean;
    review_reasons: string[];
    duplicate_of: string | null;
  }[];
};
```

The approved `mixed` classification is an intentional extension to the brief's four-value enum, and is documented in [D-019](DECISIONS.md#d-019-use-typed-extraction-proposals-and-mixed-intent). The existing typed failure envelope is separate from this success contract.

### Boundary constraints

- Preserve the values, classification, and review decisions supplied by prior stages.
- Return the same public result structure through both transports. Human approval updates persisted review state independently.

---

## Cross-cutting — Quality Evaluation

**Owner:** Test and evaluation infrastructure
**Execution:** Outside the production message pipeline.

### Responsibilities

1. Maintain independently written test messages and expected results.
2. Test classification, segmentation, normalized values, evidence, and findings.
3. Test intentionally malformed or invented LLM output with gateway mocks.
4. Verify partial-candidate recovery and whole-envelope failures.
5. Test field resolution, deduplication, runtime review and public output behavior.
6. Measure unsupported values accepted, supported values missed, and incorrect review decisions.
7. Compare extraction prompt and schema revisions using the same evaluation cases.
8. Track token usage, latency, and estimated cost separately during live model evaluation.

The automated test suite must run offline without an API key.

Phase 02 verifies application behavior with offline gateway mocks. Phase 03 integrates and qualifies Antigravity through the CLI and uses an independent evaluator to measure real model behavior. Phase 04 verifies SQLite and HTTP integration with offline fixtures. Quality evaluation stays outside runtime.

---

## Responsibility boundaries — Summary

| Responsibility | Owner |
|---|---|
| Input validation | Messages |
| Classification, segmentation, and association | LLM |
| Language interpretation | LLM |
| Normalized candidate generation | LLM |
| Evidence-to-value semantic self-check | LLM |
| Semantic conflict and uncertainty identification | LLM |
| Verbatim and schema validation | Mechanical Validator |
| Reliably verifiable numerical consistency | Mechanical Validator |
| Field selection and conflict handling | Resolver |
| Field applicability and area projection | Resolver |
| Existing-property matching | Deduplicator |
| Missing/uncertain information review | Runtime Reviewer |
| Final response and storage | Assembly/Persistence |
| Accuracy measurement | Quality Evaluator |

## Implementation checkpoints

Use the [Phase 02 tracker](phase-plans/02-message-processing.md) to assign each task to an existing module and verify stages independently before integration. Define typed interfaces at each stage boundary and preserve accepted and rejected evidence. The [policy reference](processing-resolution-policy.md) owns business rules. The [original assessment plan](../PLAN.md) preserves the pre-implementation record.
