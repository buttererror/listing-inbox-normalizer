# Dwelleo — Processing & Resolution Policies

**Status** — Complete v2 reference, based on the supplied Draft v1 and subsequent user decisions.

The [assessment brief](task-brief.md) defines requirements. The [architecture](architecture.md) defines stage contracts. See [D-019–D-024](DECISIONS.md#v2-decisions) for decision history.

## 0. Core principles

**P-01 — No invention [Brief]**
Never populate a field with information unsupported by the original message. Missing or unreliable values remain null.

**P-02 — Separation of responsibilities [Decision]**
The LLM interprets language and proposes normalized candidates. Code performs mechanical validation, deterministic resolution, deduplication, and review derivation.

**P-03 — Preserve evidence [Decision]**
Each candidate retains its original supporting quote. Rejected candidates, uncertainties, and conflicting assertions must remain available for review.

**P-04 — Conservative acceptance [Decision]**
Prefer a missing value with a review reason over an unsupported value.

**P-05 — No undocumented inference [Brief]**
Any inference policy must be explicitly documented and justified. For the MVP, do not infer a city from a district or a contact phone from the message sender.

---

## 1. Classification and Extraction Policies — LLM

The LLM receives the original source message and follows these responsibilities in order.

| ID | Policy | Required behavior |
|---|---|---|
| E-01 | Classification | Classify as `listing`, `project`, `buyer_request`, `irrelevant`, or `mixed` |
| E-02 | Property segmentation | Identify distinct property offers within one message |
| E-03 | Candidate extraction | Extract every supported field for each property |
| E-04 | Semantic interpretation | Understand Arabic, English, abbreviations, informal wording, and contextual meaning |
| E-05 | Normalization | Propose canonical values, such as `950 ألف` → `950000` |
| E-06 | Evidence | Attach an exact source quote to every candidate |
| E-07 | Contradictions | Preserve conflicting facts rather than arbitrarily selecting one |
| E-08 | Uncertainty | Report ambiguous or contradictory information as structured findings |
| E-09 | Missing information | Do not invent candidates for absent fields |
| E-10 | Shared information | Associate explicitly shared facts with the relevant properties |

### LLM execution order

Within one gateway request, classify → segment → associate → extract → interpret → normalize → verify evidence-to-value consistency → assess consistency → return structured output. Association assigns property-specific and explicitly shared facts to the appropriate offers before extraction. Cross-check every value, field, unit, and qualifier against its quote. Correct unsupported proposals from source evidence or omit them with a grounded uncertainty finding. Preserve competing assertions and their evidence.

### Classification policy

| Message contents | Classification | Listing rows |
| --- | --- | --- |
| One or several independent offers | `listing` | All independent offers |
| Off-plan announcement or unit range | `project` | Empty |
| Buyer requests | `buyer_request` | Empty |
| Greetings or unrelated content | `irrelevant` | Empty |
| Offers and buyer requests | `mixed` | Offers only |
| Project and buyer requests | `mixed` | Empty |
| Project and independent offers | `mixed` | Independent offers only |

`detected_classes` lists distinct base classes in substantive source order. Single-intent messages have one entry. Mixed messages have at least two entries and exclude `mixed` from the array. Incidental greetings leave the substantive classification unchanged. Extract independently identifiable offers regardless of the overall classification.

### Extraction examples

**Multiple listings**

`1) Studio Al Yasmin 35K/yr 2) 2BR Al Yasmin 55K/yr`

Extract two separate properties and keep their evidence separate. The quotes support distinct yearly amounts and lack explicit SAR evidence for public price selection.

**Conflicting facts**

`Villa with 3 bedrooms. Updated to 4 bedrooms.`

Preserve both assertions and the contextual update. Do not silently discard either fact. The model may preserve the apparent update as context. The resolver retains both assertions and applies the approved conflict policy.

**Ambiguous price**

`العربون 50 ألف ريال`

Do not treat the deposit as the property's asking price.

**Shared contact**

`1) Studio 35K 2) Villa 80K. Call 0551234567`

The contact can be associated with both listings because the message explicitly provides it as a shared contact.

### Internal extraction contract

Each candidate should carry:

- Field name and typed normalized value.
- Exact evidence quote.
- Required qualifiers, such as area kind or price period.
- Property association.
- Structured findings where information is contradictory or uncertain.

Avoid model-generated confidence scores and redundant self-verification verdicts.

---

## Step 6 — Normalize

Convert the attributes interpreted in Step 5 into canonical typed values. Normalization must preserve the source's meaning, numeric precision, units, qualifiers, and uncertainty.

### 6.1 Canonical field types

- **purpose:** `sale` or `rent`.
- **property_type:** `villa`, `apartment`, `studio`, `land`, `townhouse`, or `other`.
- **city:** String containing the supported city name.
- **district:** String containing the supported district name.
- **bedrooms:** Non-negative integer.
- **bathrooms:** Non-negative integer.
- **area_sqm:** Positive numeric value with `kind: land | built_up | unspecified`.
- **price:** Object containing:
  - `amount`: Positive numeric value.
  - `currency`: `SAR` when explicitly supported; otherwise `null`.
  - `period`: `total`, `yearly`, `monthly`, or `null`.
  - `role`: `asking_price`, `deposit`, `installment`, `per_sqm_rate`, or `other`.
- **contact_phone:** Saudi mobile number normalized to E.164 (`+9665XXXXXXXX`).

### 6.2 Numeric normalization

- Convert Arabic-Indic (`٠١٢٣٤٥٦٧٨٩`) and Eastern Arabic-Indic (`۰۱۲۳۴۵۶۷۸۹`) digits into standard decimal values.
- Interpret clearly supported written numbers in Arabic and English.
- Convert shorthand magnitudes into absolute numbers, including `K`, `M`, `ألف`, and `مليون`.
- Interpret decimal and grouping separators according to the source context.
- Preserve numeric precision. Do not round or estimate values.
- Do not convert approximate quantities into falsely precise values. Preserve their uncertainty in the extraction findings.
- Never invent a number when its source is missing or ambiguous.

Examples:
- `٣ غرف نوم` → `bedrooms: 3`
- `أربع غرف نوم` → `bedrooms: 4`
- `950K` → `950000`
- `٣٫٢ مليون` → `3200000`
- `مليون ونصف` → `1500000`

### 6.3 Purpose and property type

- Map Arabic and English terminology to the defined English enum values.
- Interpret abbreviations and common Saudi real-estate terminology contextually.
- Do not use a generic enum when the source explicitly supports a more specific enum.
- Do not infer a property's purpose or type from unrelated information.

Examples:
- `للبيع` → `sale`
- `للإيجار` → `rent`
- `شقة` → `apartment`
- `فيلا` → `villa`
- `أرض` → `land`

### 6.4 City and district

- Preserve city and district names in the language and spelling used in the original message.
- Trim surrounding whitespace.
- Remove explicit administrative labels such as `حي`, `District:`, or `مدينة` only when they function as labels rather than as part of the actual place name.
- Do not translate or transliterate location names.
- Do not expand abbreviations or replace place names with alternative spellings unless the source clearly supports the expanded form.
- Do not infer a missing city from a district, or vice versa, using external geographical knowledge.
- Keep city and district as separate attributes.

Examples:
- `الرياض، حي النرجس` → `city: "الرياض"`, `district: "النرجس"`
- `Riyadh, District: Al Narjis` → `city: "Riyadh"`, `district: "Al Narjis"`

Cross-language location matching belongs to deduplication, not extraction normalization.

### 6.5 Area

- Normalize supported area measurements into square metres.
- Convert from another area unit only when the source clearly identifies the unit and the conversion is unambiguous.
- Preserve the semantic area kind:
  - `land`: Land or plot area.
  - `built_up`: Built-up or building area.
  - `unspecified`: Area mentioned without a clearly established kind.
- Do not assume land area or built-up area merely because of the property type.
- Preserve separate supported area measurements as separate candidates, including their kinds.
- Do not choose between competing area measurements during normalization.

Examples:
- `٢٠٠ م²` → `area_sqm: 200`, `kind: unspecified`
- `مساحة الأرض ٣٠٠ متر مربع` → `area_sqm: 300`, `kind: land`
- `Built-up area: 250 sqm` → `area_sqm: 250`, `kind: built_up`

### 6.6 Price

**Amount**
- Convert supported price expressions into absolute numeric amounts.
- Preserve the original amount's meaning and precision.
- Do not treat deposits, installments, or per-square-metre rates as total asking prices.

**Currency**
- Use `SAR` only when the source explicitly identifies Saudi riyals or an unambiguous equivalent.
- Use `null` internally when the currency is missing or cannot be established.
- Do not silently assume SAR from the property's location.

**Period**
- Use `yearly` for explicitly annual rental prices.
- Use `monthly` for explicitly monthly rental prices.
- Use `total` when the source supports a total price rather than a recurring amount.
- Use `null` when the period cannot be established.
- Do not assume every rental amount is yearly.

**Role**
- Use `asking_price` for an identified sale or rental asking price.
- Use `deposit` for deposits or earnest money.
- Use `installment` for installment amounts.
- Use `per_sqm_rate` for rates expressed per square metre.
- Use `other` when a price has a different identifiable role.

Examples:
- `السعر ٩٥٠ ألف ريال` → `amount: 950000`, `currency: SAR`, `period: total`, `role: asking_price` when clearly referring to the property's total sale price.
- `85,000/yr` → `amount: 85000`, `currency: null`, `period: yearly`, `role: asking_price` when presented as the rental asking price.
- `العربون ٥٠ ألف ريال` → `amount: 50000`, `currency: SAR`, `role: deposit`.
- `٢٥٠٠ ريال للمتر` → `amount: 2500`, `currency: SAR`, `role: per_sqm_rate`.

**Public contract boundary:** The final listing schema requires `price.currency: "SAR"`. An internally extracted amount with unknown or unsupported currency must not be presented as a confirmed SAR price. The downstream resolver must follow the documented public-price policy, potentially leaving the public amount null and flagging the uncertainty for review.

### 6.7 Contact phone

- Normalize supported Saudi mobile numbers into `+9665XXXXXXXX`.
- Convert Arabic-Indic digits before phone normalization.
- Accept clearly supported local or international representations of the same Saudi mobile number.
- Do not invent missing digits.
- Do not treat unrelated international or landline numbers as Saudi mobile numbers.
- Omit a candidate when the phone cannot be normalized confidently.

Examples:
- `٠٥٥١٢٣٤٥٦٧` → `+966551234567`
- `0551234567` → `+966551234567`
- `966551234567` → `+966551234567`

### 6.8 Evidence preservation and uncertainty

- Every normalized candidate must retain its exact verbatim source quote.
- Never translate, transliterate, or rewrite source evidence.
- Do not replace an unsupported value with a guessed default.
- If two supported source statements give competing values, preserve both candidates for downstream resolution.
- Use semantic findings to report material uncertainty, contradiction, or missing context.
- Do not invent values to complete the listing schema.
- Do not choose between competing supported candidates during normalization.

### 6.9 Responsibility boundaries

- **Stage 1 — LLM Extraction:** Interpret the source and propose normalized typed candidates with original evidence.
- **Stage 2 — Mechanical Validation:** Verify structure, grounded evidence, numeric constraints, and canonical formats; it does not reinterpret quote meaning or compare it with normalized values.
- **Stage 3 — Field Resolution:** Select supported values according to documented business policies.
- **Stage 5 — Runtime Reviewer:** Identify unresolved or materially uncertain information requiring human review.

Normalization must not perform deduplication, human-review decisions, or public-result assembly.

---

## 2. Mechanical Validation Policies — Code

Validation does not attempt to reinterpret natural language.

| ID | Policy | Required behavior |
|---|---|---|
| V-01 | Schema | Validate the message and offer envelope first. Return a typed failure if the envelope is unusable |
| V-02 | Evidence existence | Verify a verbatim occurrence; reject local evidence outside its claimed offer. Preserve repeated or shared evidence unless a mechanical source-boundary check disproves it |
| V-03 | Evidence integrity | Reject reliably identifiable clipped or fabricated quotes |
| V-04 | Types | Validate each field against its internal schema |
| V-05 | Allowed values | Enforce enum constraints |
| V-06 | Numeric constraints | Require finite, safe, appropriately bounded numbers |
| V-07 | Phone format | Validate and canonicalize Saudi mobile numbers |
| V-08 | Invalid candidates | Reject invalid candidates individually. Retain their original data and findings and continue with usable fields and offers |

### Numeric constraints

- Bedrooms and bathrooms: nonnegative safe integers.
- Area: finite positive number.
- Price: finite positive amount.
- Currency: `SAR` under the public output contract.
- Period: `total`, `yearly`, `monthly`, or null as appropriate.

Do not introduce arbitrary maximum property prices, bedroom counts, or areas without a justified requirement.

### Validation limitation

An exact quote and a schema-valid value do not prove that the LLM interpreted the quote correctly.

Stage 2 does not parse numbers, price shorthand or qualifiers from quotes, compare phone digits, or perform arithmetic. For example, a grounded `٣ غرف نوم` candidate with normalized value `4` may pass Stage 2; Stage 1 is responsible for semantic evidence-to-value verification.

---

## 3. Resolution Policies — Code

The resolver receives mechanically validated, normalized candidates, along with uncertainty and rejection findings.

It does not parse the original message or invoke the LLM.

### General resolution

| ID | Policy | Required behavior |
|---|---|---|
| R-01 | No candidates | Return null |
| R-02 | One valid distinct value | Select it |
| R-03 | Repeated identical values | Resolve as one value |
| R-04 | Conflicting values | Return null and record conflict |
| R-05 | Uncertain competing evidence | Leave the field null and flag grounded uncertainty that could materially change its selected value or qualifier |
| R-06 | Rejected evidence | Exclude it from field resolution |
| R-07 | Field applicability | Apply documented applicability policies |
| R-08 | Final output | Populate only fields permitted by the public contract |

### Property and room applicability

**Approved field policy**

| Property type | Bedrooms | Bathrooms |
|---|---|---|
| Villa | Applicable | Applicable |
| Apartment | Applicable | Applicable |
| Townhouse | Applicable | Applicable |
| Studio | Not required | Applicable |
| Land | Inapplicable | Inapplicable |
| Other / unresolved | Applicability uncertain | Applicability uncertain |

Inapplicable fields remain null without missing-field reasons. Other and unresolved types retain supported counts without requiring missing counts.

If a studio explicitly specifies a bedroom count, preserve the supported fact rather than automatically discarding it. Studio classification alone must not invent `bedrooms: 0`.

### Area projection

The internal extraction contract preserves separate measurements:

- `land`
- `built_up`
- `unspecified`

The public output exposes only one `area_sqm`.

**Approved projection policy**

| Property | Preferred area |
|---|---|
| Land | Explicit land area, then unspecified |
| Villa, apartment, townhouse, studio | Built-up area, then unspecified, then land area |
| Other or unresolved type | Select only when land and built-property projections agree on a value. Retain a kind only when both agree on kind |

Additional rules:

- Never add land and built-up areas together.
- Conflicting measurements within the selected category produce null and a finding.
- Retain nonselected measurements internally.
- Preserve the selected area kind for traceability.
- Do not label an area kind as resolved if it remains ambiguous.

This projection order is a product decision, not a rule specified by the brief.

### Price resolution

Resolve the complete price tuple:

`amount + currency + period`

- Identical tuples resolve to one price.
- Different competing tuples remain unresolved unless an explicitly established context makes them separate prices.
- Preserve distinctions between asking price, deposit, installments, and price per square meter.
- A total sale price must not be manufactured from a deposit or unit price.
- Rental periods must be explicitly supported.
- If no reliable amount exists, use amount null and period null unless the approved policy explicitly preserves a known period.

**Approved currency policy** — The public currency stays SAR. Require explicit SAR evidence for the asking amount. Unlabelled and non-SAR amounts leave amount and period null with a review reason. For example, `85,000/yr` supplies a period and lacks SAR evidence.

### Location resolution

- Preserve the city and district as separate fields.
- Do not infer a city solely from a district without an approved location-reference policy.
- Reject unresolved conflicts rather than arbitrarily selecting a location.
- Avoid treating spelling differences as distinct places where reliable canonicalization is available.
- Defer geographic reference matching to a separate enhancement.

---

## 4. Runtime Review Policies — Code

The reviewer consumes resolution outcomes, model findings, and validation failures.

It does not independently reinterpret the message.

| ID | Policy | Required behavior |
|---|---|---|
| H-01 | Missing applicable field | Add a missing-field reason |
| H-02 | Conflicting values | Add a conflict reason |
| H-03 | Unsupported candidate | Retain the validation finding; flag if it affects field reliability |
| H-04 | Uncertainty | Flag material unresolved uncertainty |
| H-05 | Inapplicable field | Do not flag as missing |
| H-06 | Review status | `needs_review = true` whenever a material review reason exists |
| H-07 | Readability | Provide stable reason codes with clear human-readable descriptions |
| H-08 | Provenance | Preserve the evidence underlying each finding |

### Example review reasons

| Reason code | Meaning |
|---|---|
| `price_missing` | No supported asking price was found |
| `price_conflict` | Competing price values could not be reconciled |
| `price_uncertain` | Price information is ambiguous |
| `area_sqm_conflict` | Competing applicable area measurements |
| `city_missing` | City information is absent |
| `bedrooms_unsupported` | Proposed bedroom evidence failed validation |
| `property_type_uncertain` | Property classification is unresolved |

Reason codes should be deterministic. Explanatory model findings may provide additional context.

Harmless rejected assertions leave independently supported selections usable. Mixed classification alone adds no review reason.

**Human approval:** A review flag is distinct from the approval workflow. The API must support approving reviewed listings without altering the original extracted evidence.

---

## 5. Deduplication Policies — Separate Service

| ID | Policy | Required behavior |
|---|---|---|
| D-01 | Existing listings | Compare incoming listings against persisted records |
| D-02 | Broker independence | Do not require the same sender or contact |
| D-03 | Multiple signals | Compare available location, type, area, price and property attributes |
| D-04 | Definitive duplicate | Set `duplicate_of` to the existing listing ID |
| D-05 | Ambiguous match | Do not assert a duplicate without sufficient evidence |
| D-06 | Traceability | Preserve the incoming message and listing information |

An ambiguous match may generate a review finding without setting `duplicate_of`.

Never deduplicate solely because two listings share a district, price, or contact number.

Deduplication must not overwrite extracted facts or silently merge distinct properties.

---

## 6. Output and Integration Policies

**O-01 — Public contract**
Preserve the brief's required listing fields, review status, and `duplicate_of`. Add `mixed` and `detected_classes` to successful results under D-019.

**O-02 — Empty outputs**
Buyer requests, irrelevant messages, and project announcements without independently identifiable offers return `listings: []`.

**O-03 — Shared processor**
CLI and HTTP use the same processing pipeline.

**O-04 — Failure behavior**
An unusable model envelope produces a typed failure. Invalid candidates in a usable envelope follow V-09.

**O-05 — Persistence**
Store the raw message, result snapshot, listings, review state, and provenance using the embedded database. Approval preserves the ingestion snapshot and evidence.

**O-06 — Cost and latency**
Document model usage, estimated per-message cost, latency, and known limitations in the README.

---

## 7. Quality Evaluation Policies — Development

Keep quality evaluation separate from runtime review.

| ID | Policy | What to measure |
|---|---|---|
| Q-01 | Classification accuracy | Correct message categories |
| Q-02 | Segmentation accuracy | Correct number of listings and property association |
| Q-03 | Value accuracy | Normalized values match the source |
| Q-04 | Hallucination detection | Unsupported values accepted |
| Q-05 | Coverage | Supported values missed |
| Q-06 | Review accuracy | Correct and unnecessary review flags |
| Q-07 | Deduplication | True duplicates detected without merging distinct listings |
| Q-08 | Offline reproducibility | Automated tests run without API keys |
| Q-09 | Operational performance | Token usage, cost and latency |

Use independently written Arabic, English, mixed-language, ambiguous, conflicting, and multi-property messages.

Include both ordinary examples and deliberately malformed LLM responses.

---

## 8. Decision checkpoints and draft history

| Draft checkpoint | Current disposition |
| --- | --- |
| Project output and mixed offers | Draft v1 proposed no project rows and classifying offers plus requests as `listing`. D-019 confirms no rows for project announcements and supersedes the mixed-offer proposal with `mixed`. |
| Area projection | D-020 accepts the draft priorities and the agreement rule for other and unresolved types. |
| Room applicability | D-020 accepts the draft table. |
| Unknown currency | Draft v1 considered defaulting an unlabelled amount to SAR. D-020 requires explicit SAR evidence. |
| Material uncertainty | D-020 selects null and review when grounded competing evidence could affect the selected field. |
| Deduplication threshold | OPEN-06 remains a Phase 05 checkpoint. Review comparable area kinds under OPEN-02 at the same time. |
| Approval transition | Resolve OPEN-07 before implementing Phase 04 approval. |

## Implementation principle

Policies define behavior, code implements policies, and tests verify policies. Keep language interpretation in the model. Use narrow mechanical checks and deterministic selection and review. Keep offline gateway mocks separate from Phase 02 manual live CLI checks and Phase 03 independent evaluation. Measure prompt and schema revisions on the same independently authored cases.
