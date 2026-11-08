# Decisions

## Proposed — pending consolidated review

D-001 through D-008 are Proposed at the user's request. Existing implementation is retained; implementation status does not establish decision approval. Review these records as planning progresses and reconcile them before finalizing the plan. Resolve any decision needed for the next slice before implementing work that depends on it.

- D-001: TypeScript, NestJS, SQLite, Prisma, and Zod provide the agreed application stack.
- D-002: npm and a lockfile were initially selected. Historical alternative previously superseded by D-008; retained as Proposed for consolidated review, not as the current package manager.
- D-003: HTTP and a future CLI share Nest application modules; provider execution is deferred.
- D-004: CommonJS is used across TypeScript, Jest, and the future Prisma client.
- D-005: The health endpoint reports application liveness; it does not imply extraction or database readiness.

- D-007: Follow Conventional Commits with optional responsibility-based scopes and coherent changes that include their tests and documentation. See the [commit convention](commits.md). This keeps assessment history reviewable without adding commit-hook tooling.

- D-006: Pin the Multer transitive dependency to 2.5.0 through a package-manager override to address the production advisory detected during setup; reassess the override when upgrading Nest.

- D-008: Use pnpm 10.28.2 through Corepack and a pnpm lockfile for reproducible installs; retain the Multer override and explicitly allow required native build scripts.

## Open

- Extraction and persistence contracts, review policies, deduplication thresholds, and provider execution isolation remain to be decided. See the local draft `PLAN.md` for the initial checkpoints.


## Earlier architecture discussion (supplied handoff summary)

This evidence is a user-supplied summary, not an exported GPT transcript. Original prompts are unavailable. The following directions were adopted during that discussion: LLM-first interpretation for broader language coverage; deterministic normalization and validation for source fidelity; NestJS for developer familiarity; Prisma with embedded SQLite; an embedded reusable gateway with standalone deployment deferred; one provider first and UI deferred to protect the assessment budget. Antigravity subsequently became the first provider candidate after a successful smoke test; its adapter remains unimplemented.

## Open policy checkpoints

All entries below are proposals, not implemented behavior. Resolve them in this register before the affected feature; the local draft plan retains its original checkpoint labels.

| ID | Question | Review checkpoint |
| --- | --- | --- |
| OPEN-01 | Runtime failures and CLI error results | Before processor implementation |
| OPEN-02 | Land versus built-up area projection | Before normalized contracts |
| OPEN-03 | Project ranges and starting prices | Before extraction schema |
| OPEN-04 | Evidence and permitted inference | Before evidence validation |
| OPEN-05 | Applicable missing-field rules | Before review policy |
| OPEN-06 | Duplicate confidence thresholds | Before deduplication |
| OPEN-07 | Replay and approval semantics | Before persistence integration |
| OPEN-08 | Provider execution isolation | Before untrusted live input |

## Decision format

Use this format for new consequential decisions. Historical entries remain historical summaries; D-001 through D-008 await consolidated review.

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

### D-009: Separate the baseline plan from the evolving roadmap

- **Status:** Accepted — 2026-11-08.
- **Context:** The brief requires preservation of the pre-implementation plan. The user wants to derive phases and vertical slices as implementation proceeds and finalize the draft before the next commit.
- **Options and tradeoffs:** Evolve one plan in place for simplicity, which risks obscuring the original baseline; or retain that baseline and maintain a separate roadmap, which adds one document but preserves traceability.
- **Recommendation and rationale:** Preserve the original plan and derive an evolving roadmap with phases and small end-to-end slices. Record deviations in this register.
- **Consequences:** Roadmap details can change without rewriting the assessment evidence. The [roadmap](roadmap.md) owns evolving sequencing; [phase plans](phase-plans/README.md) and [slice records](slices/README.md) refine work just before implementation.
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

### Unconfirmed candidate: Earlier GPT extraction strategy challenge

- **Status:** Needs clarification; not counted toward the three required incidents.
- **Evidence:** The supplied handoff summarizes that the earlier assistant initially favored rules and regex and the user emphasized generalization. It is a second-hand summary, not the original exchange.
- **Missing evidence:** Original prompt/context and what specifically was incorrect or changed. A reasonable disagreement alone is not a mistake. Request the user's account only if needed to assess this candidate; do not reconstruct the missing transcript.
