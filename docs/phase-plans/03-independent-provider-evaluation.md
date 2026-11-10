# Dwelleo — Phase 03: Independent LLM Evaluation

**Status:** Accepted plan — implementation pending
**Target provider:** Antigravity CLI through the existing `agy` gateway
**Scope:** Evaluation, measurement, and reporting
**Prerequisite:** Phase 02 completed

## 1. Goal

Evaluate how accurately and efficiently Dwelleo processes realistic Saudi real-estate messages using a live LLM.

The evaluation must measure:

- Classification accuracy.
- Property-offer separation and association.
- Extracted field accuracy.
- Unsupported values incorrectly accepted.
- Supported values incorrectly omitted.
- Human-review accuracy.
- Per-message latency, token usage, and estimated cost.

Evaluate the **final public CLI output**, not just the raw LLM extraction.

Keep evaluation outside the production processing pipeline.

### Boundaries

Phase 03 does not implement SQLite persistence, HTTP endpoints, approval workflows, or deduplication. These remain assigned to later phases.

The existing offline tests remain separate from live model evaluation.

## 2. Task 03.1 — Prepare the evaluation dataset

Create approximately **20 independently authored messages** that were not used to design the extraction prompt or implementation.

Suggested distribution:

| Language | Cases |
|---|---:|
| Arabic | 8 |
| English | 6 |
| Mixed Arabic/English | 6 |
| **Total** | **20** |

Distribute the following scenarios across the dataset:

- Sale and rental listings.
- Multiple offers in one message.
- Shared and offer-specific information.
- Buyer requests.
- Project announcements.
- Irrelevant messages.
- Mixed substantive intents.
- Arabic-Indic digits and written numbers.
- Price abbreviations and rental periods.
- Missing, ambiguous, and conflicting information.
- Unsupported asking prices, deposits, and per-square-metre rates.

### Expected labels

For each message, define the expected classification, source-ordered detected classes, number of property offers, normalized public fields, and review expectations.

Label messages independently **before running the provider**.

Follow the approved brief and D-020 processing policies. Do not invent expected values when evidence is insufficient.

Record source-language location names according to the established normalization policy.

Keep the evaluation dataset separate from Phase 02 smoke-test fixtures.

### Deliverables

```text
test/evaluation/
├── cases.jsonl
└── expected.json
```

Freeze both files before the baseline run.

Record the dataset version and Git commit in the evaluation report.

### Verification

- All inputs pass the raw-message schema.
- Expected labels follow the public output contract.
- Each expected listing is traceable to its source message.
- Missing and inapplicable fields are distinguished.
- Ambiguous expected values are resolved through documented policy or excluded from aggregate field scoring.

**Implementation evidence — 2026-11-10:** Created and frozen `test/evaluation/cases.jsonl` (20 independently authored messages: 8 Arabic, 6 English, 6 Mixed) and `test/evaluation/expected.json` (version 1.0.0 with full public contracts, field-level traceability, inapplicable field tracking, and review reasons). Verified with 11 automated checks in `test/evaluation-dataset.spec.ts` covering raw message schema validation, classification constraints, public output schema, quote traceability in source text, and inapplicable field policies.

## 3. Task 03.2 — Implement a lightweight offline evaluator

Create a standalone evaluation script that:

1. Reads the frozen input and expected labels.
2. Invokes the existing built CLI.
3. Captures its JSONL results.
4. Matches results by `message_id`.
5. Compares actual output against expected labels.
6. Reports aggregate metrics and individual mismatches.

The evaluator must not modify the application processor.

### Offer matching

Match offers using source order and expected property characteristics where association is unambiguous.

Do not use generated listing UUIDs as matching keys.

Report extra, missing, and incorrectly associated offers rather than silently choosing whichever matching produces a better score.

### Metrics

| Metric | Measurement |
|---|---|
| Classification accuracy | Correct message classifications / scored messages |
| Detected-class accuracy | Correct source-ordered intent arrays / scored messages |
| Offer-count accuracy | Messages with correct offer counts / scored messages |
| Field accuracy | Correct applicable field values / scored field comparisons |
| Unsupported-value acceptance | Unsupported values incorrectly populated / opportunities where those values should be absent |
| Supported-value omission | Supported values incorrectly left null / expected supported values |
| Review precision | Correctly flagged listings / all flagged listings |
| Review recall | Correctly flagged listings / all listings requiring review |

Compare prices using the public `amount`, `currency`, and `period` fields.

Score incorrectly published deposits or per-square-metre rates as asking-price errors. The internal `price.role` is not part of the public contract.

Distinguish missing fields from genuinely inapplicable fields.

Report absolute counts alongside percentages. Keep provider failures separate from successful outputs and disclose which cases they exclude from accuracy denominators.

Avoid a blended quality score.

### Deliverable

A small evaluation script, for example:

```text
scripts/evaluate.ts
```

It may generate:

```text
evaluation-results/
├── actual.jsonl
└── summary.json
```

No database, dashboard, additional LLM evaluator, or testing framework is required.

### Verification

Run offline tests against fabricated CLI output covering correct results, missing/extra offers, null versus invented values, review flags, malformed output, and provider failures.

The evaluator must run its scoring tests without an API key.

**Implementation evidence — 2026-11-10:** Implemented standalone offline evaluator in `scripts/evaluate.ts` supporting direct CLI execution and pre-computed JSONL evaluation, outputting `actual.jsonl` and `summary.json`. Implemented all 8 required metrics with explicit denominators, distinct inapplicable field scoring, order-sensitive offer matching, unsupported-value acceptance tracking, and review precision/recall. Verified with 7 dedicated offline tests in `test/evaluator.spec.ts` covering 100% agreement, extra/missing offers, unsupported value acceptance on per-sqm price, supported value omission, review false positives/negatives, malformed lines, provider failures with denominator exclusion, and file-based execution without an API key.

## 4. Task 03.3 — Capture token usage and latency

Add minimal instrumentation around the existing model-processing path.

### Capture

- Provider and model identifier.
- Per-message elapsed processing time.
- Input tokens when available.
- Output tokens when available.
- Total tokens when available.
- Provider errors and timeouts.

Reuse usage information exposed by the Vercel AI SDK.

Do not introduce a second LLM call or change the public listing schema.

### Cost reporting

Estimate cost from:

- Actual recorded token usage.
- The applicable provider pricing.
- The model used during evaluation.

Document the pricing source and snapshot date.

If the SDK or provider does not expose sufficient usage information, report the missing measurement rather than inventing a token count or cost.

Document whether cached or reasoning tokens are included in the reported usage.

### Latency definition

Prefer **per-message processing latency**, measured from the start of message processing to completion or failure.

This should exclude one-time CLI startup where possible.

Record any limitation in the measurement method.

### Verification

Confirm that instrumentation:

- Does not change public JSONL results.
- Does not contaminate stdout.
- Captures failed calls.
- Handles missing token metadata safely.
- Adds negligible processing overhead.

**Implementation evidence — 2026-11-10:** Both the `agy` gateway and the AI SDK gateway emit opt-in `DWELLEO_TELEMETRY` records on stderr with message ID, configured provider/model, gateway request duration, input/output/total tokens when available, and typed provider failure codes. In `AgyGateway`, token usage and request duration are captured directly from `agy`'s JSON output envelope (`usage` and `duration_seconds`). The evaluator enables telemetry for its CLI subprocess and writes parsed events to `evaluation-results/telemetry.jsonl`; public JSONL is unchanged. Duration measures the single provider request per message, excluding CLI startup and post-extraction resolution/review. Offline tests verify telemetry parsing, usage, missing usage, failures and public result preservation. No live evaluation was run for this task.

## 5. Task 03.4 — Run the baseline evaluation

Execute the complete frozen dataset once through the configured `agy` provider.

Target approximately **20 live extraction calls**, one per message.

Save:

- Raw CLI JSONL results.
- Aggregated metrics.
- Individual mismatches.
- Per-message usage and latency.
- Provider and model configuration.
- Run date and relevant commit identifier.

Do not modify expected labels to make the baseline appear better.

### Error analysis

For significant failures, identify the responsible stage:

- LLM extraction.
- Mechanical validation.
- Field resolution.
- Runtime review.
- Provider failure.

Prioritize:

1. Incorrect or invented asking prices.
2. Wrong-property associations.
3. Unsupported values accepted.
4. Missed human-review requirements.
5. Incorrect classifications or missing offers.

Record observed limitations separately from proposed improvements.

**Baseline evaluation evidence — 2026-11-10 (Task 03.4):**

- **Configuration:** Provider `agy` (CLI `1.5.3`), model `gemini-3.8-flash-low`, dataset `test/evaluation/cases.jsonl` (v1.0.0, 20 cases), baseline commit `eebb2ef32c4a91358797f68e552f724572823d29` + `AgyGateway` telemetry/response extraction updates, executed at `2026-11-10T04:32:27Z`.
- **Full analysis & saved artifacts:** See the complete [Phase 03 Baseline Evaluation Analysis](../evaluation-baseline-analysis.md) and saved artifacts in `evaluation-results/baseline/{actual.jsonl, telemetry.jsonl, summary.json, metadata.json}`.
- **Baseline metrics (20/20 scored, 0 provider failures, 0 malformed lines):**
  - Classification accuracy: **20/20 (100.0%)**
  - Detected-class accuracy: **20/20 (100.0%)**
  - Offer-count accuracy: **20/20 (100.0%)** (`16/16` matched offers, 0 extra, 0 missing)
  - Field accuracy (applicable): **137/171 (80.1%)**
    - 100%: `purpose` (16/16), `property_type` (16/16), `city` (16/16), `district` (16/16), `bedrooms` (13/13), `bathrooms` (14/14), `price.currency` (16/16)
    - Partial: `contact_phone` (14/16, 87.5%), `area_sqm` (8/16, 50.0%), `price.amount` (4/16, 25.0%), `price.period` (4/16, 25.0%)
  - Unsupported-value acceptance: **0/26 (0.0%)**
  - Supported-value omission: **34/150 (22.7%)**
  - Review precision: **12/16 (75.0%)** (TP=12, FP=4, FN=0, TN=0)
  - Review recall: **12/12 (100.0%)**
- **Telemetry (20 calls):**
  - Per-message gateway request duration: mean **10,758.51 ms**, median **11,637.33 ms**, min **2,768.57 ms**, max **26,817.27 ms** (total 215.17 s).
  - Input tokens: total **591,931**, mean **29,596.5**, median **31,825**, min **10,008**, max **74,682** (note: `agy` wraps an agentic CLI prompt/system loop, elevating token volume compared to raw REST calls).
  - Output tokens: total **17,510**, mean **875.5**, median **1,058**, min **25**, max **2,309**.
- **Error analysis (by stage and priority):**
  1. *Incorrect or invented asking prices / Unsupported values accepted:* **0 occurrences** (0/26). Per-sqm rates (`eval-004`) and unknown currencies (`eval-011`) were never published.
  2. *Wrong-property associations:* **0 occurrences**. Multi-offer separation (`eval-003`, `eval-016`) associated shared vs local attributes cleanly.
  3. *Supported-value omissions & review false positives (`price_unsupported` in 12/16 listings, `area_sqm_unsupported` in 8/16 listings):* **Responsible stages: LLM extraction (`agy`) + Mechanical validation (Stage 2).** Unlike direct Gemini REST `responseJsonSchema` decoding, `agy` does not enforce grammar-constrained JSON output during token sampling. Guided by the wording in `domain-prompt.ts` (`"price: Object containing amount, currency, period, and role"`), `gemini-3.8-flash-low` nested `role` inside `price.value` or duplicated `amount`/`currency`/`period` at top level, and similarly misplaced `kind` on `area_sqm`. `z.strictObject(...)` in Stage 2 strictly rejected these candidates (`invalid_numeric_constraint` / `invalid_schema`), turning valid extracted values into `null` with `price_unsupported`/`area_sqm_unsupported` flags.
  4. *Contact phone omissions (`eval-015`, `eval-018`):* **Responsible stage: LLM extraction.** The model flagged synthetic `052...` prefixes as uncertain (`contact_phone_uncertain`), causing Stage 3 resolution to clear them.
  5. *Purpose missing vs uncertain (`eval-020`):* **Responsible stage: LLM extraction.** The model emitted an explicit `uncertainty` finding rather than omitting the field, producing `purpose_uncertain` instead of `purpose_missing`.
- **Observed limitations vs proposed improvements:**
  - *Observed limitations:* Agentic `agy` CLI incurs ~30k input tokens/call and ~10.8 s/call even with `cwd: os.tmpdir()` and lacks native token-level schema grammar enforcement, leading to candidate key placement errors on `price` and `area_sqm`.
  - *Proposed improvement candidate (for Task 03.5 review):* Align `domain-prompt.ts` wording and schema examples explicitly with `stage1GatewayWireSchema` (clarifying `role` and `kind` sit as siblings of `value`, not inside `value`).

## 6. Task 03.5 — Apply targeted improvements only if justified

This task is optional.

If the baseline identifies a consequential problem:

1. Diagnose the actual cause.
2. Document the proposed change.
3. Make the smallest reasonable correction.
4. Run focused offline regression tests.
5. Test the affected live cases.
6. Run one complete final comparison against the same frozen dataset if changes are accepted.

Keep the baseline results unchanged for comparison.

Do not repeatedly tune the prompt against individual evaluation cases.

If no significant changes are justified, skip implementation and document that decision.

### Live-call budget

| Activity | Planned calls |
|---|---:|
| Initial baseline | 20 |
| Targeted checks after changes | 3–5 |
| Final full comparison, if changes occur | 20 |
| **Typical total** | **20–45** |

This is a planning estimate, not a guaranteed cost or hard technical limit.

**Implementation evidence — 2026-11-10 (Task 03.5):** Updated `src/extraction/domain-prompt.ts` (lines 13–14 and line 24) to clarify that `kind` (`area_sqm`) and `role` (`price`) sit as candidate top-level siblings of `value` and that extra keys are disallowed on `price.value`. Verified offline tests (20/20 suites, 228/228 tests), typecheck, and build. Spot-checked `eval-001`, `eval-009`, and `eval-011` live (all 3 passed on turn 1 in ~4.3–4.7s and ~10.1k input tokens). Ran full 20-case comparison into `evaluation-results/post-fix/` (preserving `evaluation-results/baseline/` unchanged): field accuracy improved from `137/171 (80.1%)` to **`169/171 (98.8%)`**, supported omission fell from `34/150 (22.7%)` to **`2/150 (1.3%)`**, review precision improved from `12/16 (75.0%)` to **`12/13 (92.3%)`**, `area_sqm` and `price.amount`/`price.period` each reached `16/16 (100.0%)`, mean latency dropped from `10.76s` to **`6.80s`**, and total input tokens dropped by `44.2%` (`591,931` → `330,563`). See [Baseline Evaluation Analysis — Section 9](../evaluation-baseline-analysis.md#9-task-035-post-fix-comparison).

## 7. Task 03.6 — Document and close Phase 03

Add a concise evaluation section to the README.

Include:

- Evaluation dataset size and coverage.
- Provider and model.
- Actual classification, offer, field, and review metrics.
- Counts and denominators.
- Observed error examples.
- Representative per-message latency.
- Input/output token usage.
- Estimated per-message cost, if measurable.
- Pricing assumptions and limitations.
- Any changes made after the baseline.

Record the actual commands and test results.

Update the active roadmap and relevant success-criteria evidence.

Preserve original `PLAN.md` unchanged.

Do not claim that results on 20 synthetic examples establish production-level accuracy or hidden-test performance.

## 8. Phase completion criteria

Phase 03 is complete when:

- [x] An independent, frozen evaluation dataset exists.
- [x] Expected labels have been reviewed against the approved processing policies.
- [x] A standalone deterministic evaluator has passing offline tests.
- [x] One complete live agy evaluation has run.
- [x] Classification, offer, field, and review metrics are reported with denominators.
- [x] Unsupported-value acceptance and supported-value omission are reported.
- [x] Latency and token usage are measured, or their limitations are explicitly documented.
- [ ] Cost estimates use attributable provider usage and documented pricing assumptions.
- [x] Significant failures have been investigated.
- [ ] README and roadmap include dated evaluation evidence.
- [ ] Relevant offline tests, typecheck, and build pass.

**Phase 03 may be completed even if the evaluation identifies remaining model-quality limitations, provided those limitations are documented accurately.**

## 9. Explicit exclusions

Do not build:

- An evaluation dashboard.
- A database-backed evaluation system.
- An LLM-based judge.
- Multiple provider comparison infrastructure.
- Automated prompt optimization.
- A statistical benchmarking framework.
- Another extraction or normalization pipeline.

**Core principle: Measure Dwelleo's real extraction quality with a small, reproducible evaluation—not a large evaluation platform.**
