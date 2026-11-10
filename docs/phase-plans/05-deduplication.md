# Phase 05 — Conservative property deduplication

**Status:** Planned (detailed rule specifications in [D-051](../DECISIONS.md#d-051-phase-05-precise-deduplication-rules-extraction-guards-and-persistence-flow) remain `Proposed` pending explicit user approval of the complete plan for implementation).

## Summary

Implement one deterministic matcher in the Listings module. CLI and HTTP use the same extraction, resolution, matching, review, and result-assembly rules. They differ only in where prior candidates come from: the current CLI execution or persisted HTTP listings.

The policy favors avoiding false links. An automatic `duplicate_of` link requires a source-grounded physical identifier **and** compatible corroborating facts. A matching quote, broker advertisement code, contact number, price, or collection of ordinary property attributes cannot establish physical identity alone. Plausible but unproven matches receive `possible_duplicate`; unrelated or contradictory properties remain unlinked.

Phase 04 is [verified](04-sqlite-http-and-approval.md). Its CLI-only Nest module already starts without SQLite. Phase 05 builds on that state; it does not reopen Phase 04.

## Settled policy and decision records

Before matcher implementation, this task record and the consequential choices in [DECISIONS.md](../DECISIONS.md) document the Phase 05 policy direction, resolving `OPEN-02` and `OPEN-06`:

- **Strict identity-based linking ([D-046](../DECISIONS.md#d-046-strict-identity-based-linking-for-automatic-deduplication)):** Automatic matching requires physical identity evidence. Ordinary attribute similarity may justify review, but cannot establish a duplicate.
- **Area policy ([D-047](../DECISIONS.md#d-047-area-comparability-policy-for-deduplication)):** Automatic links require equal, explicitly comparable land or built-up measurements. Missing and unspecified kinds do not satisfy this rule.
- **Optional internal identity extraction ([D-048](../DECISIONS.md#d-048-optional-internal-identity-extraction-without-extra-llm-calls-or-public-fields)):** Capture a source-grounded reference without adding a public listing field or another LLM call.
- **Conflict policy ([D-049](../DECISIONS.md#d-049-conservative-deduplication-conflict-policy)):** Different known city, district, property type, building, unit, or parcel identifiers reject a match. Other discrepancies may leave a physical-identifier match possible for review.
- **HTTP concurrency ([D-050](../DECISIONS.md#d-050-process-local-http-deduplication-concurrency-gate)):** Serialize the complete final candidate check and save within one application process. Document the separate-process limitation.

The precise rule details below are recorded as **Proposed** ([D-051](../DECISIONS.md#d-051-phase-05-precise-deduplication-rules-extraction-guards-and-persistence-flow)) until this complete plan is approved for implementation. A later implementation request approving this plan is evidence for accepting those details. Decision approval, verification, AI-log review, and commit authorization remain separate. Historical [PLAN.md](../../PLAN.md) is preserved unmodified.

Governing references: [assessment brief](../task-brief.md), [architecture](../architecture.md), [processing policy](../processing-resolution-policy.md), [decision register](../DECISIONS.md), [roadmap](../roadmap.md), and [success criteria](../success-criteria.md).

## Affected criteria

- `SC-10`: Cross-broker duplicate detection and conservative review flagging (expected false negatives remain explicit).
- `SC-13`: Offline behavioral tests without API keys.
- `SC-16`: Complete behavioral tests and implementation for Phase 05 deduplication.
- `SC-21`, `SC-22`, `SC-23`: Decision records, AI log entries, and README updates.
- `PC-01`, `PC-02`: Shared CLI/HTTP pipeline parity and similar-vs-distinct offline cases.

## Internal extraction and evidence contract (Proposed — D-051)

Extend the existing typed candidate array with an optional `identity_reference` candidate. An offer with no reference simply has no such candidate; existing public result objects and raw-message inputs do not change. Use the existing quote and scope conventions, with four reference kinds:

```ts
type IdentityReferenceCandidate =
  | {
      field: 'identity_reference';
      kind: 'parcel_identifier';
      value: { parcel: string };
      quote: string;
      scope: 'local' | 'shared';
    }
  | {
      field: 'identity_reference';
      kind: 'building_unit';
      value: { building: string; unit: string };
      quote: string;
      scope: 'local' | 'shared';
    }
  | {
      field: 'identity_reference';
      kind: 'advertisement_reference' | 'unclassified';
      value: { reference: string };
      quote: string;
      scope: 'local' | 'shared';
    };
```

Apply these rules to model output:

1. Update the domain prompt and generated response schema within Extraction’s existing single call. Ask for a parcel identifier only when the source explicitly labels a plot or parcel number. Ask for a building-and-unit locator only when **both** a building designation and a unit designation are explicit. Classify explicitly labeled listing or advertisement codes as `advertisement_reference`. Use `unclassified` when the source does not establish what a reference identifies. Do not promote “property ID,” a bare number, or a broker code to a physical identifier by guesswork.
2. Extend Stage 2’s existing candidate validation. Validate shape and nonempty components; verify the verbatim quote occurs in the original message and is associated with the claimed offer; reject clipped or incorrectly scoped evidence. Verify that each claimed identifier component occurs as an intact token in its quote after Arabic-digit normalization and conservative Unicode, case, and whitespace normalization. For physical kinds, require the quote to contain an explicit parcel/plot label or both building and unit labels. This is a narrow guard on the model’s claim, not a second property-extraction pipeline.
3. A shared-scope reference can remain in provenance, but cannot authorize an automatic link for one offer. Only validated, offer-local physical references qualify.
4. Reject an invalid identity candidate independently, retaining its rejection reason and original payload in internal provenance. Do not discard an otherwise valid offer solely because its optional identity candidate failed. Multiple identical validated references may be collapsed; multiple different physical references for one offer make its identity evidence unusable for automatic matching.
5. Carry accepted and rejected identity candidates, their quotes, and the selected area kind beyond resolution. Do not derive an area kind from the property type or infer an identifier from raw text later in the matcher.

Normalize reference components for comparison by converting Arabic-Indic digits to ASCII digits, applying Unicode NFKC, folding Latin case, and trimming/collapsing whitespace. Preserve punctuation and do not transliterate arbitrary building names. Compare typed component tuples—parcel number, or building plus unit—rather than concatenated strings. Advertisement and unclassified references are retained for traceability and never used as physical identity keys.

## Deterministic matching policy (Proposed — D-051)

Evaluate prior listings in stable ingestion and offer order. Compare immutable listing facts and validated evidence; approval state and the current `needs_review` flag do not alter identity.

### Compatibility and outcomes

| Evidence between two listings | Outcome for that candidate |
| --- | --- |
| Different known city, district, or property type | No match, even if a reference string is equal |
| Different known parcel identifiers, or different known building or unit components | No match; ordinary attribute similarity cannot override the physical-identity conflict |
| Same validated local physical identifier; known purpose, type, city, and district agree; both have equal area values of the same explicit `land` or `built_up` kind; known room counts do not conflict | Eligible for automatic linkage |
| Same physical identifier but one or more required corroborating fields or comparable area evidence is missing | Possible duplicate when no core identity conflict exists |
| Same physical identifier with differing purpose, rooms, or comparable area value, or with incompatible area kinds | Possible duplicate when city, district, type, and identifier remain credible; never automatic |
| Only an advertisement or unclassified reference matches | Apply the ordinary similarity rule below; the reference itself adds no identity proof |
| No physical identifier matches, but the narrow ordinary similarity rule succeeds | Possible duplicate |
| No qualifying physical or ordinary similarity evidence | No match |

For **ordinary similarity** without matching physical identity, require known equal purpose, property type, city, and district; equal area values with the same explicit land or built-up kind; and at least one additional known equal signal among bedrooms, bathrooms, contact phone, or asking price. Reject this route when a known physical identifier conflicts or a known purpose, location, type, or room count contradicts the candidate. This rule can trigger review, never an automatic link. It does not flag listings merely for sharing a common district.

Price is supporting evidence only. A changed asking price does not block an otherwise qualified physical-identity match and does not, by itself, add a review reason about the new listing. Exact price equality is insufficient for automatic linking. Different broker senders or contact phones do not block a qualified physical-identity match; equal contact phones do not establish one.

Compare area only when both selected values have the same explicit kind: `land` with `land`, or `built_up` with `built_up`. Do not compare land directly with built-up. `unspecified`, missing, or legacy area-kind evidence cannot meet the automatic or ordinary similarity area requirement. A matching physical identifier with such an area limitation can still be a possible duplicate.

Use exact normalized location values and a small, explicit alias table only: `Riyadh`/`الرياض`, `Jeddah`/`جدة`, and `Al Malqa`/`Malqa`/`الملقا`. Keep the city and district comparisons separate. Unknown names compare only after conservative Unicode, case, and whitespace normalization. Do not infer a missing city from its district, add broad transliteration, or use fuzzy geographic matching.

### Candidate groups and canonical IDs

- Group candidates by their established canonical listing ID. An unlinked listing is its own canonical root. Follow persisted `duplicate_of` references only to earlier listings, detect malformed chains defensively, and never create a cycle or self-reference.
- Multiple qualifying rows in **one** established canonical group count as one property only if the incoming listing also passes the hard compatibility checks against that group’s root. Link to the earliest canonical root, not whichever row the query returned first.
- If more than one independent canonical group remains plausible, return `possible_duplicate` with `duplicate_of: null`, even when one row appears stronger. Keep candidate IDs internal; do not add them to the public schema.
- If one canonical group meets the automatic rule and no competing independent group remains plausible, set `duplicate_of` to its root ID. If only possible candidates remain, set `needs_review: true` and append `possible_duplicate` once after the existing review reasons. If no candidate qualifies, add no deduplication reason.
- A new listing always retains its own ID, original fields, source message relationship, and provenance. Matching never merges, deletes, overwrites, or retroactively revises an earlier listing or ingestion snapshot.

## Processing and persistence design (Proposed — D-051)

### Shared internal processing

Keep `ListingMessageProcessor` (`src/messages/listing-message-processor.ts`) stateless and free of database access. Add an internal `prepare(message)` result that performs the existing extraction, Stage 2 validation, resolution, and listing-ID generation once, while retaining resolved offers and validated identity evidence. Add one pure finalization path that takes this prepared result and a prior-candidate collection, matches each offer in source order, derives review state, validates the final public success result, and returns both the public result and internal candidate/provenance records.

Preserve the existing `process(message)` interface for current callers and tests by making it use `prepare` and the same finalizer with no prior candidates. CLI and HTTP call `prepare` followed by the shared finalizer with their respective candidates. This keeps one extraction and resolution implementation; no adapter interprets source text or implements its own matching policy.

Extend the Runtime Reviewer to accept a structured deduplication finding. Preserve existing field-derived reasons in their current stable order. Add `possible_duplicate` only for a possible outcome and add its human-readable label for table presentation. An automatic duplicate does not clear existing reasons. No match leaves current review behavior intact.

### CLI batch

Create one batch-scoped processor wrapper per `runCli` invocation and pass that same wrapper to JSONL and table runners. It holds an ordered, in-memory candidate collection and uses the shared `prepare` and finalization methods. Finalize all offers in a message in source order, making an earlier offer available to later offers. Commit the message’s candidates to batch state only after its entire success result passes validation. If preparation or finalization fails, emit the existing typed failure and add none of that message’s offers.

A new CLI invocation starts with an empty candidate collection. The CLI neither opens SQLite nor deploys migrations. Keep one output record per nonblank JSONL input line, existing order, stdout and exit-code behavior; table mode displays the same finalized review outcome. Repeated raw message IDs within one CLI run are processed as supplied because CLI replay is not HTTP persistence replay.

### HTTP finalization

Preserve the initial pre-extraction replay/conflict check for sequential requests. Execute the LLM call and preparation outside a database transaction and outside the ingestion gate. In `PersistentIngestionService` (`src/messages/persistent-ingestion.service.ts`), hold a promise-based, instance-local FIFO gate across this entire final section:

1. Begin the final database transaction and recheck the message ID. Return the saved immutable snapshot for exact replay or the existing conflict response for changed payload.
2. Read all stored listings in ingestion and offer order. For this assessment-scale SQLite store, filter plausibility in the shared matcher rather than introducing a new search engine or an unverified retrieval threshold.
3. Validate stored internal provenance conservatively. An older row with only `{ listing }`, missing area kind, or missing identity evidence remains readable but cannot gain inferred matching evidence.
4. Finalize the prepared message against stored candidates, including earlier offers from the same new message in source order.
5. Create the message, its immutable finalized result snapshot, and each listing row within the transaction. Save listing rows in offer order so an earlier same-message listing exists before a later row refers to it.
6. Commit, then release the gate. Release it on replay, conflict, matching error, rollback, or any other exception.

Use the existing typed `internal_error` handling for unexpected matching or storage failure; leave no partial successful ingestion. A concurrent identical message-ID request may already have made a second model call before entering the gate, but it must return the winner’s original snapshot and create no second listing set. Different-ID submissions to the same application instance must see the first committed listing before the second final match. Separate application processes are not coordinated by this in-memory gate; document possible missed links there and add no distributed lock.

Add a nullable, indexed `duplicateOfId` self-reference to `StoredListing` through a non-destructive Prisma migration, with a database foreign key to a prior stored listing. Keep existing message and listing IDs, approval columns, and result snapshots. Store the selected area kind and validated identity evidence, including quotes and rejected evidence, in a versioned internal provenance payload; retain compatibility with older `{ listing }` rows without backfilling guessed facts. Update `StoredListingsService` (`src/messages/stored-listings.service.ts`) to return the persisted duplicate ID in `GET /listings` and approval responses. Exact `POST /messages` replay continues to read the immutable saved result, including its original duplicate reference and review flag. Approval continues to update only current review state and optional note.

## Task sequence and focused verification

| Task | Implementation and decision checkpoint | Focused offline acceptance |
| --- | --- | --- |
| **05.1 — Policy and evidence contract** | Create the Phase 05 task record; document OPEN-02/OPEN-06 rules and approval evidence; add the optional identity candidate, prompt instruction, generated-schema handling, and Stage 2 validation. | Existing outputs without references still parse; grounded local parcel and building/unit candidates survive; invented, clipped, wrong-offer, shared, advertisement, and unclassified references cannot authorize automatic matching. |
| **05.2 — Pure matcher and review integration** | Implement reference and location normalization, compatibility checks, three outcomes, canonical grouping, structured review finding, and readable reason. | Synthetic fixtures established before tuning rules cover every policy row, price changes, different brokers, same building/different units, missing facts, multiple roots, and chain behavior. |
| **05.3 — Internal result and CLI batch** | Add prepared-result/finalization flow and batch-scoped wrapper for JSONL and table mode. | First listing unlinked; later qualified repost points to its canonical ID; plausible repost is flagged; multi-offer source order works; malformed input and failed extraction add no candidates; separate runs reset; SQLite is neither connected nor required. |
| **05.4 — HTTP storage and concurrency** | Add migration, versioned provenance, persisted duplicate mapping, and the gate covering recheck through transaction completion. | Restart retains candidates and duplicate references; exact replay makes no new extraction or matching call; changed payload conflicts; approval and replay retain separate current and original state; same-message offers work; concurrent different-ID requests in one app instance see the first commit; failures roll back and release the gate. |
| **05.5 — Integration and regression** | Exercise the CLI and HTTP paths with gateway doubles and isolated temporary SQLite databases. | Verify public schema compatibility, cross-language aliases, old provenance rows, similar distinct units, legacy area-kind limitations, error envelopes, Phase 02 and Phase 04 behavior, and no database artifact from CLI. |
| **05.6 — Evidence and close-out** | Record actual task outcomes and limitations; update the documentation and success checklist. | Run `pnpm test`, `pnpm run typecheck`, and `pnpm run build`; record date, commands, actual counts, fixtures, failures, and unresolved cases. Mark Phase 05 Verified only after its exit checks pass. |

All automated tests remain offline and use gateway doubles and isolated temporary SQLite databases. If a live provider is available, perform a **separate manual** synthetic CLI check that the extended optional candidate schema is accepted and records identity evidence correctly. Label that observation separately from behavioral tests; lack of a live check must be reported, not silently treated as a pass.

## Required test scenarios and failure behavior

- **Physical identity:** Same parcel identifier or building-and-unit locator across different broker senders and wording; same identifier with changed price or contact; matching reference with missing city, district, type, purpose, or comparable area; matching reference with differing purpose, rooms, area value, or area kind.
- **Explicit conflicts:** Same reference string with different known cities, districts, or property types; same building with different unit; different parcel numbers with otherwise equal attributes; identical advertisement codes on distinct properties; multiple conflicting physical candidates within one offer.
- **Ordinary similarity:** The identifier-free villa repost from the brief becomes possible, not automatic; similar apartments with equal area and rooms remain separate but may be flagged for review; shared district or shared phone alone yields no deduplication reason; changed price is evaluated by the explicit rule without an arbitrary tolerance.
- **Evidence integrity:** Invented quote or component, clipped token, reference from a different offer, shared reference copied onto multiple offers, ambiguous reference kind, and legacy persisted rows without validated identity or area kind. No rejected or model-only assertion may become an automatic identity key.
- **Canonical handling:** Two matching rows in one verified canonical group, two independent plausible groups, an existing chain, a malformed or missing referenced root, self-reference prevention, and stable results when database query order changes.
- **Transport and state:** JSONL and table CLI behavior, multi-offer matching in source order, failed-message rollback from in-memory candidates, reset between CLI executions, HTTP restart, exact replay with stable IDs and zero additional matching, changed-message-ID conflict, listing reads after approval, and immutable pre-approval replay.
- **Concurrency and errors:** Two different-ID HTTP reposts submitted together to one application instance, two identical-ID requests, conflicting same-ID requests, matcher exception, transaction failure, and a subsequent successful request proving that the gate was released. Assert no partial message, listing, or snapshot survives a failed write.

## Expected false negatives, limits, and scope boundaries

The expected false negatives are explicit: the brief’s villa repost has no physical identifier; older stored rows have no retained identity or area-kind evidence; different spellings outside the approved alias table may miss; missing or unspecified area blocks automatic linking; and separate server processes can match against stale candidates. Do not mark the brief’s repost as automatically linked or claim complete SC-10 coverage merely because a synthetic physical-identifier case passes. Review the complete assessment checklist at Phase 05 close-out and carry any partial criterion into Phase 06.

No additional LLM call, embedding system, fuzzy search, numeric similarity score, public listing field, HTTP endpoint, listing merge, deletion, or editing workflow is part of Phase 05.

## Documentation and close-out deliverables (upon Phase 05 implementation)

- Update [architecture](../architecture.md) and [processing policy](../processing-resolution-policy.md) with the actual Stage 4 boundary and full matching rules.
- Update [roadmap](../roadmap.md) and [README](../../README.md) with CLI batch behavior, persistent HTTP behavior, examples, replay, concurrency, and limitations.
- Record dated evidence in [success criteria](../success-criteria.md) and significant prompts and corrections in the [AI log](../AI_LOG.md).
- For every task (`05.1`–`05.6`), record implemented behavior, cases handled, errors and database effects, known gaps, verification commands and counts, and follow-up. Record genuine agent mistakes only when one occurs, with who detected it and how it was corrected.

## Definition of done

- [ ] Phase 05 plan and precise rules ([D-051](../DECISIONS.md#d-051-phase-05-precise-deduplication-rules-extraction-guards-and-persistence-flow)) approved for implementation.
- [ ] Task 05.1: Optional `identity_reference` extraction prompt, generated schema, and Stage 2 mechanical validation verified offline.
- [ ] Task 05.2: Pure matcher, canonical grouping, review integration, and readable `possible_duplicate` label verified across all policy matrix and conflict rows.
- [ ] Task 05.3: Shared `prepare`/finalization pipeline and stateless CLI batch wrapper verified for JSONL and table modes with no SQLite artifact.
- [ ] Task 05.4: Non-destructive SQLite migration, versioned provenance, `StoredListingsService` `duplicate_of` projection, and process-local FIFO ingestion gate verified across restart, replay, conflict, approval, and concurrency cases.
- [ ] Task 05.5: CLI and HTTP integration and regression checks pass across all required scenarios and Phase 02/04 regressions.
- [ ] Task 05.6: `pnpm test`, `pnpm run typecheck`, and `pnpm run build` pass after the final edit; architecture, policy, roadmap, README, success-criteria, and AI-log documentation updated with exact evidence, explicit false negatives, and separate live-check disposition.
