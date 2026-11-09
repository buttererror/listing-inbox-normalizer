# Decisions

## Open

- Extraction and persistence contracts, review policies, deduplication thresholds, and provider execution isolation remain to be decided. See the local draft `PLAN.md` for the initial checkpoints.


## Earlier architecture discussion (supplied handoff summary)

This evidence is a user-supplied summary, not an exported GPT transcript. Original prompts are unavailable. The following directions were adopted during that discussion: LLM-first interpretation for broader language coverage; deterministic normalization and validation for source fidelity; NestJS for developer familiarity; Prisma with embedded SQLite; an embedded reusable gateway with standalone deployment deferred; one provider first and UI deferred to protect the assessment budget. Antigravity subsequently became the first provider candidate after a successful smoke test; its adapter remains unimplemented.

## Open policy checkpoints

[D-012](#d-012-approve-the-first-listing-scope-and-contracts) settles OPEN-01, OPEN-02, OPEN-04, OPEN-05 and OPEN-07 for the [first listing contracts](phase-plans/01-contracts-and-cli.md#approved-contract-and-policy-choices). D-019 and D-020 settle the v2 treatment of project announcements, multi-offer evidence, price and currency eligibility, and field applicability within the current scope. The table distinguishes these dispositions from the remaining checkpoints. D-024 selects Gemini as the first tool-less provider, and D-026 records its shared SDK transport. OPEN-08 applies to any workflow that executes tools on untrusted input.

| ID | Question | Review checkpoint |
| --- | --- | --- |
| OPEN-01 | D-026 uses the existing typed provider failure and timeout contract for configured providers. | Review any expanded production retry policy before use. |
| OPEN-02 | Area comparison for property identity beyond the approved projection | Before deduplication |
| OPEN-03 | D-019 classifies project announcements and excludes unit ranges and starting prices from independent offers. Project-specific fields are deferred. | Revisit if project-specific output enters scope |
| OPEN-04 | D-019 and D-020 settle association, price, currency, and inference policy for v2. | Verify the approved rules in Phase 02. Review future inference before use. |
| OPEN-05 | D-020 settles applicable fields for v2 listings. Project announcements have no listing-level review unless an independent offer is extracted. | Verify the approved rules in 02.5. Revisit if review scope expands. |
| OPEN-06 | Duplicate confidence thresholds | Before deduplication |
| OPEN-07 | Approval transition and persisted review state | Before Phase 04 approval implementation |
| OPEN-08 | D-024 selects a direct tool-less model call. Workflows executing tools on untrusted input require verified isolation. | Before enabling tool execution on untrusted input |

## Decision format

Use this format for new consequential decisions. The foundation decisions have individual dispositions and approval evidence below.

```text
### D-NNN: Title
Status: Proposed | Accepted | Rejected | Superseded
Context: Problem, requirement, and constraints.
Options and tradeoffs: Concrete alternatives and their material costs/benefits.
Recommendation and rationale: Chosen direction proposed to the user, and why.
Consequences: Scope, compatibility, operating requirements, and limitations.
Validation: How the choice will be checked; later record actual evidence.
Review checkpoint: What work depends on the decision and when to revisit it.
Approval evidence: Pending, or the user's exact approving instruction/excerpt.
References: Related brief requirements, decisions, logs, and code where available.
Supersedes / superseded by: Relevant ID, if applicable.
```

## Proposed and recently approved

### D-018: Resolve uncertain evidence and field applicability

- **Status** — Accepted on 2026-11-09.
- **Context** — The resolver must preserve uncertain evidence alongside supported values and distinguish unresolved area kinds and property applicability.
- **Options and tradeoffs** — Ignore uncertain competing evidence, compare its meaning mechanically, or flag explicit uncertainty for review. The latter can produce extra review but avoids assuming semantic equivalence.
- **Decision and rationale** — Keep supported values and flag explicit field uncertainty. Ignore definitive rejection or generic normalization findings when another value is supported. For unresolved property types retain supported room counts without missing-count flags. Preserve a common area number across projections but omit its kind when kinds differ.
- **Consequences** — Human review may include uncertainty that ultimately agrees with a supported value. Period comparisons await rental support.
- **Validation** — Focused resolver tests, typecheck and build.
- **Review checkpoint** — Revisit uncertainty comparison with the D-017 handoff and rental policy.
- **Approval evidence** — User instruction “PLEASE IMPLEMENT THIS PLAN” for “Phase 02.5 resolver corrections”.

### D-017: Carry evidence-backed field interpretations into normalization

- **Status** — Accepted on 2026-11-09. Implementation is in progress.
- **Context** — The current handoff carries a field and quote. Listings then uses wording patterns to recover meaning. Review reproduced three gaps: a negative price became positive, a yearly rate became a sale total, and a valid currency-first price was dropped. The colon requirement also excludes grounded locations in the supplied messages.
- **Options and tradeoffs** — Patch the current patterns, which is fast for individual cases but leaves meaning split across the prompt and parser. Let the model return final values, which simplifies the parser but makes arithmetic and source fidelity harder to check. Carry typed interpretations and verbatim value and qualifier spans, which adds schema and validation work while retaining deterministic conversion.
- **Recommendation and rationale** — Use typed interpretations from the existing single extraction call. Preserve D-016's verdict and source checks. Require a supported interpretation's value and any qualifier spans to belong to the same verified assertion occurrence. Extraction checks interpretation shape and evidence. Listings converts numeric tokens, currencies and units, validates signs and known incompatible qualifiers, and resolves competing values. Accept an explicitly identified location's source text without requiring a colon. Keep supported and rejected evidence for review.
- **Consequences** — Revise D-016's internal handoff if approved. The public result shape is compatible. Phase 02 remains a single-sale flow with explicit SAR required for a numeric price. The internal interpretation can distinguish total, recurring, per-area, deposit and other non-total price evidence. Review rental normalization and currency-less prices separately under OPEN-04 before enabling them. A source match and a model verdict still leave semantic accuracy to be measured.
- **Validation** — Run the proposed Phase 02 task checks with an offline gateway, including wrong model values, forged or mismatched evidence, clipped signs or periods, invalid totals, common sale formats and locations from the brief. After offline CLI, HTTP and SQLite checks, evaluate unseen examples separately during provider qualification.
- **Review checkpoint** — Approve the handoff and Phase 02 scope before implementing the proposed revisions or wiring task 02.6 to the revised contract. Revisit rental and currency policy before broader coverage.
- **Approval evidence** — User instruction “PLEASE IMPLEMENT THIS PLAN” for “Evidence-backed normalization and architecture update” on 2026-11-09.
- **References** — [Brief](task-brief.md#functional-requirements), [Phase 02 proposal](phase-plans/02-extraction-through-cli.md#proposed-revision-before-026), [D-016](#d-016-verify-meaning-in-one-model-call-with-mechanical-source-integrity-checks).

## V2 decisions

### D-019: Use typed extraction proposals and mixed intent

- **Status** — Accepted on 2026-11-09.
- **Context** — Quote-only assertions and phrase parsing limit multilingual and multi-offer coverage.
- **Options and tradeoffs** — Extend the phrase parser, accept typed values on quote existence alone, or combine typed proposals with independent mechanical checks. The third approach catches reliably detectable mismatches while leaving language interpretation to the model.
- **Decision and rationale** — Use one model request for classification, extraction, normalization, and evidence-to-value self-checking. Use the nine ordered responsibilities in the architecture, with association before extraction. Replace broad wording rules with typed proposals and narrow mechanical validation. Validate the envelope first and retain per-offer candidate rejections. Extend the brief's minimum successful result with `mixed` and `detected_classes` to retain substantive intents alongside genuine offers.
- **Consequences** — Replaces the per-assertion verdict and quote-to-value handoffs of D-016 and D-017. Public listing fields and failure envelopes retain their shapes. Consumers with exhaustive handling of the four original classes or exact success-shape validation must accept `mixed` and `detected_classes`. An exact quote and model self-check cannot establish semantic correctness.
- **Validation and checkpoint** — Verify contract, source association, partial failures and CLI behavior in Phase 02. Evaluate semantic accuracy independently in Phase 03.
- **Approval evidence** — User supplied “Dwelleo — Final Classification Policies”, the evidence-to-value handoff and the two-level validation choice, then requested the v2 plan update.

### D-020: Apply conservative field selection and separate automated review

- **Status** — Accepted on 2026-11-09.
- **Context** — Multiple proposals can conflict, be materially uncertain, or have different roles or applicability.
- **Options and tradeoffs** — Keep the best supported value with a warning, or clear fields whose selected value could materially change. Clearing values reduces unsupported finalization and increases review.
- **Decision and rationale** — Clear material uncertainty and linked arithmetic mismatches. Compare full asking-price tuples and require explicit SAR evidence. Retain the draft room and area policies. Derive readable reasons in a separate reviewer.
- **Consequences** — Amends D-018's keep-and-flag rule for material uncertainty. Preserve conflicting, rejected, and nonselected evidence. A harmless rejected assertion does not invalidate a supported value.
- **Validation and checkpoint** — Verify room applicability, area projection, conflicts, price roles and arithmetic in 02.5.
- **Approval evidence** — User selected “Null and flag”, “Require SAR evidence”, and “Use the draft rules”, then requested the v2 plan update.

### D-021: Test the provider early and qualify after offline ingestion

- **Status** — Superseded by D-022 for provider sequencing. The separate v2 plan and remaining phase ownership carry forward.
- **Context** — Phase 02 now absorbs broader message coverage. Model feedback is useful while the prompt and contract are still easy to change.
- **Options and tradeoffs** — Evaluate only after storage and HTTP, move formal qualification earlier, or run standalone synthetic experiments early while preserving the offline qualification gate.
- **Decision and rationale** — Put early synthetic evaluation in Phase 03, SQLite, HTTP, approval and formal qualification in Phase 04, and deduplication in Phase 05. Capture the architecture change in a separate root PLAN-v2.md and preserve the baseline.
- **Consequences** — Updates phase ownership under D-014. D-011 still governs formal qualification and live ingestion. The evaluator is separate from product traffic.
- **Validation and checkpoint** — Confirm Phase 02 contract checks before a standalone smoke test and the offline Phase 04 exit checks before formal qualification. Resolve OPEN-07 before implementing approval and OPEN-06 before implementing deduplication.
- **Approval evidence** — “I would exchange phase 4 with phase 3 to test as soon as we can.” User then said “Update the plan” after the report distinguishing early testing from qualification.

### D-022: Integrate the live provider before SQLite and HTTP

- **Status** — Superseded by D-023 for the Phase 03 provider setup checkpoint. Live CLI integration still precedes SQLite and HTTP.
- **Context** — Phase 02 now covers the full offline CLI processing path. The user wants a working live CLI as soon as that path is ready.
- **Options and tradeoffs** — Keep live integration after SQLite and HTTP, run a standalone experiment first, or integrate and qualify the provider against the verified CLI before storage work. The CLI-first sequence provides earlier end-to-end feedback and leaves transport and storage parity for the following phase.
- **Decision and rationale** — Phase 03 integrates and qualifies Antigravity through the existing gateway and CLI. Phase 04 adds SQLite, HTTP, and approval. This supersedes the ordering provisions of D-011, D-014, and D-021 that placed qualification after HTTP and SQLite. Retain offline application tests and the OPEN-08 isolation gate.
- **Consequences** — The live CLI can operate before domain persistence. The evaluator remains separate from runtime. Phase 04 verifies persistence and HTTP integration offline.
- **Validation and checkpoint** — After the Phase 02 exit, verify the configured provider through the CLI. Resolve OPEN-01 and OPEN-08 before untrusted input. Measure extraction quality, latency, usage, and available cost on independent cases.
- **Approval evidence** — “I said that we replace the order of two phases not to add a smoke test because I wanted integrate the live provider as soon as possible”.


### D-023: Integrate the live CLI provider at the start of Phase 02

- **Status** — Accepted on 2026-11-09. D-024 supersedes the Antigravity provider choice while retaining the task order and offline/live checks.
- **Context** — Phase 02 tasks need to be manually testable through the live CLI as they land. The single-sale CLI already has an offline verified baseline.
- **Options and tradeoffs** — Integrate after Phase 02 as in D-022, which keeps provider setup off the refactor path, or integrate first, which lets the user exercise each incremental change but requires a runnable shared CLI path after each task.
- **Decision and rationale** — Add 02.0 to integrate and qualify Antigravity through the existing gateway and baseline CLI. Pair each subsequent task with an offline focused check and a separate manual live CLI check. Keep broader independent provider evaluation in Phase 03.
- **Consequences** — Supersedes the Phase 03 provider setup in D-022. Retain offline automated tests, the existing gateway boundary, and the OPEN-01 and OPEN-08 gates before untrusted input.
- **Validation and checkpoint** — Verify a configured live CLI result in 02.0 and use task-specific fixtures throughout Phase 02. Record actual observations separately from mock results. Review the full independent evaluation in Phase 03.
- **Approval evidence** — “Let's setup the live provider so that I can test every task with the cli in phase 2 going forward”. The follow-up “Don't implement adjust the plan phase” limits this session to documentation.

### D-024: Use the Gemini API for tool-less extraction

- **Status** — Accepted on 2026-11-09.
- **Context** — Task 02.0 needs a live CLI provider. The user requires a tool-less model call for untrusted messages. The installed `agy` CLI exposed model tool declarations and its documented flags did not establish a tool-free mode.
- **Options and tradeoffs** — The Antigravity Python SDK offers tool filtering but introduces a Python dependency and may require separate credentials. A direct Gemini model API call permits a request without configured tools and uses an API key. Further `agy` investigation preserves the installed CLI but has an uncertain outcome.
- **Decision and rationale** — Use the Gemini API with no tools configured through the provider-independent gateway. Map provider failures and timeouts to the existing typed errors and validate responses in Extraction. D-026 later selected the shared SDK transport.
- **Consequences** — Supersedes D-023's Antigravity provider choice for 02.0. Gemini 3.6 Flash is the default after a successful synthetic CLI run. D-026 adds configurable Anthropic and OpenAI provider packages, credentials, model configuration, and schema handling.
- **Validation** — Check the HTTP request and schema translation with offline mocks, verify malformed responses and provider failures, then run the synthetic CLI fixture with the configured key. Review independent quality evaluation in Phase 03.
- **Review checkpoint** — OPEN-01 uses the existing typed failure contract for this integration. OPEN-08 is resolved for the direct model request without tools. Any workflow that allows tool execution with untrusted content requires a separate verified-isolation decision.
- **Approval evidence** — “For Dwelleo, broker messages are untrusted data passed to a tool-less LLM extraction call”; user chose “Gemini API with no tools configured”.
- **References** — [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), [provider-independent gateway](../src/llm-gateway/llm-request.ts), and [Phase 02 tracker](phase-plans/02-message-processing.md).

### D-025: Evaluate a shared Chat Completions gateway

- **Status** — Proposed.
- **Context** — The unified gateway handoff proposes a single OpenAI-compatible client for Gemini, OpenAI, Claude, and compatible local endpoints.
- **Options and tradeoffs** — Keep the verified native Gemini path and add adapters as needed, adopt a multi-provider SDK with provider packages, or use the official OpenAI SDK with a configurable Chat Completions endpoint. The last option shares transport code and depends on the selected endpoint's structured output support.
- **Recommendation and rationale** — Use a configurable Chat Completions gateway for verified provider and model combinations. Request strict structured JSON without tools, disable SDK retries, and keep the existing Zod and source-evidence checks. Treat required nullable fields as an explicit wire-schema decision. A synthetic Gemini 3.6 Flash request accepted the current schema unchanged through the compatibility endpoint.
- **Consequences** — The SDK adds a runtime dependency and provider configuration moves to a shared endpoint, credential, model, and timeout. Current gateway callers keep the same interface. Usage and latency belong in diagnostic metadata outside the public listing response.
- **Validation and checkpoint** — Verify configuration, schema compatibility, error mapping, and the single call offline. Before replacing the native Gemini path, run a live synthetic CLI comparison with the configured SDK. Qualify each additional provider and model before documenting it as supported.
- **Approval evidence** — Pending. The user requested review of the proposed handoff.

## Accepted

### D-001: Keep the current stack

- **Status** — Accepted on 2026-11-09.
- **Context** — The NestJS scaffold, Zod configuration, Jest tests and Prisma SQLite setup are already in the repository. The brief permits any stack and requires embedded persistence. The existing SQLite test exercises the driver, while listing persistence remains to be implemented.
- **Options and tradeoffs** — Retain NestJS and Prisma to reuse the shared application context, testing tools and migration setup, at the cost of ORM generation and the native SQLite driver. A smaller HTTP framework and direct SQLite could reduce dependencies but would replace verified scaffold work and require new bootstrap and persistence decisions.
- **Decision and rationale** — Keep TypeScript, NestJS, Zod, Prisma and SQLite. The shared CLI/HTTP path and local storage fit the brief, and retaining the scaffold leaves time for extraction and verification.
- **Validation** — Use the first slice to demonstrate actual Prisma writes, restart persistence, and equivalent HTTP/CLI behavior in offline tests.
- **Review checkpoint** — Verify listing persistence and transport parity in the first slice. CommonJS and pnpm remain separate decisions.
- **Approval evidence** — “Approve D-001 and keep the current stack”.

### D-003: Share listing processing between CLI and HTTP

- **Status** — Accepted on 2026-11-09.
- **Context** — The scaffold exposes Nest HTTP and application-context bootstraps. The brief requires both entry points to emit the same successful message result and use embedded persistence.
- **Options and tradeoffs** — Share a Messages processor in one app module graph so both transports apply the same evidence and persistence rules. The CLI creates a Nest application context without opening a socket. A separate CLI pipeline could have less startup overhead but would duplicate domain wiring or need an additional shared composition layer.
- **Decision and rationale** — Share one processor and domain modules. Keep request handling and JSONL streaming in the respective transport adapters. Use an injected gateway for offline checks and qualify the real adapter in slice 002 under D-011.
- **Validation and checkpoint** — In slice 001, assert equivalent success results and replay across CLI and HTTP with one SQLite database. Check that the CLI starts without an HTTP listener and emits only result records to stdout. Use the results to verify this decision during the slice.
- **Approval evidence** — “Approve D-003 and share one processor”.

### D-004: Keep CommonJS across the toolchain

- **Status** — Accepted on 2026-11-09.
- **Context** — TypeScript emits CommonJS, Jest uses a CommonJS configuration and ts-jest, and the Prisma generator specifies `moduleFormat = "cjs"`. The build and foundation tests passed with this setup. The Prisma client is configured for generation but domain models are still ahead.
- **Options and tradeoffs** — Keep the aligned configuration and reuse the verified bootstrap, or move to ESM and revisit module resolution, Jest transformation, compiled CLI startup and generated Prisma imports. Revisit ESM if a required dependency needs it.
- **Decision and rationale** — Retain CommonJS for the assessment to keep the toolchain consistent and avoid unrelated migration work.
- **Validation and checkpoint** — Verify build, tests, and compiled CLI startup with the generated Prisma client in the first slice.
- **Approval evidence** — “Approve D-004 and keep CommonJS”.

### D-005: Keep health as a liveness check

- **Status** — Accepted on 2026-11-09.
- **Context** — `GET /health` currently returns HTTP 200 with `{ "status": "ok" }` from the application controller. The foundation HTTP test asserts that response. The brief requires a service start command and listing endpoints.
- **Options and tradeoffs** — Keep liveness independent of SQLite queries and model credentials, or add a readiness signal for dependencies. A readiness probe would add a separate operational contract and would need rules for migrations, provider credentials, and timeouts. Calling the model for every health check would also add cost and latency.
- **Decision and rationale** — Retain the existing HTTP 200 response as liveness. Report provider and database failures through the relevant operation. Revisit a separate readiness endpoint if deployment needs it.
- **Validation and checkpoint** — Keep the existing liveness test and verify operation errors in the first slice.
- **Approval evidence** — “Approve D-005 and keep liveness only”.

### D-006: Retain the Multer override

- **Status** — Accepted on 2026-11-09.
- **Context** — The initial production audit reported a Multer advisory through Nest's Express adapter. After adding the override, the production audit passed. The current package manifest and pnpm lockfile both pin Multer at 2.5.0.
- **Options and tradeoffs** — Retain the tested override while the current Nest dependencies remain pinned, or upgrade Nest and recheck its resolved Multer version and compatibility. The second option adds dependency changes and verification beyond the current plan review.
- **Decision and rationale** — Keep the existing override and reassess it when upgrading Nest. The recorded audit is historical evidence for this pin.
- **Validation and checkpoint** — Verify the resolved version after dependency changes and run the applicable audit and foundation checks.
- **Approval evidence** — “Approve D-006 and retain the pin”.

### D-007: Keep the existing commit convention

- **Status** — Accepted on 2026-11-09.
- **Context** — The brief asks for small, meaningful commits. The repository already uses [Conventional Commits](commits.md) with optional scopes and separate authorization to commit.
- **Options and tradeoffs** — Keep the documented format so reviewers can scan each coherent change and its tests, or use free-form messages with less structure. Automated enforcement would add tooling and setup work.
- **Decision and rationale** — Retain the existing guide. Group related behavior, tests, and evidence, with separate commits for unrelated changes. Continue manual review of commit messages and boundaries.
- **Validation and checkpoint** — Review history and intended staged contents when a commit is authorized. The convention governs how commits are prepared.
- **Approval evidence** — “Approve D-007 and keep the current convention”.

### D-008: Retain pinned pnpm and the frozen lockfile

- **Status** — Accepted on 2026-11-09.
- **Context** — Commit `afc9853` migrated the app to pnpm. The manifest pins 10.28.2, the lockfile retains the approved Multer override, and the build-script allowlist covers `better-sqlite3`, `prisma`, and `@prisma/engines`. The migration session recorded a successful frozen offline install and passed build, type check, Prisma validation, and foundation tests.
- **Options and tradeoffs** — Keep the pinned setup and require a frozen install, or choose another package-manager setup and redo lockfile resolution and native-build verification. The current setup requires pnpm availability via Corepack and a native SQLite build where no prebuilt artifact applies.
- **Decision and rationale** — Retain the current pnpm configuration and document `corepack pnpm install --frozen-lockfile` as the install command. Keep native build permissions specific to the listed packages.
- **Validation and checkpoint** — Verify a fresh clone and generated Prisma client during later slice and submission checks. The prior frozen offline install used an already populated local store.
- **Approval evidence** — “Approve D-008 and retain the pnpm setup”.

### D-009: Separate the baseline plan from the evolving roadmap

- **Status:** Accepted — 2026-11-08.
- **Context:** The brief requires preservation of the pre-implementation plan. The user wants to derive phases and vertical slices as implementation proceeds and finalize the draft before the next commit.
- **Options and tradeoffs:** Evolve one plan in place for simplicity, which risks obscuring the original baseline; or retain that baseline and maintain a separate roadmap, which adds one document but preserves traceability.
- **Recommendation and rationale:** Preserve the original plan and derive an evolving roadmap with phases and small end-to-end slices. Record deviations in this register.
- **Consequences:** Roadmap details can change without rewriting the assessment evidence. The [roadmap](roadmap.md) owns evolving sequencing; [phase plans](phase-plans/README.md) and [phase task records](phase-plans/README.md) refine work just before implementation.
- **Validation:** Each approved slice names its observable outcome, governing decisions, and acceptance checks; distinguish planned and implemented status.
- **Review checkpoint:** Review candidate phases and slices before implementing them; preserve the separate plan-finalization checkpoint before the next commit.
- **Approval evidence:** User instruction: “Let's adapt this and prepare structure and the agent for that development strategy. Confirm 009 decision”. This approves the strategy and its documentation structure; individual future phase/slice proposals still require their own scope review.

### D-010: Evidence checks and targeted human review for AI logs

- **Status:** Accepted — 2026-11-08.
- **Context:** Reviewing every log entry imposed work beyond the brief's requirement for key sessions and important prompts.
- **Options and tradeoffs:** Require human approval of every entry for maximum direct review, or have the agent check evidence and request targeted review where attribution or material claims are uncertain.
- **Recommendation and rationale:** Use agent evidence checks for every significant entry and targeted human review for disputed or uncertain claims and important user-caught mistakes. This retains truthful evidence while reducing review burden.
- **Consequences:** Human confirmation is tracked separately and never inferred; ordinary unreviewed logs do not alone block commits. Decision and commit approvals remain separate.
- **Validation:** Compare entry prompts, outcomes, checks and attribution with available evidence; review policy consistency and links.
- **Review checkpoint:** Revisit if evidence quality or user review burden becomes problematic.
- **Approval evidence:** User instruction beginning “PLEASE IMPLEMENT THIS PLAN: # Lightweight AI Evidence and Targeted Mistake Review”.
- **References:** [AI log policy](AI_LOG.md#entry-format-and-review-policy), [success criteria](success-criteria.md).

### D-011: Verify the listing flow offline before qualifying Antigravity

- **Status** — Accepted on 2026-11-09. D-022 supersedes the requirement to complete HTTP and SQLite before qualification. Offline CLI verification and the execution isolation checkpoint carry forward.
- **Context** — The first listing flow needs shared CLI and HTTP processing and SQLite persistence. Antigravity has returned a synthetic result, while isolation and evaluator setup still need qualification.
- **Alternatives** — Require Antigravity in the first slice, which would combine provider qualification with domain verification, or verify the full listing flow with an injected gateway first and qualify the live provider in a second slice.
- **Decision and rationale** — Use the offline listing slice first. Its behavior tests can run without provider credentials, and the second slice can isolate provider failures from ingestion and persistence failures.
- **Consequences** — Both slices are needed for the first phase to exit. The test gateway is confined to tests. Approval covers sequence and boundaries. Foundation decisions, detailed contracts and implementation scope remain under review.
- **Validation** — Check CLI/HTTP behavior and persisted results offline, then verify real provider restrictions and evaluator setup using synthetic input before enabling untrusted live input.
- **Review checkpoint** — Review the first slice's exact contracts before implementing it and the provider qualification plan before the second slice.
- **Approval evidence** — “Verify the full CLI/HTTP and SQLite flow offline first, then qualify Antigravity in a second slice”.
- **References** — [Current provider prerequisite](roadmap.md#phase-02-provider-prerequisite) and [D-014](#d-014-organize-delivery-as-phases-and-tasks).

### D-012: Approve the first listing scope and contracts

- **Status** — Accepted on 2026-11-09.
- **Context** — D-011 establishes the offline-first sequence. Slice 001 needs a concrete transport, grounding and persistence contract before implementation.
- **Alternatives and tradeoffs** — Start with one explicit sale listing and a controlled gateway, or include rentals, projects, multiple listings and a live adapter in the first pass. The smaller path makes the shared processor and SQLite behavior verifiable while later slices broaden coverage.
- **Decision and rationale** — Adopt the [documented first listing contracts](phase-plans/01-contracts-and-cli.md#approved-contract-and-policy-choices). Both transports accept the same message fields. The CLI processes JSONL and HTTP accepts one JSON message. A distinct error envelope preserves the brief's successful result shape. Field-specific evidence checks and deterministic normalization protect source fidelity. Atomic writes and replay preserve listing IDs.
- **Consequences** — This settles the listed policies within slice 001. The test gateway stays in tests, and live qualification is slice 002. Broader extraction and approval policies retain their review checkpoints above.
- **Validation** — Use the slice acceptance checks for equivalent CLI/HTTP results, clean stdout, validation failures, replay, conflicting IDs, and SQLite restart persistence.
- **Review checkpoint** — Update success-criteria evidence after slice verification. Review the real adapter and the remaining policies before their dependent work.
- **Approval evidence** — “Approve slice 001 scope and contracts as documented”.

### D-013: Pair small slice tasks with focused verification

- **Status** — Accepted on 2026-11-09.
- **Context** — The user wants smaller tasks within each slice and a testing task after implementation work.
- **Alternatives and tradeoffs** — Verify only at slice close-out, or pair each implementation task with focused checks. Paired checks require a small task record and help isolate failures before later work depends on the change.
- **Decision and rationale** — Break each slice into small tasks and follow each with a testing task. Check meaningful behavior at the affected boundary, then verify the full slice outcome at close-out.
- **Consequences** — Task status and evidence live in the slice record. A passed task check advances only the criteria it demonstrates.
- **Validation and review checkpoint** — Apply the format to [phase tasks](phase-plans/01-contracts-and-cli.md#tasks-and-testing). Review the task evidence during slice close-out.
- **Approval evidence** — “Testing strategy is to add a testing task after the task” and “The slices will be split to small tasks (You should note that)”.

### D-014: Organize delivery as phases and tasks

- **Status** — Accepted on 2026-11-09.
- **Context** — The first listing slice combined several independently verifiable outcomes. The user requested contracts and CLI first, then extraction through CLI, with later tasks refined from evidence.
- **Alternatives and tradeoffs** — Keep the slice hierarchy, which separates an end-to-end outcome from its tasks, or use phase records to hold both. The phase structure gives each early checkpoint one owner and reduces navigation.
- **Decision and rationale** — Use plan, roadmap, phases, and tasks. Detail Phases 01 and 02. Keep Phases 03–06 as candidates. Pair each task with focused verification under D-013 and use exit checks in place of time allocations.
- **Consequences** — Supersedes the slice grouping in D-009, D-011, and D-012. The approved contracts and offline provider gate retain their scope and evidence. The original Phase 03 assignment was persistence, HTTP parity, and later provider qualification. D-022 records the revised sequence.
- **Validation and review checkpoint** — Check links, preserved contract rules, and ownership of the former slice checks. Review Phase 02 evidence before detailing the next phase.
- **Approval evidence** — User instruction “PLEASE IMPLEMENT THIS PLAN” for “Finalize the phase-and-task delivery plan”.

### D-016: Verify meaning in one model call with mechanical source integrity checks

- **Status** — Accepted on 2026-11-09.
- **Context** — Deterministic keyword/cue patterns and regex lists in application code do not generalize across languages and phrasing. The user requested using the same model call to propose evidence and assess whether it supports the claimed field, eliminating field cue patterns from application code while keeping source integrity verification mechanical.
- **Options and tradeoffs** —
  1. Multi-call verification: Separate extraction and verification model calls increase latency and cost.
  2. Application-side keyword patterns (D-015): Hardcoded cue lists lack linguistic generalization and context coverage.
  3. Single-call extraction with model self-assessment and mechanical checks (chosen): The model returns field, quote, verdict, and optional context_quote. Application code enforces mechanical integrity (exact source presence, context containment, token boundaries without clipping numbers/words, and occurrence disambiguation). Tradeoff: The model assesses its own extraction in one call; `supported` is a model judgment backed by source-checked evidence. Accuracy on unseen messages remains a live qualification criterion.
- **Decision and rationale** — Define a private gateway response schema for extraction and assessment with `{ field, quote, verdict, context_quote }`. Instruct the model to quote the shortest contiguous passage with value and qualifiers, assess support against the source, distinguish occurrences, and return `uncertain` for ambiguous or negated text. Replace pattern-based context checks with mechanical checks for exact quotes, unclipped tokens (including decimal/thousands separators), and occurrence disambiguation. Forward only supported assertions passing mechanical checks in `{ field, quote }` handoff to 02.4. Retain contradicted, uncertain, and mechanically rejected assertions as findings with reasons.
- **Consequences** — Application code contains no keyword lists for field meaning or phrase changes. The handoff to normalization (02.4) remains unchanged as `{ field, quote }`. Accuracy on unseen messages remains a live qualification criterion.
- **Validation** — Focused offline tests check exactly one gateway call, schema validation, invented quotes or context, clipped tokens (including grouped and decimal numbers), repeated occurrences, and mixed verdicts (Arabic and English: فيلا للبيع, 5 BR claimed as bathrooms, Asking 3.2M SAR with trailing per year). Live provider qualification measures decision accuracy on unseen messages.
- **Review checkpoint** — Review live model accuracy and false-acceptance rate during Phase 03 provider qualification.
- **Approval evidence** — User instruction: “Agent implementation plan — Revise 02.3 to verify meaning in one model call”.
- **References** — [Phase 02](phase-plans/02-extraction-through-cli.md), [AI log](AI_LOG.md).

## Superseded

### D-015: Use one extraction call with contextual evidence checks

- **Status** — Superseded by D-016 on 2026-11-09.
- **Context** — Whole-quote patterns rejected valid expressions and missed trailing qualifiers. The user considered a second semantic verification call and supplied a contextual verification handoff.
- **Options and tradeoffs** — A second model call can independently assess field meaning but adds latency and cost. One extraction call plus local checks avoids the second call but has limited language and context coverage.
- **Decision and rationale** — Request complete evidence in 02.1, check verbatim in 02.2, and apply contextual field checks in 02.3. Preserve supported, contradicted and uncertain outcomes; normalize only supported evidence in 02.4.
- **Consequences** — Superseded by D-016, which moves meaning assessment into the extraction model call and replaces code cue lists with mechanical source integrity checks.
- **Validation** — Focused offline tests exercised multilingual, conflicting, negated and qualified evidence.
- **Review checkpoint** — Superseded before dependent normalization in 02.4.
- **Approval evidence** — User instruction “PLEASE IMPLEMENT THIS PLAN”, titled “Phase 02.3 — Contextual evidence checks with one LLM call”.
- **References** — [Phase 02](phase-plans/02-extraction-through-cli.md), [session log](AI_LOG.md#phase-02-contextual-evidence-revision--2026-11-09).

### D-002: Original npm choice

- **Status** — Superseded on 2026-11-09.
- **Context** — The original plan proposed npm. Commit `afc9853` replaced `package-lock.json` with `pnpm-lock.yaml` and switched scripts to pnpm.
- **Options and tradeoffs** — Record npm as superseded to match the current setup, or reopen npm as an active alternative. Switching back would require restoring and verifying a second migration of the lockfile, scripts and documentation.
- **Disposition** — Retire npm as the active choice and retain the original plan text as history. D-008 separately governs the approved pnpm configuration.
- **Evidence** — The historical plan proposes npm and `afc9853` replaced the npm lockfile with pnpm.
- **Approval evidence** — “Mark D-002 Superseded and preserve its history”.

## Agent error records

The brief requires at least three genuine examples in this register before submission. Do not treat environment restrictions or disagreements alone as errors.

### Error-record format

For each genuine incident record: incorrect action or claim; who caught it (user, agent, automated check, or unknown); detection evidence and actual user correction prompt if available; correction; verification and remaining limits; links to session/files/tests/commit; and human-review status when requested. Present user-caught incidents as a short digest with the ID, issue, user detection, correction and any specific unresolved question.

### E-001: An implemented dependency decision was classified as open

- **Incorrect action:** The agent appended D-006, the implemented Multer override, under Open decisions.
- **Caught by:** Agent during the documentation review.
- **Detection:** The agent observed that the register placed the implemented override under Open; [commit 9145564](../AI_LOG.md) and the [AI log](AI_LOG.md#documentation-organization-and-evidence-requirements) preserve the sequence. No user correction prompt for this incident is recorded.
- **Correction:** Moved D-006 into Accepted during documentation organization; subsequent package-manager migration retained the override.
- **Verification:** Compared the register with the package override and checked document links/structure. Application behavior was unchanged by the classification correction.
- **Evidence:** See the documentation-organization session in the [AI log](AI_LOG.md).
- **Human review:** Not requested. Previously recorded as Pending user review under the earlier policy; no confirmation is implied.
- **Limitation:** This was a documentation status error; whether it should count toward the assessment is not independently confirmed.

### E-002: Parameterized test table failed to compile

- **Incorrect action:** The agent wrote a Jest parameter table containing arrays interpreted as argument lists, producing a TypeScript mismatch.
- **Caught by:** Automated focused test run.
- **Detection:** Jest reported TS2345 before running the boundary tests. No user correction prompt was involved.
- **Correction:** Wrapped each candidates array in an object so each test receives one named case.
- **Verification:** The focused suite passed all nine tests after the correction. See the [session log](AI_LOG.md#phase-01-processing-boundaries--2026-11-09) and [test](../test/processing-boundaries.spec.ts).
- **Human review:** Not requested. This was a transient test compilation error.

### E-003: Jest mock type failed to compile

- **Incorrect action:** The agent supplied one generic argument to a Jest mock overload that requires two.
- **Caught by:** Automated focused test run, which reported TS2743 before tests ran.
- **Correction:** Supplied the processor method's return and parameter types separately.
- **Verification:** The focused suite passed all six tests after correction. See the [session log](AI_LOG.md#phase-01-jsonl-runner--2026-11-09) and [test](../test/jsonl-runner.spec.ts).
- **Human review:** Not requested. This was a transient test compilation error.

### E-004: Whole-quote patterns rejected supported evidence

- **Incorrect action:** The initial 02.3 verifier required rigid whole-quote patterns and rejected `فيلا للبيع` for both property type and purpose.
- **Caught by:** User raised the generalization concern: “Didn't we say that we are going to make the solution general, not focused only on the 10 examples?” The agent reproduced the example during follow-up.
- **Correction and verification:** Replaced whole-quote patterns with targeted checks initially; subsequently under D-016, eliminated all application keyword cue lists and delegated semantic assessment to the extraction model call, backed by mechanical source integrity verification. A focused regression accepts the phrase for both fields. See [D-016](#d-016-verify-meaning-in-one-model-call-with-mechanical-source-integrity-checks), [session log](AI_LOG.md#phase-02-revise-023-meaning-in-one-model-call--2026-11-09) and [tests](../test/extraction-field-meaning.spec.ts).
- **Human review:** Requested for the attribution; user confirmation is not recorded.

### E-005: A trailing price qualifier was missed

- **Incorrect action:** The initial verifier accepted `Asking 3.2M SAR` from a statement ending `per year` as a sale price.
- **Caught by:** Agent inspection and reproduction during follow-up to the user's generalization concern.
- **Correction and verification:** The initial revised checker considered trailing context via regex cues. Under D-016, instructions require the model to assess the full passage against non-total price terms and provide `context_quote`, while application code verifies source integrity mechanically. A focused regression rejects this example with `field_contradicted`. See [D-016](#d-016-verify-meaning-in-one-model-call-with-mechanical-source-integrity-checks), [session log](AI_LOG.md#phase-02-revise-023-meaning-in-one-model-call--2026-11-09) and [tests](../test/extraction-field-meaning.spec.ts).
- **Human review:** Attribution review requested; no confirmation is recorded.

### E-006: Normalizer rejected common supported formats

- **Incorrect action:** The initial 02.4 normalizer rejected attached units such as `3BR` and `380m2`, and rejected a negotiable asking price even though the brief includes these forms.
- **Caught by:** Agent inspection prompted by the user's question “Does the normalization follow the [task-brief.md](docs/task-brief.md)?” The user requested the comparison; the available conversation does not show the user identifying the individual defects.
- **Correction:** Allowed attached room and area units and accepted negotiable asking prices while retaining their original evidence.
- **Verification and limits:** The focused normalization suite passed 17 tests including these cases, and typecheck and build passed. This does not establish coverage of all wording or the end-to-end CLI.
- **Evidence:** [Session log](AI_LOG.md#phase-02-normalization-follow-up--2026-11-09), [normalizer](../src/listings/normalize-supported-assertions.ts) and [tests](../test/listings-normalization.spec.ts).
- **Human review:** Not requested.

### E-007: A per-area rate could become a total price

- **Incorrect action:** The initial normalizer could accept `2,500 SAR/sqm` as a total asking price when supplied as a supported price assertion.
- **Caught by:** Agent inspection during the brief comparison requested by the user. The user did not identify this particular example in the available conversation.
- **Correction:** Added rejection of tested per-area rate expressions in the normalizer, retaining a finding instead of a total price.
- **Verification and limits:** The focused suite passed 17 tests, including complete `SAR/sqm` and `SAR per m2` quotes. A quote clipped before the rate qualifier still requires protection at the Extraction handoff; integration remains pending 02.3T.
- **Evidence:** [Session log](AI_LOG.md#phase-02-normalization-follow-up--2026-11-09), [normalizer](../src/listings/normalize-supported-assertions.ts) and [tests](../test/listings-normalization.spec.ts).
- **Human review:** Not requested.

### E-008: Mechanical verifier permitted false acceptances on context mismatch, trimmed context, and signed numbers

- **Incorrect action:** The initial mechanical verifier under D-016 had gaps in source integrity enforcement:
  1. Context containment was checked only when multiple unclipped occurrences remained, allowing a supported assertion whose context pointed to a clipped match (e.g. `Deposit: 150,000 SAR`) to erroneously pass on an unclipped match elsewhere in the text (e.g. `asking price: 50,000 SAR`).
  2. `context_quote` was trimmed before source presence checks, allowing invented leading/trailing whitespace and treating whitespace-only quotes as absent instead of non-verbatim.
  3. Numeric token boundaries excluded signs (`+`, `-`, `\u2212`), allowing quotes that cut off leading signs from numbers.
  4. Attached compound rate units (`SAR/sqm`) were unprotected from cuts before `/`.
- **Caught by:** User in follow-up review ([P1] and [P2] review items).
- **Detection:** User review identified:
  > “[P1] Tie the context quote to the occurrence that passes the token check — verify-source-integrity.ts (line 123) ... For Deposit: 150,000 SAR; asking price: 50,000 SAR, a supported assertion quoting 50,000 SAR with context Deposit: 150,000 SAR passes. The verifier discards the clipped match inside 150,000 but then accepts the other match, which lies outside the supplied context. Check containment whenever the model supplies context.
  > [P2] Check context verbatim before using it as evidence — verify-source-integrity.ts (line 92) ... The verifier trims context_quote before checking source presence. A context quote with invented leading or trailing whitespace can therefore pass, and a whitespace-only quote is treated as absent. D-016 requires any supplied context quote to be verbatim.
  > [P2] Include signs in numeric token boundaries — verify-source-integrity.ts (line 35) ... A quote of 50,000 SAR from -50,000 SAR passes the mechanical check because - is neither alphanumeric nor a recognized numeric separator. If the model marks the quote supported, the handoff changes the sign of the amount. Add signed-number cases to the clipping tests.”
- **Correction:**
  1. Updated `verifySourceIntegrity` to restrict candidate occurrences to those lying within `context_quote` whenever context is supplied, ensuring that if the occurrence inside context is clipped or invalid, the assertion cannot match outside occurrences.
  2. Evaluated `context_quote` verbatim without trimming; any whitespace mismatch, empty, or whitespace-only context is rejected with `context_not_in_source`.
  3. Added signs (`+`, `-`, `\u2212`) to `isClippedToken` boundaries to reject quotes cutting off leading signs.
  4. Added compound unit boundary checks for `/` (e.g. `SAR/sqm`) to reject quotes clipped before rate suffixes.
- **Verification and limits:** Focused suite in `test/extraction-field-meaning.spec.ts` expanded with 8 new regression tests covering all four issues. 34 focused extraction tests and all 88 test suite tests passed; typecheck and build passed.
- **Evidence:** [Session log](AI_LOG.md#phase-02-mechanical-verification-fixes--2026-11-09), [verifier](../src/extraction/verify-source-integrity.ts) and [tests](../test/extraction-field-meaning.spec.ts).
- **Human review:** Requested for attribution and error record confirmation.

### E-009: Listing resolver nullified verified asking price on rejected deposit and defaulted category on conflicting property types

- **Incorrect action:**
  1. The listing resolver checked `!hasFindingOrRejection('price')` when resolving price, causing a supported, unambiguous `3.2M SAR` asking price to become `null` with `price_conflict` when Extraction also retained a rejected deposit quote (`Deposit: 50,000 SAR`). The deposit supplied no competing asking price.
  2. When property-type assertions conflicted (e.g. `villa` and `land`), the resolver defaulted `propertyCategory` to `'built'`, applying built-property area priority (`380 sqm built-up`) over land area (`450 sqm`) instead of leaving the area `null` with a review reason when the unresolved category changes the selection.
- **Caught by:** User in follow-up review ([P2] items).
- **Detection:** User review prompt:
  > “[P2] Keep the verified asking price when a deposit is rejected — resolve-listing.ts (line 164)
  > A verified 3.2M SAR asking price becomes null and receives price_conflict if Extraction also rejects deposit 50,000 SAR as price evidence. The deposit supplies no competing asking price. Keep the verified amount and retain the rejected assertion in the evidence.
  > [P2] Resolve the area only when the property category supports the selection — resolve-listing.ts (line 137)
  > When supported property-type assertions say both villa and land, the resolver correctly leaves property_type null but applies the built-property area priority. With 380 sqm built-up and 450 sqm land, it publishes 380 even though the unresolved type determines which area applies. Leave the area null with a review reason when the category changes the selection.”
- **Correction:**
  1. Allowed unambiguous verified asking prices in `resolveListing` to be kept regardless of rejected assertions or findings for price; the rejected assertion remains preserved in `evidence.rejectedEvidence`.
  2. When `property_type` is unresolved (e.g. conflicting property types), compared the area selection under `'land'` and `'built'`. If the category changes the selected value, left `area_sqm = null` and added `area_sqm_conflict` to `review_reasons`.
- **Verification and limits:** Added two regression tests to `test/listings-resolution.spec.ts`. All 11 resolution tests pass; offline test suite passed 99 tests across 11 suites; typecheck and build passed.
- **Evidence:** [Session log](AI_LOG.md#phase-02-resolution-fixes--2026-11-09), [resolver](../src/listings/resolve-listing.ts) and [tests](../test/listings-resolution.spec.ts).
- **Human review:** Requested for attribution and error confirmation.

### E-010: Source edits during the v2 documentation update

- **Incorrect action** — Began editing Phase 02 source after interpreting “PLEASE IMPLEMENT THIS PLAN” as code authorization in the context of the plan update.
- **Caught by** — The user clarified the scope with “You are only updating the document not implementing, correct?”
- **Correction and verification** — Restored the source edits and confirmed the working-tree changes are documentation only. The revised Phase 02 tracker remains Planned.
- **Evidence** — [V2 planning session](AI_LOG.md#v2-plan-and-roadmap--2026-11-09).

### E-011: The initial v2 documentation condensed the handoffs

- **Incorrect action** — Reduced the policy catalog to a summary, replaced the architecture with a short overview, and wrote a plan that omitted delivery details.
- **Caught by** — The user identified the missing policies and architecture and said “plan v2 is not a plan”. The user supplied explicit ordered stage responsibilities and later corrected the interpretation of the Phase 03 and 04 swap.
- **Correction and verification** — Rebuilt the documents from the handoffs, checked the policy IDs and ordered stage coverage, and recorded the live-provider-first phase order in D-022.
- **Evidence** — [Documentation correction session](AI_LOG.md#v2-documentation-correction-and-provider-sequence--2026-11-09).

### E-012: Architecture boundary bullets read as instructions

- **Incorrect action** — Replaced the handoff's prohibition headings with “Boundary constraints” while retaining imperative bullets such as “Invent missing information”.
- **Caught by** — Codex during the Phase 02 coverage audit requested by the user.
- **Correction and verification** — Rewrote all six boundary lists to state permitted behavior and stage ownership. Compared them against the handoff and checked the documentation diff.
- **Evidence** — [Phase 02 coverage audit](AI_LOG.md#phase-02-coverage-audit--2026-11-09).

### E-013: Fallback in processor bypassed source verification when candidate lacked scope

- **Incorrect action** — `ListingMessageProcessor` gated execution on `hasTypedCandidates = offer.candidates[0]?.scope === 'string'`. If candidate 0 lacked scope, the processor bypassed `bridgeStage1SaleToBaseline` and fell through to a legacy fallback where all candidate quotes were forwarded directly to `listingsService.process` without source checks, allowing ungrounded or fabricated quotes (such as 99,000,000 SAR from "For sale: Villa") to be published.
- **Caught by** — User in review ([P1] item).
- **Detection** — User review prompt:
  > “[P1] Remove the fallback that publishes unvalidated Stage 1 quotes — listing-message-processor.ts (line 61)
  > The first candidate’s scope determines whether the entire offer goes through the validation bridge. If that candidate has no scope, the processor sends all quote-only assertions to Listings without source checks. I reproduced a successful listing priced at 99,000,000 SAR from the source For sale: Villa. Route Stage 1 offers through the bridge regardless of candidate order or shape.”
- **Correction** — Removed the conditional `hasTypedCandidates` gate in `ListingMessageProcessor` and removed synthetic `candidates: legacyCandidates` from Stage 1 extraction results in `ExtractionService`. All Stage 1 offers in `result.listings` are now routed unconditionally through `bridgeStage1SaleToBaseline`, which validates candidate schemas (rejecting scopeless candidates) and validates source grounding, token clipping, and baseline agreement for every candidate.
- **Verification and limits** — Added regression test in `test/listing-message-processor.spec.ts` reproducing an offer with candidate 0 lacking scope and candidate 1 carrying a fabricated 99,000,000 SAR quote. Verified that both candidates are rejected, `price.amount` remains null, and `price_unsupported` is flagged. Full offline suite (158 tests across 15 suites), typecheck, and build pass.
- **Evidence** — [Listing processor](../src/messages/listing-message-processor.ts), [extraction service](../src/extraction/extraction.service.ts), and [tests](../test/listing-message-processor.spec.ts).
- **Human review** — Confirmed by user prompt.

### E-014: Phase 02 tracker condensed the supplied plan

- **Incorrect action** — Reorganized and paraphrased the remaining tasks, leaving out explicit directions such as keeping Zod schemas with the extraction contract and updating legacy test fixtures that could bypass the typed path.
- **Caught by** — User, who wrote “You didn't update according to this plan” and attached the intended text.
- **Correction and verification** — Adopted the attached task table and code boundaries verbatim. Compared the revised sections with the attachment and checked that completed evidence was preserved.
- **Evidence** — [Planning log](AI_LOG.md#phase-02-tracker-aligned-to-supplied-plan--2026-11-10) and [Phase 02 tracker](phase-plans/02-message-processing.md).

### Unconfirmed candidate: Earlier GPT extraction strategy challenge

- **Status:** Needs clarification; not counted toward the three required incidents.
- **Evidence:** The supplied handoff summarizes that the earlier assistant initially favored rules and regex and the user emphasized generalization. It is a second-hand summary, not the original exchange.
- **Missing evidence:** Original prompt/context and what specifically was incorrect or changed. A reasonable disagreement alone is not a mistake. Request the user's account only if needed to assess this candidate; do not reconstruct the missing transcript.

### D-026: Use AI SDK 7 from the CommonJS application

- **Status** — Accepted. Supersedes the proposed D-025 implementation approach and replaces the earlier ES module migration choice in this decision.
- **Context** — The unified gateway needs multiple providers. AI SDK 7 and its provider packages are ESM while the established NestJS application uses CommonJS and extensionless imports.
- **Options and tradeoffs** — A project-wide ES module migration changes every relative import and test configuration. Native dynamic imports load the selected ESM SDK package at the gateway boundary while preserving the established application module format.
- **Decision and rationale** — Use AI SDK 7 with native dynamic imports from the CommonJS LLM Gateway. Load the SDK and selected provider sequentially. Keep all application source and local imports in CommonJS form.
- **Consequences** — Gateway construction is asynchronous. Automated tests use Node's VM-module support when exercising the ESM SDK. `LLM_API_KEY` supplies the credential for the provider selected by `LLM_PROVIDER`. Provider schemas and tool-free requests require provider-specific verification. Claude and OpenAI require live qualification.
- **Validation and checkpoint** — Verify offline request boundaries and the real Gemini CLI before removing the earlier adapter. The offline suite and live Gemini fixture passed on 2026-11-10.
- **Approval evidence** — “Revert back and complete the implementation of vercel ai sdk. Make a detailed plan” and “Implement the plan”.

### D-027: Bridge Stage 1 typed proposals to the single-sale baseline

- **Status** — Accepted on 2026-11-10.
- **Context** — Task 02.1 defines the Stage 1 typed extraction envelope and one-call prompt in Extraction under D-019. Full multi-offer mechanical grounding (02.2), structured finding validation (02.3), independent candidate validation (02.4), and multi-offer/mixed assembly (02.6) follow in subsequent tasks. The shared processor and CLI must remain runnable end-to-end after each task.
- **Options and tradeoffs** — Implement full multi-offer downstream pipeline in one step (high complexity, violates incremental task order), or bridge one independently identified sale offer to baseline Listings resolution while returning typed failures for unhandled shapes. The latter keeps the CLI operational and focused suites passing.
- **Recommendation and rationale** — Use an interim bridge in the processor for one independently identified sale offer. Forward only offer-local evidence whose baseline normalization agrees with the typed proposal, including area kind and the complete price tuple. Preserve empty results for buyer requests, irrelevant messages, and project announcements without offers. Return an `internal_error` envelope for otherwise valid Stage 1 results (mixed, multi-offer) that the interim processor cannot assemble safely.
- **Consequences** — CLI can run against supported sale messages and non-listing single intents. Multi-offer and mixed message public assembly is deferred to 02.6.
- **Validation** — Offline CLI integration tests with Arabic and English sales, quote/value mismatch and fabricated quote checks, clean JSONL output, typecheck, build, and live Gemini CLI check with `test/fixtures/one-message.jsonl` verifying one `listing` offer, exact evidence, and public price 3,200,000 SAR total.
- **Review checkpoint** — Remove the bridge in 02.6 when full Stage 6 assembly replaces the single-sale path.
- **Later revision** — The user-supplied [Phase 02 plan](phase-plans/02-message-processing.md#remaining-tasks) moves bridge removal to 02.5, when Listings switches to `ValidationOutcome`. Full public assembly remains in 02.6.
- **Approval evidence** — User prompt for Task 02.1: "Implement Stage 1 of the architecture under D-019. Exercise the full classification and offer-grouping contract at the Extraction boundary, then connect one supported sale through the shared processor and CLI as specified in the Phase 02 task plan."
- **References** — D-019, D-023, Task 02.1 brief, [Phase 02 task plan](phase-plans/02-message-processing.md).

### D-028: Temporarily output Stage 1 ExtractionEnvelope through process CLI

- **Status** — Accepted on 2026-11-10.
- **Context** — During Phase 02 (tasks 02.2–02.4), developers and evaluators need to inspect the model's internal extraction handoff (`Stage1ExtractionResult`) directly through the CLI across arbitrary message types (including multi-offer, mixed, and non-listing inputs), while the interim single-sale bridge in `ListingMessageProcessor` only resolved single sales and rejected multi-offer messages with `internal_error`.
- **Options and tradeoffs** —
  1. Inspect extraction handoffs only via internal debuggers or unit tests (opaque, cannot easily process JSONL batches via CLI).
  2. Add an optional CLI flag `--stage1` to `process` (preserves `process` contract but requires flag pass-through).
  3. Direct instruction: Temporarily re-point `process <input.jsonl>` to output the internal Stage 1 ExtractionEnvelope directly, and keep the legacy single-sale bridge pipeline accessible through `process-legacy <input.jsonl>`.
- **Recommendation and rationale** — Implement option 3 as directed by explicit user prompt. CLI command `process` executes `ListingMessageProcessor` in `src/messages/listing-message-processor.ts` and outputs `Stage1ExtractionResult` (or `ProcessingFailure`), while `process-legacy` routes through `LegacyListingMessageProcessor` in `src/messages/legacy-listing-message-processor.ts` to preserve the single-sale baseline until task 02.5 / 02.6.
- **Consequences** — `process <input.jsonl>` temporarily outputs `{ classification, detected_classes, listings: [{ offer_quote, candidates, findings }] }` records. Public assembled contract `{ message_id, classification, listings: [{ id, ... }] }` remains available under `process-legacy` until Stage 6 (task 02.6) brings final multi-offer public assembly into `process`.
- **Validation** — Unit tests in `test/cli.spec.ts` for both subcommands; integration tests in `test/cli-integration.spec.ts` checking Stage 1 ExtractionEnvelope outputs for listing, multi-offer, and non-listing inputs, as well as `process-legacy` baseline outputs; live Gemini CLI check with `test/fixtures/one-message.jsonl` returning the ExtractionEnvelope under `process` and the resolved listing under `process-legacy`.
- **Review checkpoint** — Revert `process` output contract to the assembled public result in 02.6 and retire `process-legacy`.
- **Approval evidence** — User prompt: "Change process <input.jsonl> itself to output the internal Stage 1 ExtractionEnvelope, temporarily changing its output contract and keep the legacy pipeline throught process-legacy".
- **References** — D-019, D-027, [Phase 02 plan](phase-plans/02-message-processing.md).
