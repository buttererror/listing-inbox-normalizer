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

## Superseded

### D-002: Original npm choice

- **Status** — Superseded on 2026-11-09.
- **Context** — The original plan proposed npm. Commit `afc9853` replaced `package-lock.json` with `pnpm-lock.yaml` and switched scripts to pnpm.
- **Options and tradeoffs** — Record npm as superseded to match the current setup, or reopen npm as an active alternative. Switching back would require restoring and verifying a second migration of the lockfile, scripts and documentation.
- **Disposition** — Retire npm as the active choice and retain the original plan text as history. D-008 separately governs the approved pnpm configuration.
- **Evidence** — The historical plan proposes npm and `afc9853` replaced the npm lockfile with pnpm.
- **Approval evidence** — “Mark D-002 Superseded and preserve its history”.

## Agent error records

The brief requires at least three genuine examples in this register before submission. One documentation correction is recorded below; further incidents must come from observed work. Do not treat environment restrictions or disagreements alone as errors.

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

### Unconfirmed candidate: Earlier GPT extraction strategy challenge

- **Status:** Needs clarification; not counted toward the three required incidents.
- **Evidence:** The supplied handoff summarizes that the earlier assistant initially favored rules and regex and the user emphasized generalization. It is a second-hand summary, not the original exchange.
- **Missing evidence:** Original prompt/context and what specifically was incorrect or changed. A reasonable disagreement alone is not a mistake. Request the user's account only if needed to assess this candidate; do not reconstruct the missing transcript.
