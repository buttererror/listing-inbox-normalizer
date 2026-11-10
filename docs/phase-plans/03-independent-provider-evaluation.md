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

## Prerequisite — Verify agy isolation (OPEN-08)

The current gateway invokes `agy` with `--dangerously-skip-permissions`; a tool-free mode has not been verified. Before any evaluation case is sent through `agy`, establish and verify an isolation boundary. Test that attempted unintended file access and command execution are blocked while the provider connection remains usable. Record the setup, commands, results, limitations, CLI version and model under [OPEN-08](../DECISIONS.md#open-policy-checkpoints). Do not run evaluation cases until this gate passes. A sandbox flag alone is not evidence of effective isolation.

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

## 4. Task 03.3 — Capture token usage and latency

Add minimal instrumentation around the existing model-processing path.

### Capture

- Provider and model identifier.
- Per-message elapsed processing time.
- Input tokens when available.
- Output tokens when available.
- Total tokens when available.
- Provider errors and timeouts.

Capture usage information from the `agy` JSON envelope when present. Record the actual `agy` model and CLI version for each run.

Do not introduce a second LLM call or change the public listing schema.

### Cost reporting

Estimate cost from:

- Actual recorded token usage.
- The applicable provider pricing.
- The model used during evaluation.

Document the pricing source and snapshot date.

If `agy` does not expose sufficient usage information, report the missing measurement rather than inventing a token count or cost.

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

- [ ] The agy isolation prerequisite has passed and evidence is recorded under OPEN-08.
- [ ] An independent, frozen evaluation dataset exists.
- [ ] Expected labels have been reviewed against the approved processing policies.
- [ ] A standalone deterministic evaluator has passing offline tests.
- [ ] One complete live `agy` evaluation has run.
- [ ] Classification, offer, field, and review metrics are reported with denominators.
- [ ] Unsupported-value acceptance and supported-value omission are reported.
- [ ] Latency and token usage are measured, or their limitations are explicitly documented.
- [ ] Cost estimates use attributable provider usage and documented pricing assumptions.
- [ ] Significant failures have been investigated.
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
