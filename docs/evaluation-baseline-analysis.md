# Dwelleo — Phase 03 Baseline Evaluation Analysis

**Run date:** `2026-11-10T04:32:27.003Z`  
**Dataset:** [`test/evaluation/cases.jsonl`](../test/evaluation/cases.jsonl) / [`test/evaluation/expected.json`](../test/evaluation/expected.json) (`v1.0.0`, 20 cases)  
**Provider & CLI:** `agy` CLI `1.5.3`  
**Model:** `gemini-3.8-flash-low`  
**Baseline commit:** `eebb2ef32c4a91358797f68e552f724572823d29` (plus Task 03.3 `AgyGateway` telemetry and response-extraction stabilization)  
**Saved artifacts:** [`evaluation-results/baseline/`](../evaluation-results/baseline/summary.json) (`actual.jsonl`, `telemetry.jsonl`, `summary.json`, `metadata.json`)

---

## 1. Executive Summary

All 20 independently authored Saudi real-estate messages executed through the built CLI (`node dist/cli.js process test/evaluation/cases.jsonl`) with **0 provider failures**, **0 timeouts**, and **0 malformed outputs**.

- **Message-level triage and offer segmentation were 100% accurate:** Classification (`20/20`), source-ordered `detected_classes` (`20/20`), and offer count (`20/20`, `16/16` matched offers with `0` extra and `0` missing) scored `100.0%`.
- **Zero hallucinations / zero missed reviews:** Unsupported-value acceptance was `0/26 (0.0%)` (no deposits, per-sqm rates, or unknown-currency rents were published as asking prices), and human-review recall was `12/12 (100.0%)`.
- **Primary baseline defect (`80.1%` applicable field accuracy, `22.7%` supported-value omission):** Stage 2 mechanical validation rejected `12/12` valid asking prices (plus `3/3` non-conflict invalid prices) as `price_unsupported` and `8/12` valid area measurements as `area_sqm_unsupported`. Diagnostic inspection proved the model extracted the correct numeric values, but because `agy` does not apply token-level grammar constraint against `--json-schema`, the model followed prose in [`domain-prompt.ts`](../src/extraction/domain-prompt.ts) (`"price: Object containing amount, currency, period, and role"`) and placed `role`/`kind` inside `value` or duplicated keys, failing `z.strictObject` in [`stage2-mechanical-validation.ts`](../src/extraction/stage2-mechanical-validation.ts).

> **Scope disclaimer:** Results on 20 synthetic cases characterize this frozen evaluation baseline only and do not establish production-level accuracy or hidden-test performance.

---

## 2. Dataset Composition

| Dimension | Breakdown |
|---|---|
| **Total messages** | 20 (`eval-001` through `eval-020`) |
| **Language split** | 8 Arabic (`eval-001`–`008`), 6 English (`eval-009`–`014`), 6 Mixed (`eval-015`–`020`) |
| **Classifications** | `listing` (11), `mixed` (3), `buyer_request` (2), `project` (2), `irrelevant` (2) |
| **Expected offers** | 16 total offers across 14 messages (12 single-offer, 2 multi-offer; 6 zero-offer messages) |
| **Clean vs. Review listings** | 4 expected clean (`needs_review: false`), 12 expected review (`needs_review: true`) |

---

## 3. Aggregate Baseline Metrics

Measured against `20/20` scored cases (0 excluded from denominators):

| Metric | Score | Percentage | Notes |
|---|---:|---:|---|
| **Classification accuracy** | `20 / 20` | `100.0%` | All 5 classes (`listing`, `project`, `buyer_request`, `irrelevant`, `mixed`) exact |
| **Detected-class accuracy** | `20 / 20` | `100.0%` | Source-ordered intent arrays exact |
| **Offer-count accuracy** | `20 / 20` | `100.0%` | `16` expected, `16` actual, `16` matched, `0` extra, `0` missing |
| **Field accuracy (applicable)** | `137 / 171` | `80.1%` | Inapplicable fields (`bedrooms`/`bathrooms` on land; `bedrooms` on studio) excluded |
| **Unsupported-value acceptance** | `0 / 26` | `0.0%` | Zero unsupported values populated across all expected-null opportunities |
| **Supported-value omission** | `34 / 150` | `22.7%` | `12` price amounts, `12` price periods, `8` areas, `2` phones |
| **Review precision** | `12 / 16` | `75.0%` | `TP=12`, `FP=4`, `FN=0`, `TN=0` (4 clean listings flagged due to Stage 2 rejections) |
| **Review recall** | `12 / 12` | `100.0%` | Every listing requiring human review was flagged |

---

## 4. Field-by-Field Accuracy

| Field | Correct / Applicable | Accuracy | Unsupported Accepted | Supported Omitted | Notes |
|---|---:|---:|---:|---:|---|
| `purpose` | `16 / 16` | `100.0%` | `0` | `0` | Includes `null` preserved on `eval-020` |
| `property_type` | `16 / 16` | `100.0%` | `0` | `0` | `villa`, `apartment`, `studio`, `land`, `townhouse` |
| `city` | `16 / 16` | `100.0%` | `0` | `0` | Source-language preserved (Arabic & English) |
| `district` | `16 / 16` | `100.0%` | `0` | `0` | Labels (`حي`, `district`) cleanly stripped |
| `bedrooms` | `13 / 13` | `100.0%` | `0` | `0` | Conflict cleared on `eval-008`; 3 inapplicable excluded (`eval-004`, `009`, `018`) |
| `bathrooms` | `14 / 14` | `100.0%` | `0` | `0` | 2 inapplicable excluded (`eval-004`, `018`) |
| `price.currency` | `16 / 16` | `100.0%` | `0` | `0` | Public contract fixed to `'SAR'` |
| `contact_phone` | `14 / 16` | `87.5%` | `0` | `2` | Synthetic `052...` flagged uncertain on `eval-015` and `eval-018` |
| `area_sqm` | `8 / 16` | `50.0%` | `0` | `8` | `4/4` missing matched; `4/12` present passed; `8/12` rejected as `area_sqm_unsupported` |
| `price.amount` | `4 / 16` | `25.0%` | `0` | `12` | `4/4` expected-null matched (`004`, `011`, `018`, `019`); `0/12` valid asking prices survived Stage 2 |
| `price.period` | `4 / 16` | `25.0%` | `0` | `12` | Same `12` listings rejected by Stage 2 (`price_unsupported`) |

---

## 5. Complete Case-by-Case Outcomes & Mismatches

Out of 20 cases, **6 non-listing cases matched 100%** (`eval-005`, `006`, `007`, `012`, `013`, `014`) and **14 listing/mixed cases accounted for all 50 logged mismatch items**:

| Case | Lang | Class / Offers | Expected Review | Actual Review | Omitted / Mismatched Fields & Cause |
|---|---|---|---|---|---|
| `eval-001` | AR | `listing` (1/1) | `false` `[]` | `true` `["area_sqm_unsupported", "price_unsupported"]` | `area_sqm` (450), `price.amount` (3.2M), `price.period` (`total`) rejected by Stage 2 (`FP` review) |
| `eval-002` | AR | `listing` (1/1) | `true` `["district_missing", "area_sqm_missing"]` | `true` `["district_missing", "area_sqm_missing", "price_unsupported"]` | `price.amount` (36k), `price.period` (`yearly`) rejected by Stage 2 |
| `eval-003` | AR | `listing` (2/2) | Offer 0: `bedrooms_missing`, `bathrooms_missing`<br>Offer 1: `bathrooms_missing`, `area_sqm_missing` | Added `price_unsupported` on both offers | Offer 0 `area_sqm` (350) succeeded; both offers' prices (2.4M, 30k/yr) rejected by Stage 2 |
| `eval-004` | AR | `listing` (1/1) | `true` `["price_missing"]` | `true` `["price_unsupported"]` | `area_sqm` (600) succeeded; per-sqm price candidate rejected by Stage 2 instead of Stage 3 `price_missing` |
| `eval-005` | AR | `buyer_request` (0/0) | — | — | Exact match |
| `eval-006` | AR | `project` (0/0) | — | — | Exact match |
| `eval-007` | AR | `irrelevant` (0/0) | — | — | Exact match |
| `eval-008` | AR | `mixed` (1/1) | `true` `["bedrooms_conflict", "bathrooms_missing", "area_sqm_missing"]` | Added `price_unsupported` | `bedrooms_conflict` matched; `price` (1.8M) rejected by Stage 2 |
| `eval-009` | EN | `listing` (1/1) | `false` `[]` | `true` `["area_sqm_unsupported", "price_unsupported"]` | `area_sqm` (55), `price` (3500 `monthly`) rejected by Stage 2 (`FP` review) |
| `eval-010` | EN | `listing` (1/1) | `true` `["contact_phone_missing"]` | Added `area_sqm_unsupported`, `price_unsupported` | `area_sqm` (420), `price` (2.8M) rejected by Stage 2 |
| `eval-011` | EN | `listing` (1/1) | `true` `["price_currency_unknown"]` | `true` `["area_sqm_unsupported", "price_unsupported"]` | `area_sqm` (175) & non-SAR `price` candidate rejected by Stage 2 |
| `eval-012` | EN | `buyer_request` (0/0) | — | — | Exact match |
| `eval-013` | EN | `project` (0/0) | — | — | Exact match |
| `eval-014` | EN | `irrelevant` (0/0) | — | — | Exact match |
| `eval-015` | MIX | `listing` (1/1) | `false` `[]` | `true` `["area_sqm_unsupported", "price_unsupported", "contact_phone_uncertain"]` | `area_sqm` (185) & `price` (920k) rejected by Stage 2; `0521234567` flagged uncertain (`FP` review) |
| `eval-016` | MIX | `listing` (2/2) | Offer 0: `bathrooms_missing`<br>Offer 1: `area_sqm_missing` | Offer 0: `+area_sqm_unsupported, price_unsupported`<br>Offer 1: `+price_unsupported` | Shared city (`Al Khobar`/`الخبر`) & contact succeeded; Offer 0 area (320) & both prices rejected by Stage 2 |
| `eval-017` | MIX | `mixed` (1/1) | `false` `[]` | `true` `["area_sqm_unsupported", "price_unsupported"]` | `area_sqm` (400), `price` (3.1M) rejected by Stage 2 (`FP` review) |
| `eval-018` | MIX | `mixed` (1/1) | `true` `["price_conflict"]` | `true` `["price_conflict", "contact_phone_uncertain"]` | `area_sqm` (400) & `price_conflict` succeeded; `0524567890` flagged uncertain |
| `eval-019` | MIX | `listing` (1/1) | `true` `["price_period_unknown"]` | `true` `["price_unsupported"]` | `area_sqm` (120) succeeded; unestablished period `price` rejected by Stage 2 |
| `eval-020` | MIX | `listing` (1/1) | `true` `["purpose_missing"]` | `true` `["purpose_uncertain", "area_sqm_unsupported", "price_unsupported"]` | `area_sqm` (350) & `price` (2.2M) rejected by Stage 2; missing purpose emitted as `uncertainty` finding |

---

## 6. Telemetry, Latency, Token Usage & Cost Disclosure

### Aggregate Telemetry (20 Live Calls)

| Metric | Total | Mean | Median | Min | Max |
|---|---:|---:|---:|---:|---:|
| **Gateway Request Duration** | `215,170 ms` (`215.2 s`) | `10,758.5 ms` | `11,637.3 ms` | `2,768.6 ms` (`eval-006`) | `26,817.3 ms` (`eval-010`) |
| **Input Tokens** | `591,931` | `29,596.5` | `31,825` | `10,008` | `74,682` |
| **Output Tokens** | `17,510` | `875.5` | `1,058` | `25` | `2,309` |
| **Total Tokens** | `609,441` | `30,472.0` | `32,688.5` | `10,033` | `76,991` |

### Per-Message Telemetry Log

| Message ID | Class | Duration (ms) | Input Tokens | Output Tokens | Total Tokens |
|---|---|---:|---:|---:|---:|
| `eval-001` | `listing` | `14,953.25` | `32,075` | `1,068` | `33,143` |
| `eval-002` | `listing` | `11,213.61` | `31,722` | `866` | `32,588` |
| `eval-003` | `listing` | `14,462.79` | `32,873` | `1,532` | `34,405` |
| `eval-004` | `listing` | `10,804.97` | `31,806` | `741` | `32,547` |
| `eval-005` | `buyer_request` | `6,408.05` | `20,091` | `71` | `20,162` |
| `eval-006` | `project` | `2,768.57` | `10,008` | `25` | `10,033` |
| `eval-007` | `irrelevant` | `4,167.92` | `20,115` | `67` | `20,182` |
| `eval-008` | `mixed` | `12,867.75` | `25,587` | `1,082` | `26,669` |
| `eval-009` | `listing` | `10,329.55` | `31,844` | `945` | `32,789` |
| `eval-010` | `listing` | `26,817.27` | `74,682` | `2,309` | `76,991` |
| `eval-011` | `listing` | `12,774.30` | `32,410` | `1,263` | `33,673` |
| `eval-012` | `buyer_request` | `4,719.01` | `20,081` | `71` | `20,152` |
| `eval-013` | `project` | `3,905.69` | `20,143` | `63` | `20,206` |
| `eval-014` | `irrelevant` | `4,308.56` | `20,065` | `67` | `20,132` |
| `eval-015` | `listing` | `12,351.84` | `32,248` | `1,198` | `33,446` |
| `eval-016` | `listing` | `13,359.08` | `32,898` | `1,410` | `34,308` |
| `eval-017` | `mixed` | `11,527.68` | `26,313` | `1,048` | `27,361` |
| `eval-018` | `mixed` | `12,559.03` | `32,627` | `1,372` | `33,999` |
| `eval-019` | `listing` | `13,124.33` | `32,197` | `1,161` | `33,358` |
| `eval-020` | `listing` | `11,746.98` | `32,146` | `1,151` | `33,297` |

### Measurement Scope, Token Accounting & Cost Limitations

- **Latency boundary:** Recorded `duration_ms` reflects `duration_seconds` from `agy`'s JSON envelope per extraction call. It covers the CLI agent request roundtrip (including internal `agy` retries on schema validation) and excludes NestJS CLI startup (~1s one-time) and downstream Stage 2–6 deterministic processing (<1ms).
- **Token composition:** `agy` injects its internal agent system instructions and schema validation retry turns into each conversation (`~10k–32k` input tokens per call; `74.6k` on `eval-010` due to multiple retry turns). `agy`'s reported `output_tokens` includes reasoning/thinking tokens when emitted, and `input_tokens` includes any `cache_read_tokens` and agent prompt overhead.
- **Cost estimation:** **Unavailable / intentionally omitted.** `agy` (`1.5.3`) authenticates via Antigravity OAuth quota rather than pay-as-you-go API billing, and `gemini-3.8-flash-low` has no published public USD per-token API rate card snapshot. Per Task 03.3 policy, USD cost is reported as unavailable rather than invented.

---

## 7. Stage-by-Stage Root-Cause Error Analysis

Prioritized according to the Phase 03 error-analysis order:

1. **Incorrect or invented asking prices (`0 occurrences`):** `0/26` unsupported acceptance. Per-sqm rates (`eval-004`) and unknown currencies (`eval-011`) were never mistakenly published.
2. **Wrong-property associations (`0 occurrences`):** Both multi-offer cases (`eval-003`, `eval-016`) accurately split offers in source order and bound shared city/phone attributes cleanly.
3. **Unsupported values accepted (`0 occurrences`):** Zero fabricated values passed through extraction or resolution.
4. **Missed human-review requirements (`0 occurrences`):** `100.0%` recall (`12/12`).
5. **Incorrect classifications or missing offers (`0 occurrences`):** `100.0%` classification, detected-class, and offer-count accuracy.

### Root Cause 1 (Major — 20 of 22 Field Omissions): `price_unsupported` & `area_sqm_unsupported`
- **Responsible stages:** **LLM Extraction (`agy`) + Mechanical Validation (Stage 2)**.
- **Direct diagnostic evidence (`eval-009`):** Running `eval-009` directly through `AgyGateway` and inspecting `validateStage2` rejected candidates confirmed that the model extracted the exact right semantic fields (`amount: 3500, currency: "SAR", period: "monthly", role: "asking_price"`), but produced:
  ```json
  {
    "field": "price",
    "amount": 3500,
    "currency": "SAR",
    "period": "monthly",
    "role": "asking_price",
    "quote": "Monthly rent: 3,500 SAR",
    "scope": "local",
    "value": {
      "amount": 3500,
      "currency": "SAR",
      "period": "monthly",
      "role": "asking_price"
    }
  }
  ```
- **Stage 2 rejection:**
  ```text
  reason: "invalid_numeric_constraint"
  message: "Unrecognized key: \"role\"; Unrecognized keys: \"amount\", \"currency\", \"period\""
  ```
- **Mechanism:** Unlike direct Gemini REST calls (`responseJsonSchema`) which enforce JSON structure via grammar-constrained token decoding, `agy`'s `--json-schema` operates as an outer validation prompt wrapper. In [`src/extraction/domain-prompt.ts`](../src/extraction/domain-prompt.ts), line 14 reads:
  `- price: Object containing amount, currency, period, and role:`  
  Line 27 reads:  
  `price amount 950000 currency SAR period total role asking_price`  
  Following that prose phrasing without token-level grammar constraints, `gemini-3.8-flash-low` nested `"role"` inside `value` (and/or duplicated `amount`/`currency`/`period` at the top level) and similarly misplaced `"kind"` on `area_sqm`. Because [`stage1GatewayWireSchema`](../src/extraction/extraction-result.schema.ts) defines every candidate and `price.value` with `z.strictObject(...)`, Stage 2 rejected those valid values (`12/12` valid prices, `3/3` non-conflict invalid prices, and `8/12` valid areas), causing Stage 3 resolution to omit them and flag `price_unsupported` / `area_sqm_unsupported`. (Note: `eval-018` succeeded on `price_conflict` because one run produced clean `price` candidates without extra keys.)

### Root Cause 2 (Minor — 2 Field Omissions): `contact_phone_uncertain` (`eval-015`, `eval-018`)
- **Responsible stage:** **LLM Extraction**.
- **Mechanism:** In `eval-015` (`0521234567`) and `eval-018` (`0524567890`), the synthetic test numbers use the unassigned Saudi `052` prefix and sequential digits (`1234567`, `4567890`). The model emitted an `uncertainty` finding on `contact_phone`, causing Stage 3 resolution to conservatively clear `contact_phone` to `null` under D-020.

### Root Cause 3 (Minor — Reason Label Variant): `purpose_uncertain` vs. `purpose_missing` (`eval-020`)
- **Responsible stage:** **LLM Extraction**.
- **Mechanism:** When `purpose` was omitted from the message (`"فيلا في الرياض حي الندى..."`), the model emitted an explicit `uncertainty` finding on `purpose` rather than leaving `purpose` absent, producing `purpose_uncertain` instead of `purpose_missing` (both accurately leave `purpose: null` and flag `needs_review: true`).

---

## 8. Observed Limitations vs. Proposed Improvements (Task 03.5 Candidates)

### Observed Limitations (Do Not Confuse with Proposals)
1. **Headless `agy` overhead & lack of grammar decoding:** Even when isolated in `os.tmpdir()` with an explicit no-tools prompt directive, `agy` (`1.5.3`) consumes ~`10k–33k` input tokens per call (`~10.8s` mean latency) and enforces `--json-schema` via post-hoc retries rather than grammar-constrained token decoding, which exposes `z.strictObject` sensitivity to prose prompt wording.
2. **Conservative uncertainty on synthetic phone patterns:** Synthetic `052` numbers with sequential digits can trigger model uncertainty findings.
3. **Gateway response wrapping:** `agy` returns JSON responses inside markdown fences or concatenated multi-line retry strings in `parsedEnvelope.response` instead of `structured_output`, requiring [`parseAgyResponseString`](../src/llm-gateway/agy.gateway.ts) to isolate valid JSON objects.

### Proposed Improvement Candidates (For Task 03.5 Review)
1. **Prompt-to-Schema Alignment in [`src/extraction/domain-prompt.ts`](../src/extraction/domain-prompt.ts):** Update the prose and example descriptions for `price` and `area_sqm` to explicitly state the exact wire structure (`price` candidate has sibling keys `field`, `value: { amount, currency, period }`, `role`, `quote`, `scope` — `role` is a sibling of `value`, never inside `value`; `area_sqm` candidate has sibling keys `field`, `value`, `kind`, `quote`, `scope`). Do **not** relax Stage 2 `z.strictObject` guarantees or alter frozen expected labels (`test/evaluation/expected.json`).
