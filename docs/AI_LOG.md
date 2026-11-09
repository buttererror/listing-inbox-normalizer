# Key agent sessions

All sessions below occurred on 2026-11-08 (Africa/Cairo). Quotes are verbatim excerpts unless explicitly described otherwise. Summaries describe observed work, not reconstructed transcripts. Earlier GPT exchanges are available only through the supplied handoff summary.

## Architecture and planning

**Evidence status:** Evidence checked against available conversation and repository records. **Human review:** Not requested under D-010; prior pending labels are retained as history, not confirmation.

Objective: establish module boundaries and provider-independent extraction contracts.

User prompt excerpts:

> Let's define first the core modules of the app

> Prepare a plan first for implementation.

Summary: agreed on five modules and a pipeline separating interpretation, source grounding, normalization, domain validation, deduplication, and review policy. The user requested planning before implementation, then explicitly scoped the first implementation to stack infrastructure. The draft plan remains untracked; domain policies remain proposals. No original prompts from the preceding GPT conversation are available.

## Antigravity provider experiment

**Evidence status:** Evidence checked against available conversation and recorded execution results. **Human review:** Not requested under D-010; prior pending labels are retained as history, not confirmation.

Objective: establish whether the installed CLI could support structured extraction.

User prompt:

> I installed agy inside wsl

Exact prompt submitted by the agent to Antigravity:

```text
Do not use tools, read files, or change files. Extract only explicitly stated facts from this synthetic property message: للبيع شقة ٣ غرف نوم، السعر ٩٥٠ ألف ريال. Return classification, bedrooms, numeric price_amount in SAR, and city. Missing city must be null.
```

Outcome: Antigravity 1.5.3, model gemini-3.8-flash-low, returned classification listing, bedrooms 3, price_amount 950000, city null, using a supplied JSON Schema. It reported 2.2 seconds, 7,065 input tokens, and 33 output tokens; no USD cost. This was one synthetic smoke test, not an accuracy benchmark. Model interpretation here included numeric conversion; the proposed production design assigns normalization to application code.

Limitations: the executable required its absolute path in this session. Local socket/profile logging restrictions required escalated execution. The command warned that plan mode has no effect with slash expansion disabled; effective tool isolation was not established. These are operational findings, not fabricated agent mistake examples.

## Stack implementation

**Evidence status:** Evidence checked against available conversation and recorded execution results. **Human review:** Not requested under D-010; prior pending labels are retained as history, not confirmation.

Objective: implement only the approved foundation.

User instruction excerpt from the submitted implementation plan:

> Create a runnable NestJS scaffold with development tooling and project documentation. Resume extraction and domain planning afterward.

Summary: created the five module scaffolds, HTTP and application-context bootstraps, health endpoint, Zod environment configuration, Prisma SQLite tooling, and Jest foundation tests.

Evidence: type checking, build, Prisma schema validation, and three foundation tests passed. The HTTP test needed local socket access; tests did not invoke a model. The agent detected a production Multer advisory, applied a patched dependency override, and reran verification; production audit passed. Full development audit reported seven low-severity advisories at that time. The socket failure was an environment restriction, not a coding error. These changes were subsequently included in commit 9145564.

## Commit convention and initial commit

**Evidence status:** Evidence checked against available conversation and repository records. **Human review:** Not requested under D-010; prior pending labels are retained as history, not confirmation.

User prompts:

> Create first the commit convention that suits this project. Follow the conventional commits

> Create the first commit without the plan.md until we finalize it

Summary: documented Conventional Commits with optional project scopes, coherent change boundaries, and explicit authorization. Created commit 9145564, `build: configure the NestJS and SQLite foundation`, after reviewing the staged file list and excluding PLAN.md. Git status showed only the untracked plan afterward. Nothing was pushed.

## Documentation organization and evidence requirements

**Evidence status:** Evidence checked against available conversation and repository records. **Human review:** Not requested under D-010; prior pending labels are retained as history, not confirmation.

Objective: make project context and agent supervision evidence self-contained.

User prompt excerpts:

```text
Also we need to review [AGENTS.md](AGENTS.md) against the project plan and best practice. Also What can we take from Clinic platform project or learn from?
```

> Update the plan. Make sure that the ai logs follows the requirement bullet point

Instruction excerpt from the approved documentation implementation plan:

> A paraphrased objective alone does not satisfy the prompt requirement.

Summary: adapted Clinic Platform's documentation ownership, central decisions, and focused verification to this smaller project. Created a local Notion brief snapshot, documentation index, and architecture/status guide; moved canonical decisions and logs into docs with root links; expanded repository instructions. Preserved application files and the untracked draft plan. Link, Markdown, and Git boundary checks are recorded in the implementation handoff.

Correction: the previous register placed the implemented Multer override under Open; this documentation pass moved D-006 to Accepted. No application regression test is warranted for this documentation-only correction. Additional genuine agent mistakes have not been manufactured to meet the assessment count.

## Entry format and review policy

Record significant implementation, consequential planning, meaningful user corrections, and model experiments. Keep entries compact and link to detailed decisions and error records. A paraphrased objective alone does not satisfy the brief's prompt requirement. Redact secrets and label summaries and shortened quotations accurately.

```text
## Session title — date (Africa/Cairo)
Evidence status: Unchecked | Evidence checked | Needs clarification
Evidence sources: Actual available conversation, commands, results, files or commits.
Human review: Not requested | Requested | Confirmed
Human confirmation evidence: Exact confirmation/reference when applicable.
Objective: Requested outcome.
Important prompts: Actual prompts or labeled verbatim excerpts.
Outcome and verification: What changed and checks actually performed.
Human intervention: User correction, rejection or approval, when applicable.
Limitations: Unknowns, unperformed checks and deferred work.
Related decisions / mistakes: Links where applicable.
```

Before marking Evidence checked, compare the account against available sources using all six checks:

1. Is the session significant enough to retain?
2. Are important actual prompts shown?
3. Does the summary accurately describe the outcome and user steering?
4. Are implemented behavior, proposals and limitations distinguished?
5. Do verification claims match checks actually performed?
6. Are corrections and their discoverer accurately attributed?

Evidence checked is an agent comparison, not independent verification or user approval. Mark Needs clarification when a material claim cannot be supported; identify the missing source or specific question. Human review is Not requested by default, Requested for uncertain attribution, disputed accounts, important user-caught mistakes, or material narrative ambiguity, and Confirmed only with explicit confirmation and its source. Routine entries do not require user approval before a commit. Decision approvals and commit authorization remain separate. Historical Pending user review labels below record the previous policy; they are not confirmations.

## Package manager migration — 2026-11-08

**Evidence status:** Evidence checked against available conversation and recorded execution results. **Human review:** Not requested under D-010; prior pending labels are retained as history, not confirmation.

User prompt:

> Switch the app to using pnpm

Objective: migrate dependency installation, scripts, overrides, and operational documentation to pnpm. Existing npm setup remains historical evidence above; the current decision is D-008.

Evidence: pnpm 10.28.2 installation and a frozen offline install succeeded. Type checking, build, all three offline foundation tests, and Prisma schema validation passed. The HTTP test required local socket access outside the agent sandbox. The npm lockfile was removed after the pnpm lockfile was generated. No commit was created.

## Governance and planning checkpoints — 2026-11-08

**Evidence status:** Evidence checked against available conversation and repository records. **Human review:** Not requested under D-010; prior pending labels are retained as history, not confirmation.

- **Historical review status:** Pending user review under the previous policy.
- **Historical review evidence:** Pending.
- **Objective:** Make decision and session-evidence review explicit in repository instructions.
- **Important user prompt excerpts:**

> Decision should be reviewed by me first and it should have a clear format.

> For AI logs we need to solidfy it through agents.md. If you see that it needs my review, so be it for now.

> For the plan, I will solidfy it before the next commit as we move on with the plan. Should we treat it as a roadmap that we extract vertical slices and phases from it as we go on.

- **Summary:** Added decision approval and AI-log review rules to the repository guide and canonical entry formats to the owning documents. Recorded the roadmap structure as proposal D-009 rather than treating the user's question as approval. Preserved the draft plan.
- **Errors and corrections:** Consolidated the existing documentation correction as E-001 in the decision register; no additional incidents were invented.
- **Limitations:** Historical decisions still need rationale/approval review where their short summaries lack evidence. These governance rules do not retrospectively complete the submission deliverables.

- **Verification:** Markdown fences, whitespace, and local links passed; application source, tests, and Prisma files have no diff. PLAN.md remains untracked. No application tests were run for this documentation-only change. No commit or push was made.

## D-009 confirmation and development structure — 2026-11-08

**Evidence status:** Evidence checked against available conversation and repository records. **Human review:** Not requested under D-010; prior pending labels are retained as history, not confirmation.

- **Historical review status:** Pending user review under the previous policy.
- **Historical review evidence:** Pending for this session account. Decision approval is recorded separately below.
- **Objective:** Activate the approved baseline/roadmap/phase/slice strategy.
- **Important user prompt:**

> Let's adapt this and prepare structure and the agent for that development strategy. Confirm 009 decision

- **Summary:** Marked D-009 Accepted with the user's approval evidence. Added roadmap, phase and slice indexes/formats, and a draft first-listing phase; updated agent navigation and the inspect/propose/approve/implement/verify/close workflow. Only the strategy is accepted; candidate phase sequencing and the first phase's scope await review.
- **Outcome:** The roadmap owns sequencing, phases own outcomes, slices own implementation evidence, decisions own choices, and logs own prompt/supervision evidence. No application functionality was implemented.
- **Limitations:** PLAN.md remains unchanged and untracked, awaiting user finalization. Existing log entries remain pending review. No commit or push is authorized by this task.

- **Verification:** Documentation links, code fences and whitespace passed. PLAN.md is byte-for-byte unchanged and untracked; application source/tests/Prisma have no diff. No application tests were run for this documentation-only change.

## Earlier decision status review — 2026-11-08

**Evidence status:** Evidence checked against available conversation and repository records. **Human review:** Not requested under D-010; prior pending labels are retained as history, not confirmation.

- **Historical review status:** Pending user review under the previous policy.
- **Objective:** Make prior decision approval status explicit while retaining implemented behavior.
- **Important user prompt:**

> Mark them as proposed for now. What is the difference between the slices and phases directories?

- **Summary:** Marked D-001 through D-008 Proposed for consolidated planning review; retained D-009 as Accepted based on its explicit confirmation. Preserved the historical npm-to-pnpm change and current implementation. Updated agent instructions to enforce the review checkpoint.
- **Limitations:** This status update does not change runtime behavior or imply approval of earlier session logs. No commit was made.

## Success criteria and continuous review — 2026-11-08

**Evidence status:** Evidence checked against available conversation and repository records. **Human review:** Not requested under D-010; prior pending labels are retained as history, not confirmation.

- **Historical review status:** Pending user review under the previous policy.
- **Historical review evidence:** Pending.
- **Objective:** Define brief-derived success criteria and integrate continuous review into the planning workflow.
- **Important user prompt excerpt:**

> Besides the point you mentioned, we need to document the task success criteria for constant review as go on. You can derive that from the brief. Make the plan

- **Implementation instruction excerpt:**

> Create a canonical success-criteria checklist derived from the candidate brief and integrate it into the existing planning workflow.

- **Summary:** Added a checklist with stable IDs, evidence and status; connected it to the root plan, documentation index, phase/slice formats and agent workflow. The user approved implementation of this documentation task; that does not approve pending project decisions or this log entry.
- **Limitations:** The checklist is an initial documentation/code inspection, not a complete assessment verification. The model experiment was a single smoke test. PLAN.md remains untracked; no application behavior was changed.
- **Verification:** Reviewed the checklist against the saved brief and validated 27 unique criteria, documentation links and anchors, code fences, package script names, and `git diff --check`. Existing product changes were preserved; PLAN.md remains untracked. No application tests were rerun for this documentation-only task. No commit or push was made.

## Lightweight evidence policy — 2026-11-08

- **Evidence status:** Evidence checked against this conversation and current repository documents.
- **Human review:** Not requested. No confirmation of this account is implied.
- **Objective:** Replace blanket AI-log approval with evidence checks and targeted review, while preserving mistake attribution.
- **Important user prompt:** “PLEASE IMPLEMENT THIS PLAN: # Lightweight AI Evidence and Targeted Mistake Review” (verbatim opening excerpt of the implementation instruction).
- **Outcome:** Updated agent instructions and the log checklist; recorded accepted D-010; updated mistake format and SC-22. D-001–D-008 remain Proposed and D-009 Accepted.
- **Human intervention:** User asked how to make logs easier to review and specifically raised mistakes they caught, then instructed implementation of the approved plan.
- **Limitations:** Earlier GPT conversation is available only as a handoff summary. One possible challenge is recorded as unconfirmed, not counted as an agent mistake. No application code or PLAN.md changed; no commit or push was made.
- **Verification:** Checked documentation links, anchors, Markdown fences, decision/error-ID uniqueness, policy text, `git diff --check`, and the application/plan boundaries. No application tests were run for this documentation-only change.

## Plan revision for joint review — 2026-11-09

- **Evidence status:** Evidence checked against the candidate brief, current repository files, Git history, and this conversation.
- **Human review:** Not requested for the session account. Foundation and slice decisions are awaiting separate user review.
- **Objective:** Revise the application plan and prepare it for joint finalization.
- **Important user prompt:**

> Let's revise the plan and finalize it

- **Outcome:** Appended a dated review addendum to PLAN.md without rewriting its existing text. Mapped the original implementation sequence to the current roadmap, summarized the foundation decisions for review, and drafted an offline first listing slice with a separate live provider qualification checkpoint. Linked the draft from its phase and slice index.
- **Verification:** Checked local links, anchors, code fences, whitespace, and Git boundaries. PLAN.md remains untracked and the decision register still holds the previous statuses. This was a documentation review, so no application tests were rerun.
- **Limitations:** Final plan approval and implementation scope remain pending. The first slice advances partial coverage of the brief. The original smoke test does not qualify Antigravity for untrusted or evaluator input.


## Foundation review and first-slice order — 2026-11-09

- **Evidence status** — Evidence checked against the user's selected answers and the updated plan and register.
- **Human review** — Not requested for the log account.
- **Objective** — Settle the review process for prior decisions and the order of the first two slices.
- **User selections**

> Keep the foundation decisions Proposed for individual review

> Verify the full CLI/HTTP and SQLite flow offline first, then qualify Antigravity in a second slice

- **Outcome** — D-001–D-008 remain Proposed. D-011 records the approved slice order. The original plan text was preserved and its dated addendum, roadmap and slice references reflect the agreed sequence. D-001 has a focused proposal for the first individual review.
- **Limitations** — Plan finalization and the first slice's contracts and implementation approval remain pending.


## D-001 stack approval — 2026-11-09

- **Evidence status** — Evidence checked against the user's selection, the stack configuration, and the updated decision register.
- **Human review** — Not requested for this log account.
- **Important user selection**

> Approve D-001 and keep the current stack

- **Outcome** — Recorded D-001 as Accepted and updated its plan and phase references. D-002–D-008 retain Proposed status. The D-002 review distinguishes retiring the npm proposal from approving the current pnpm setup.
- **Limitation** — Approval selects the stack. Listing persistence and shared transport behavior remain to be verified in the first slice.


## D-002 npm disposition — 2026-11-09

- **Evidence status** — Evidence checked against the user's selection, original plan text, and pnpm migration commit.
- **Human review** — Not requested for this log account.
- **Important user selection**

> Mark D-002 Superseded and preserve its history

- **Outcome** — Recorded D-002 as Superseded and preserved the original npm choice in the baseline. D-008 remains Proposed. Prepared the D-003 shared-processor review.


## D-003 shared processor approval — 2026-11-09

- **Evidence status** — Evidence checked against the user's selection, scaffold bootstraps, and decision register.
- **Human review** — Not requested for this log account.
- **Important user selection**

> Approve D-003 and share one processor

- **Outcome** — Accepted shared CLI and HTTP processing with transport-specific adapters. Updated the plan and first phase references. Prepared the D-004 CommonJS review from the actual compiler, Jest and Prisma generator configuration.
- **Limitation** — Transport parity remains a first-slice verification criterion.


## D-004 CommonJS approval — 2026-11-09

- **Evidence status** — Evidence checked against the user's selection, compiler, Jest and Prisma generator configuration, and decision register.
- **Human review** — Not requested for this log account.
- **Important user selection**

> Approve D-004 and keep CommonJS

- **Outcome** — Accepted CommonJS across the compiler, tests, and generated Prisma client. Updated the plan and first phase. Prepared D-005 from the current health controller and foundation test.
- **Limitation** — Compiled CLI startup with the generated client remains a first-slice check.


## D-005 liveness approval — 2026-11-09

- **Evidence status** — Evidence checked against the user's selection, health controller, foundation test, and decision register.
- **Human review** — Not requested for this log account.
- **Important user selection**

> Approve D-005 and keep liveness only

- **Outcome** — Accepted the current liveness-only contract. Prepared D-006 from the locked Multer resolution and the historical foundation audit result.
- **Limitation** — No audit was rerun for this decision review.


## D-006 Multer pin approval — 2026-11-09

- **Evidence status** — Evidence checked against the user's selection, manifest, pnpm lockfile and historical audit log.
- **Human review** — Not requested for this log account.
- **Important user selection**

> Approve D-006 and retain the pin

- **Outcome** — Accepted the existing Multer 2.5.0 override with reassessment on a Nest upgrade. The user's input questions clarified that the CLI reads a local JSONL file and HTTP accepts one JSON object. Prepared D-007 from the existing commit guide.
- **Limitation** — The earlier production audit is historical evidence. This planning turn inspected the lockfile.


## D-007 commit convention approval — 2026-11-09

- **Evidence status** — Evidence checked against the user's selection, the current commit guide, package configuration, and the decision register.
- **Human review** — Not requested for this log account.
- **Important user selection**

> Approve D-007 and keep the current convention

- **Outcome** — Accepted the documented commit convention. Prepared the D-008 review from the pinned manifest, lockfile, and recorded migration verification.
- **Limitation** — D-008 review still needs approval. The historical frozen offline install does not establish fresh-clone setup.


## D-008 pnpm approval and foundation review close — 2026-11-09

- **Evidence status** — Evidence checked against the user's selection, manifest, lockfile, and recorded verification.
- **Human review** — Not requested for this log account.
- **Important user selection**

> Approve D-008 and retain the pnpm setup

- **Outcome** — Accepted D-008 and closed the individual foundation review. Seven accepted foundation decisions now have rationale and approval evidence, satisfying SC-20. The dated plan addendum and phase point to the pending first-slice contract review.
- **Limitation** — Fresh-clone verification and generated-client startup are still future checks. The application plan remains under review.

## Slice 001 approval and plan finalization — 2026-11-09

- **Evidence status** — Evidence checked against the user's selection, the approved slice document, decision register, and success checklist.
- **Human review** — Not requested for this log account.
- **Important user selection**

> Approve slice 001 scope and contracts as documented

- **Outcome** — D-012 records the approved scope and contracts. Slice 001 is Ready. The dated plan addendum is finalized and preserves the earlier planning text. The roadmap and phase point to the first slice and the later live qualification checkpoint.
- **Verification** — Checked decision approval evidence, plan and slice status, links and anchors, whitespace, and all 27 checklist entries. Source, tests, Prisma files, manifest and lockfile have no diff. PLAN.md remains untracked.
- **Limitations** — The checklist records remaining implementation and submission evidence. Application tests were outside this documentation review.


## Pipeline and slice task alignment — 2026-11-09

- **Evidence status** — Evidence checked against the user’s proposal, approved slice contracts, architecture and updated task records.
- **Human review** — Not requested for this log account.
- **Important user prompt excerpts**

> Should the deduplication and review flagging be inside the extraction step?

> Testing strategy is to add a testing task after the task

> The slices will be split to small tasks (You should note that)

- **Outcome** — Clarified the single shared ingestion flow, with extraction as one stage and domain deduplication and review policy in Listings. Recorded the task and testing sequence in D-013, the agent guide and slice 001. Interpreted the HTTP entry point “at the end” as the last implementation task within slice 001, consistent with D-012’s transport acceptance checks.
- **Limitation** — Task checks are planned. The pipeline and transport behavior await implementation.

## Phase-and-task delivery structure — 2026-11-09

- **Evidence status** — Evidence checked against the approved plan, the migrated contract and task records, and the documentation checks.
- **Human review** — Not requested for this log account.
- **Important user instruction excerpts**

> Remove the slice layer. Pair each implementation task with a focused testing task before starting dependent work.

> Detail Phases 01 and 02 now. Treat Phases 03–06 as candidate outcomes and refine their tasks after reviewing Phase 02 evidence.

- **Outcome** — D-014 records the phase-and-task structure. Phase 01 owns the shared contracts and CLI harness. Phase 02 owns offline extraction through CLI. Phase 03 carries the persistence, replay, HTTP and provider checks. The original planning text is retained and its estimates are historical.
- **Verification** — Checked active links and anchors, the eight migrated contract rows, ownership of the former slice checks, six roadmap phases, whitespace, and the application and Git boundaries. Application tests were outside this documentation task.

## Finalized plan checkpoint — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction, finalized plan and updated documentation.
- **Human review** — Not requested for this log account.
- **Important user instruction**

> Commit and update readme that the plan is finalized

- **Outcome** — README links to the finalized plan and its dated amendment. The authorized documentation checkpoint includes the original planning baseline, phase tasks, decision history, and success checklist.
- **Verification** — Checked documentation links and anchors, the README status, and whitespace before staging.

## Phase 01 task breakdown — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction, approved contract table and updated phase plan.
- **Human review** — Not requested for this log account.
- **Important user instruction**

> Split phase one to small tasks

- **Outcome** — Split Phase 01 into input validation, public result contracts, processor and extraction boundaries, the JSONL runner, and CLI command wiring. Each implementation task has a numbered testing task. The phase exit check covers the offline suite, type check, and build.
- **Verification** — Checked the five task/test pairs, preservation of the eight approved contract rows, local links, and whitespace. Implementation and its tests remain planned.


## Phase 01 task and test specifications — 2026-11-09

- **Evidence status** — Evidence checked against the task briefs, approved contracts and documentation checks.
- **Human review** — Not requested for this log account.
- **Important user instruction**

> Document the task and add their respective tests

- **Outcome** — Added implementation briefs and concrete input/expected-result cases for 01.1T–01.5T in the Phase 01 document. The user asked about the difference between written cases and executable Jest tests. This update documents the cases ahead of implementation and preserves the task-and-test sequence.
- **Verification** — Checked five task briefs and matching test sections, eight approved contract rows, local links, and whitespace. These are planned checks, with results to be recorded when the implementation runs.

## Phase 01 input validation — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction, approved task specification, implementation and test results.
- **Human review** — Not requested for this log account.
- **Important user instruction** — “Implement task 01.1 phase 1”
- **Outcome** — Added the shared input schema and inferred type in Messages, preserving the four strings and stripping extra keys. Added offline tests for required fields, types, empty values and timestamp validation.
- **Verification** — The focused suite passed all 9 tests; typecheck and build passed. The schema is not yet wired into ingestion; remaining Phase 01 tasks and exit checks are pending.

## Phase 01 result contracts — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction, task specification, brief, implementation and test results.
- **Human review** — Not requested for this log account.
- **Important user instruction** — “Implement next task”
- **Outcome** — Added public listing, message success and typed failure schemas with the approved error codes. Buyer requests and irrelevant messages require empty listing arrays.
- **Verification** — The focused suite passed all 5 tests; typecheck and build passed. Processing and the remaining Phase 01 tasks remain pending.

## Phase 01 processing boundaries — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction, task specification, implementation and test results.
- **Human review** — Not requested for this log account.
- **Important user instruction** — “Implement next task”
- **Outcome** — Defined the shared processor interface, generic gateway request and unknown response boundary, and strict single-listing extraction schema. Assertion field names remain strings for subsequent domain interpretation.
- **Errors and correction** — The initial focused test run failed to compile a parameterized test; corrected its table shape. See [E-002](DECISIONS.md#e-002-parameterized-test-table-failed-to-compile).
- **Verification** — The corrected focused suite passed 9 tests; typecheck and build passed. Source grounding and actual processing remain pending.

## Phase 01 JSONL runner — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction, task specification, implementation and test results.
- **Human review** — Not requested for this log account.
- **Important user instruction** — “Implement next task”
- **Outcome** — Added ordered JSONL processing with input validation, per-line errors and aggregate exit status. Unexpected processor exceptions become safe internal errors, allowing later records to continue.
- **Errors and correction** — The first focused run failed to compile the Jest mock due to an incorrect generic signature. Corrected the mock typing. See [E-003](DECISIONS.md#e-003-jest-mock-type-failed-to-compile).
- **Verification** — The corrected focused suite passed 6 tests; typecheck and build passed. CLI wiring remains pending.

## Phase 01 CLI and close-out — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction, phase checks, implementation and command results.
- **Human review** — Not requested for this log account.
- **Important user instruction** — “Implement next task”
- **Outcome** — Wired the JSONL command to a non-HTTP Nest context and an unavailable-provider processor. Recorded Phase 01 verification and partial success-criteria evidence.
- **Verification** — The focused CLI suite passed 5 tests. The full offline suite passed 37 tests with local socket access; typecheck and build passed. A direct built CLI invocation returned the expected provider-unavailable record and exit 1. The sandbox blocked the existing health test's loopback listener and blocked a nested subprocess in a test, so the production context was tested in-process and the built command separately.
- **Limitations** — Real extraction, persistence, HTTP parity and provider qualification remain pending.

## Phase 02 task and test breakdown — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction, approved Phase 01 policies, Phase 02 plan and existing schema and gateway contracts.
- **Human review** — Not requested for this log account.
- **Important user instruction** — “Let's split phase 2 tasks with its test cases”
- **Outcome** — Split Phase 02 into six task and test pairs covering response validation, verbatim evidence, field meaning, normalization, review and offline CLI integration. Kept the OPEN-04 review checkpoint and the approved single-sale scope.
- **Verification** — Checked task and test pairing, decision links and whitespace. The test cases are specifications for future implementation.

## Phase 02 extraction request and validation — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction, approved single-listing contract, implementation and focused test results.
- **Human review** — Not requested for this log account.
- **Important user instruction** — “Implement task **02.1&#xA0;**&#x20;” (as received).
- **Outcome** — Added an extraction service that submits the original text, domain instructions and a draft-7 JSON Schema derived from the Zod contract to an injected gateway. It returns a typed invalid-extraction failure for malformed or unsupported output.
- **Verification** — The focused suite passed 5 tests; typecheck and build passed. Provider compatibility, source grounding and production processor integration remain pending.

## Phase 02 verbatim evidence — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction, approved contract, implementation and focused test results.
- **Human review** — Not requested for this log account.
- **Important user instruction** — “Implement task **02.2&#xA0;**&#x20;” (as received).
- **Outcome** — Extraction retains exact source quotes and records rejected assertions with a reason. It compares the original strings without normalizing digits and retains repeated assertions.
- **Verification** — The evidence and extraction suites passed 8 tests; typecheck and build passed. Field meaning, readable review reasons and processor integration remain pending.
- **Follow-up instruction** — “Should we utilize this validation to separate its concern?”
- **Follow-up outcome** — Moved verbatim matching into a focused function in Extraction. The service delegates to it after parsing the gateway response. Both focused suites (8 tests) and typecheck passed again.

## Phase 02 field meaning — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction, approved first-listing policy, implementation and focused test results.
- **Human review** — Not requested for this log account.
- **Important user instruction** — “Implement task **02.3&#xA0;**&#x20;&#x20;**&#xA0;**” (as received).
- **Outcome** — Added conservative field-specific checks after verbatim matching. Unsupported assertions retain their evidence and a finding. The checks recognize selected explicit phrases and reject other phrasing for later review.
- **Verification** — The extraction suites passed 14 tests, including wrong fields, deposits, district/city confusion and an adjacent negation; typecheck and build passed.
- **Limitations** — Pattern checks cannot establish meaning in every context. Real-provider behavior, normalization, review reasons and integration remain pending.

## Phase 02 contextual evidence revision — 2026-11-09

- **Evidence status** — Evidence checked against the available user instructions, implementation and focused test output.
- **Human review** — Requested for the attribution of E-004 and E-005; confirmation is not recorded.
- **Important user prompts** — “Explain this task. Didn't we say that we are going to make the solution general, not focused only on the 10 examples?” and “Add to decistions: *where the agent got something wrong*, how you caught each one and what you changed from this.” The user subsequently instructed “PLEASE IMPLEMENT THIS PLAN” for the one-call contextual evidence plan.
- **Outcome** — Recorded [D-015](DECISIONS.md#d-015-use-one-extraction-call-with-contextual-evidence-checks), [E-004](DECISIONS.md#e-004-whole-quote-patterns-rejected-supported-evidence), and [E-005](DECISIONS.md#e-005-a-trailing-price-qualifier-was-missed). Revised extraction instructions and drafted contextual checks. The earlier two-call proposal was replaced by the approved one-call plan.
- **Verification** — Three focused extraction suites passed 18 tests, and typecheck and build passed. The initial revised test run caught Arabic negation and boundary errors, which were corrected before that pass.
- **Limitations** — Context association needs further review; tests do not establish accuracy on unseen messages. Normalization and integration remain pending.

## Phase 02 independent normalization — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction, approved Phase 02 rules, implementation and focused command results.
- **Human review** — Not requested for this log account.
- **Important user instruction excerpts** — “Implement 02.4 in Listings while 02.3 is in progress. Use fixtures that represent already-supported `{ field, quote }` assertions” and “Record integration as pending until the boundary test passes.”
- **Outcome** — Added independent normalization, evidence-preserving findings and area priority selection. Competing values remain available for 02.5.
- **Verification** — The focused normalization suite passed 11 tests; typecheck and build passed.
- **Limitations** — 02.3 is still in progress, so integration and its mixed-outcome test remain pending. Quotes missing necessary qualifiers cannot be interpreted by the normalizer; the handoff needs review. Location normalization remains pending.

## Phase 02 normalization follow-up — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction, implementation and focused command results.
- **Human review** — Not requested for this log account.
- **Important user instruction** — “Implement” in response to the proposed normalizer improvements.
- **Outcome** — Added attached-unit handling, negotiable price support, per-area price rejection and conservative explicitly labelled location parsing.
- **Verification** — The focused normalization suite passed 17 tests; typecheck and build passed.
- **Limitations** — Extraction's clipped-qualifier handoff and the CLI integration remain pending 02.3T and later phase tasks. Location support is limited to colon-labelled names.

## Normalization error records — 2026-11-09

- **Evidence status** — Evidence checked against the available conversation, brief, implementation and recorded focused test results.
- **Human review** — Not requested. The available conversation attributes detection of the specific defects to the agent's inspection following the user's request for a brief comparison.
- **Important user instruction** — “Record this as *the agent got something wrong*, how you caught each one and what you changed.”
- **Outcome** — Recorded [E-006](DECISIONS.md#e-006-normalizer-rejected-common-supported-formats) for rejected supported formats and [E-007](DECISIONS.md#e-007-a-per-area-rate-could-become-a-total-price) for an unsafe per-area price. Both records describe detection, correction, verification and limits.
- **Limitation** — E-007's clipped-qualifier handoff remains unresolved and integration is pending 02.3T.

## Phase 02 revise 02.3 meaning in one model call — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction, implementation, phase plan, decision records, and focused test results.
- **Human review** — Not requested for this log account.
- **Important user prompt** — “Agent implementation plan — Revise 02.3 to verify meaning in one model call\nUse the same model call to propose evidence and assess whether it supports the claimed field. Remove the field cue patterns and let application code verify source integrity. Keep the single-sale scope and the existing { field, quote } handoff to 02.4.\n1. Define a private gateway response for extraction and assessment...\n2. Give the model explicit assessment instructions...\n3. Replace the context verifier with mechanical checks...\n4. Preserve the handoff and findings...\n5. Verify mechanics offline and meaning with a live provider...\n6. Record the design change and evidence. Update 02.3 and 02.3T in the phase plan. Once this design is approved, record the decision that supersedes D-015’s deterministic meaning checks. Preserve the earlier test results as historical evidence and update the AI log and error records with the actual verification results.\nThe tradeoff is that the model assesses its own extraction in one call. A verdict of supported is a model judgment backed by source-checked evidence. Accuracy on unseen messages remains a live qualification criterion.”
- **Outcome** — Implemented single-call evidence proposal and meaning assessment. Defined private gateway response schema with `{ field, quote, verdict, context_quote }` validated at runtime, keeping extra fields internal to Extraction. Replaced pattern and keyword lists in application code with mechanical source integrity checks: exact quote presence in source, verbatim context quote containment, token boundary clipping enforcement (including cuts through decimal and grouping/thousands separators), and occurrence disambiguation. Preserved `{ field, quote }` handoff to 02.4 for supported assertions; retained contradicted, uncertain, and mechanically rejected assertions as findings with reasons. Recorded [D-016](DECISIONS.md#d-016-verify-meaning-in-one-model-call-with-mechanical-source-integrity-checks) (superseding [D-015](DECISIONS.md#d-015-use-one-extraction-call-with-contextual-evidence-checks)), updated 02.3 and 02.3T in the phase plan, and updated error records [E-004](DECISIONS.md#e-004-whole-quote-patterns-rejected-supported-evidence) and [E-005](DECISIONS.md#e-005-a-trailing-price-qualifier-was-missed).
- **Verification** — `corepack pnpm exec jest --runInBand --runTestsByPath test/extraction-field-meaning.spec.ts test/extraction-evidence.spec.ts test/extraction.service.spec.ts` passed 21 tests; all 10 test suites (80 tests) passed offline; `pnpm run typecheck` and `pnpm run build` passed cleanly.
- **Limitations** — A verdict of supported is a model judgment backed by source-checked evidence. Accuracy on unseen messages remains a live qualification criterion in Phase 03. Normalization integration and end-to-end CLI integration remain pending 02.5 and 02.6.

## Phase 02 mechanical verification fixes — 2026-11-09

- **Evidence status** — Evidence checked against the user review prompt, implementation, decision register, and focused test results.
- **Human review** — Requested for [E-008](DECISIONS.md#e-008-mechanical-verifier-permitted-false-acceptances-on-context-mismatch-trimmed-context-and-signed-numbers).
- **Important user prompt** — “[P1] Tie the context quote to the occurrence that passes the token check — verify-source-integrity.ts (line 123) ... For Deposit: 150,000 SAR; asking price: 50,000 SAR, a supported assertion quoting 50,000 SAR with context Deposit: 150,000 SAR passes ... [P2] Check context verbatim before using it as evidence — verify-source-integrity.ts (line 92) ... The verifier trims context_quote before checking source presence ... [P2] Include signs in numeric token boundaries — verify-source-integrity.ts (line 35) ... A quote of 50,000 SAR from -50,000 SAR passes the mechanical check ... The clipped rate case 2,500 SAR from 2,500 SAR/sqm also remains unprotected if the model marks it supported.”
- **Outcome** — Strengthened mechanical source integrity checks in `verifySourceIntegrity`:
  1. Restricted quote candidate evaluation to occurrences contained within `context_quote` whenever context is supplied, ensuring an assertion cannot match an unrelated unclipped occurrence outside the supplied context.
  2. Evaluated `context_quote` verbatim without trimming; any whitespace mismatch, empty, or whitespace-only context is rejected with `context_not_in_source`.
  3. Included signs (`+`, `-`, `\u2212`) in numeric token boundaries to prevent quotes that strip leading signs.
  4. Added compound unit boundary checks for `/` (e.g. `SAR/sqm`) to reject quotes that clip off rate suffixes.
  Recorded [E-008](DECISIONS.md#e-008-mechanical-verifier-permitted-false-acceptances-on-context-mismatch-trimmed-context-and-signed-numbers) in the decision register.
- **Verification** — Expanded `test/extraction-field-meaning.spec.ts` with 8 new regression tests. `corepack pnpm exec jest --runInBand --runTestsByPath test/extraction-field-meaning.spec.ts test/extraction-evidence.spec.ts test/extraction.service.spec.ts` passed 34 tests; full offline suite passed 88 tests across 10 test suites; `pnpm run typecheck` and `pnpm run build` passed cleanly.
- **Limitations** — Does not evaluate model judgment accuracy on unseen messages (reserved for live qualification in Phase 03). Downstream normalization integration remains pending.

## Phase 02 field resolution and review — 2026-11-09

- **Evidence status** — Evidence checked against user prompt, approved contracts, implementation, and focused test results.
- **Human review** — Not requested for this log account.
- **Important user prompt** — “Implement task 02.5”
- **Outcome** — Implemented listing field resolution and review derivation in Listings (`resolveListing` and `ListingsService`). Resolved supported values into public fields, left missing or conflicting fields null, preserved competing evidence, respected land field inapplicability (omitting missing reasons for bedrooms and bathrooms on land), and derived readable review reasons and `needs_review = review_reasons.length > 0`.
- **Verification** — `corepack pnpm exec jest --runInBand --runTestsByPath test/listings-resolution.spec.ts` passed 9 tests covering complete listings, missing/unsupported fields, inapplicable land fields, conflicting prices, conflicting areas, priority area selection, unsupported currency, duplicate assertions, and service composition. Full offline suite passed 97 tests across 11 test suites; `pnpm run typecheck` and `pnpm run build` passed cleanly.
- **Limitations** — Extraction and Listings composition behind `MessageProcessor` and CLI remains task 02.6. Persistence and live qualification carry forward to Phase 03.

## Phase 02 resolution follow-up — 2026-11-09

- **Evidence status** — Evidence checked against user prompt, implementation, decision register, and focused test results.
- **Human review** — Requested for [E-009](DECISIONS.md#e-009-listing-resolver-nullified-verified-asking-price-on-rejected-deposit-and-defaulted-category-on-conflicting-property-types).
- **Important user prompt** — “Resolve this\n[P2] Keep the verified asking price when a deposit is rejected — resolve-listing.ts (line 164)\nA verified 3.2M SAR asking price becomes null and receives price_conflict if Extraction also rejects deposit 50,000 SAR as price evidence. The deposit supplies no competing asking price. Keep the verified amount and retain the rejected assertion in the evidence.\n[P2] Resolve the area only when the property category supports the selection — resolve-listing.ts (line 137)\nWhen supported property-type assertions say both villa and land, the resolver correctly leaves property_type null but applies the built-property area priority. With 380 sqm built-up and 450 sqm land, it publishes 380 even though the unresolved type determines which area applies. Leave the area null with a review reason when the category changes the selection.”
- **Outcome** — Fixed two resolution edge cases in `resolveListing`:
  1. Kept unambiguous verified asking prices even when a rejected deposit assertion is preserved in evidence, avoiding false `price_conflict`.
  2. Compared area selections under both land and built priorities when `property_type` is unresolved; if the category changes the selected area value, left `area_sqm = null` and added `area_sqm_conflict` to `review_reasons`.
  Recorded [E-009](DECISIONS.md#e-009-listing-resolver-nullified-verified-asking-price-on-rejected-deposit-and-defaulted-category-on-conflicting-property-types) in the decision register.
- **Verification** — Added two regression tests to `test/listings-resolution.spec.ts`. Focused suite passed all 11 tests; full offline test suite passed 99 tests across 11 test suites; `pnpm run typecheck` and `pnpm run build` passed cleanly.
- **Limitations** — Processor and CLI integration remain task 02.6.

## Evidence-backed normalization plan — 2026-11-09

- **Evidence status** — Evidence checked against the user prompts, candidate brief, D-016, current handoff and phase plan.
- **Human review** — Not requested for the log account. Decision approval is pending separately.
- **Important user prompts** — “I want to follow the [task-brief.md](docs/task-brief.md). Shouldn't the llm detect that?” and “Make a plan to make these changes”
- **Outcome** — Recorded [D-017](DECISIONS.md#d-017-carry-evidence-backed-field-interpretations-into-normalization) and the proposed Phase 02 revisions. The model would identify field meaning with evidence in one call. Listings would validate and normalize grounded tokens. Phase 02 would exercise the revised handoff through offline CLI fixtures.
- **Verification** — Compared the proposed work with SC-08, SC-09, SC-11 and SC-13 and the current gateway and downstream assertion schemas. The preceding review reproduced sign loss, recurring-rate promotion and currency-first rejection through source checks and normalization. No implementation tests were run for this planning entry.
- **Limitations** — Implementation and runtime validation depend on approval. Rental and currency-less price policy and live semantic evaluation remain separate checkpoints.

## Evidence-backed normalization implementation — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction and focused checks.
- **Human review** — Not requested.
- **Important user prompt** — “PLEASE IMPLEMENT THIS PLAN” followed by the Evidence-backed normalization and architecture update plan.
- **Outcome** — Accepted D-017, documented the planned handoff and module responsibilities in the architecture, and began the work by handling currency-first SAR amounts and rejecting negative, yearly and per-area examples in the existing price normalizer.
- **Verification** — `pnpm exec jest --runInBand --runTestsByPath test/listings-normalization.spec.ts` passed 22 tests. Typecheck and build passed. The full suite passed 103 of 104 tests; the HTTP liveness test could not bind to loopback in the sandbox (EPERM).
- **Limitations** — The structured handoff, location handling, processor integration and full acceptance checks remain pending. The architecture describes the handoff as in progress.

## Phase 02.5 resolver corrections — 2026-11-09

- **Evidence status** — Evidence checked against the user instruction, implementation and focused checks.
- **Human review** — Not requested.
- **Important user prompt** — “PLEASE IMPLEMENT THIS PLAN” followed by “Phase 02.5 resolver corrections”.
- **Outcome** — Recorded D-018 and updated uncertainty reasons, area metadata and room applicability.
- **Verification** — The focused resolver suite passed 15 tests. Typecheck and build passed.
- **Limitations** — The D-017 handoff and CLI integration remain pending. Price-period comparison carries forward to rental support.

## Phase 02 CLI integration (Task 02.6) — 2026-11-09

- **Evidence status** — Evidence checked against user prompt, phase plan, contracts, implementation and test results.
- **Human review** — Not requested for this routine implementation entry.
- **Important user prompt** — “implement task 02.6”
- **Outcome** — Composed `ExtractionService` and `ListingsService` behind `ListingMessageProcessor` in `MessagesModule`. Wired `LLM_GATEWAY` token and unconfigured fallback gateway in `LlmGatewayModule`, propagating `provider_unavailable` when unconfigured. Serialized public listing results through the CLI with `duplicate_of: null`. Created focused integration and processor tests (`test/cli-integration.spec.ts` and `test/listing-message-processor.spec.ts`) covering single Arabic sale with review reasons, two independent sales in input order, continuation after malformed extraction envelope with exit 1, continuation after invalid JSONL line, and processor unit delegation.
- **Verification** — Focused tests passed 7 tests; full offline test suite passed 115 tests across 13 test suites (`corepack pnpm test`); `corepack pnpm run typecheck` and `corepack pnpm run build` passed cleanly; compiled CLI invocation (`node dist/cli.js process <fixture>`) verified clean stdout and exit codes.
- **Limitations** — Offline checks use test-supplied gateways. Persistence, replay, HTTP parity and live provider qualification carry forward to Phase 03.
