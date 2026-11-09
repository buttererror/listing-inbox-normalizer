# Decisions

## Open

- Extraction and persistence contracts, review policies, deduplication thresholds, and provider execution isolation remain to be decided. See the local draft `PLAN.md` for the initial checkpoints.


## Earlier architecture discussion (supplied handoff summary)

This evidence is a user-supplied summary, not an exported GPT transcript. Original prompts are unavailable. The following directions were adopted during that discussion: LLM-first interpretation for broader language coverage; deterministic normalization and validation for source fidelity; NestJS for developer familiarity; Prisma with embedded SQLite; an embedded reusable gateway with standalone deployment deferred; one provider first and UI deferred to protect the assessment budget. Antigravity subsequently became the first provider candidate after a successful smoke test; its adapter remains unimplemented.

## Open policy checkpoints

[D-012](#d-012-approve-the-first-listing-scope-and-contracts) settles OPEN-01, OPEN-02, OPEN-04, OPEN-05 and OPEN-07 for the [first listing contracts](phase-plans/01-contracts-and-cli.md#approved-contract-and-policy-choices). The table records remaining policy work outside that scope. OPEN-08 governs live provider qualification after the offline checks in Phase 03.

| ID | Question | Review checkpoint |
| --- | --- | --- |
| OPEN-01 | Production provider failure handling beyond the approved transport error contract | Before enabling live ingestion in Phase 03 |
| OPEN-02 | Area comparison for property identity beyond the approved projection | Before deduplication |
| OPEN-03 | Project ranges and starting prices | Before extraction schema |
| OPEN-04 | Evidence association across multiple listings and broader price, currency and inference rules | Before Phase 02 extraction and normalization |
| OPEN-05 | Applicable fields for projects and other cases beyond single sale listings | Before expanding review coverage |
| OPEN-06 | Duplicate confidence thresholds | Before deduplication |
| OPEN-07 | Approval transition and persisted review state | Before Phase 03 approval implementation |
| OPEN-08 | Provider execution isolation | Before untrusted live input |

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

- **Status** — Accepted on 2026-11-09.
- **Context** — The first listing flow needs shared CLI and HTTP processing and SQLite persistence. Antigravity has returned a synthetic result, while isolation and evaluator setup still need qualification.
- **Alternatives** — Require Antigravity in the first slice, which would combine provider qualification with domain verification, or verify the full listing flow with an injected gateway first and qualify the live provider in a second slice.
- **Decision and rationale** — Use the offline listing slice first. Its behavior tests can run without provider credentials, and the second slice can isolate provider failures from ingestion and persistence failures.
- **Consequences** — Both slices are needed for the first phase to exit. The test gateway is confined to tests. Approval covers sequence and boundaries. Foundation decisions, detailed contracts and implementation scope remain under review.
- **Validation** — Check CLI/HTTP behavior and persisted results offline, then verify real provider restrictions and evaluator setup using synthetic input before enabling untrusted live input.
- **Review checkpoint** — Review the first slice's exact contracts before implementing it and the provider qualification plan before the second slice.
- **Approval evidence** — “Verify the full CLI/HTTP and SQLite flow offline first, then qualify Antigravity in a second slice”.
- **References** — [Phase 03 carryover checks](roadmap.md#phase-03-carryover-checks) and [D-014](#d-014-organize-delivery-as-phases-and-tasks).

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
- **Consequences** — Supersedes the slice grouping in D-009, D-011, and D-012. The approved contracts and offline provider gate retain their scope and evidence. Phase 03 owns persistence, HTTP parity, and later provider qualification.
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

### Unconfirmed candidate: Earlier GPT extraction strategy challenge

- **Status:** Needs clarification; not counted toward the three required incidents.
- **Evidence:** The supplied handoff summarizes that the earlier assistant initially favored rules and regex and the user emphasized generalization. It is a second-hand summary, not the original exchange.
- **Missing evidence:** Original prompt/context and what specifically was incorrect or changed. A reasonable disagreement alone is not a mistake. Request the user's account only if needed to assess this candidate; do not reconstruct the missing transcript.
