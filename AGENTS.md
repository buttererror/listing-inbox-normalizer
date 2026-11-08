# Agent instructions

## Project contract

- Follow the [assessment brief](docs/task-brief.md), [architecture](docs/architecture.md), and [decision register](docs/DECISIONS.md). Distinguish implemented behavior from proposals.
- Preserve the existing PLAN.md and its pre-implementation content. It remains untracked pending user finalization before the next commit; do not rewrite it retrospectively to match delivered work. Record later choices and deviations in the decision register.
- Never invent facts. Unsupported values remain null. Preserve evidence, qualifiers, and uncertainty; validate model output at runtime and verify evidence and property association.
- Respect the five module responsibilities in the architecture document. HTTP and CLI share processing; domain prompts and schemas belong to Extraction, generic provider execution to the gateway.
- Keep automated tests offline with isolated temporary SQLite databases. Live-provider evaluation is separate and does not replace behavior tests. Avoid secrets.

## Commands

Node.js 24 and pnpm 10.28.2 are required. Install with `corepack pnpm install --frozen-lockfile`. Use `pnpm start`, `pnpm run start:dev`, `pnpm run build`, `pnpm run typecheck`, and `pnpm test`. Database generation and migration scripts are prepared but domain schema work is deferred.

## Working agreements

- Inspect relevant code and tests before changing or describing behavior. Keep changes small and verify the affected boundary.
- Follow the [commit convention](docs/commits.md). Commit only with explicit authorization; never infer push authorization.
- Keep project rules separate from personal preferences. Keep transient status in README and use the [documentation index](docs/README.md) for navigation.
- Update the [AI log](docs/AI_LOG.md) for significant sessions using its entry format and review policy. Paraphrased objectives alone do not satisfy the prompt requirement. Do not reconstruct unavailable prompts or manufacture mistakes.

## Decision review

- Present meaningful architecture, scope, API/data-contract, dependency, testing-policy, and workflow choices to the user before implementing the affected choice. Use the [decision format](docs/DECISIONS.md#decision-format): context, alternatives/tradeoffs, recommendation and rationale, consequences, validation, review checkpoint, and approval evidence.
- Record new choices as Proposed. Mark Accepted only after explicit user approval, quoting the approval or referencing the approved instruction/plan. A direct user instruction selecting a choice is approval for that choice; do not request it again.
- Continue independent authorized work while a proposal is pending. Routine implementation details within an approved decision do not need a separate decision record.
- D-001 through D-008 are Proposed pending the user's consolidated review during planning and before plan finalization. Retain implemented behavior and historical supersession notes; do not treat this status change as a request to revert code. D-009 remains explicitly Accepted. Review governing choices before dependent slice implementation.
- Preserve rejected and superseded decisions with their history. Missing historical rationale or approval must be identified for review.

## AI evidence and review

- Record significant implementation sessions, consequential planning, meaningful user corrections, and model experiments in the [AI log](docs/AI_LOG.md). Use its compact format and six-point evidence checklist; preserve actual important prompts and label excerpts and paraphrases accurately.
- Track Evidence status (Unchecked, Evidence checked, or Needs clarification) separately from Human review (Not requested, Requested, or Confirmed). Evidence checked means comparison with available sources, not independent verification or user approval; Confirmed requires explicit user confirmation and its source.
- Request targeted human review for uncertain attribution, disputed accounts, important user-caught mistakes, or ambiguity materially affecting the assessment narrative. Routine log entries do not block commits solely for lack of user review. Decision approval, evidence checking, human review, and commit authorization remain separate.
- Record genuine agent errors in the [decision register](docs/DECISIONS.md#agent-error-records), including who detected each incident, evidence, correction and verification. Link the session log, preserve user correction prompts when available, and never invent examples. Environment restrictions and reasonable alternatives are not automatically errors.
- Present user-caught incidents as a short digest: error ID, issue, user detection, correction and specific unresolved question. Do not request review of the whole log when only one detail needs clarification.

## Planning checkpoints

- Before the next commit, surface the draft plan's finalization status. The current authorization excludes PLAN.md from commits until the user explicitly changes it.
- Follow accepted D-009: preserve the original plan as historical evidence; use the [roadmap](docs/roadmap.md) for evolving phase sequencing, [phase plans](docs/phase-plans/README.md) for near-term outcomes, and [slice records](docs/slices/README.md) for implementation scope and evidence.
- Once a slice is approved, implement its smallest end-to-end behavior with acceptance checks. Link governing decisions and record scope changes as new proposals; do not silently broaden the slice.
- Keep document status and implementation status distinct: a reviewed plan does not prove that its functionality exists.

## Phase and vertical-slice workflow

1. Read the root [plan](PLAN.md), relevant [success criteria](docs/success-criteria.md), roadmap and governing accepted/open decisions. Refine only the next phase; leave later phases as candidate outcomes.
2. Draft the phase using the phase format, then propose its smallest useful vertical slice using the slice format. A slice delivers observable behavior across the necessary modules and entry points, with verification; avoid a sequence of disconnected infrastructure layers.
3. Resolve governing consequential decisions with the user. Record explicit scope approval in the slice; an approved instruction already grants that approval. Do not treat roadmap placement alone as implementation authorization.
4. Implement the approved slice and its meaningful tests. Keep model execution and persistence boundaries testable offline; record separate live-provider evidence when relevant.
5. Update slice evidence, limitations, affected success-criteria coverage and dated evidence, relevant decisions, and AI logs in the same session. Mark Verified only after acceptance checks pass; describe failures or blocked checks honestly.
6. Close the phase by reviewing covered success criteria and checking its exit criteria and resolving, superseding, or carrying each open decision into the next phase with an explicit checkpoint. Then propose the next slice.

Keep phase status separate from commit status and AI-log review. Verification does not authorize commits or mark logs Reviewed. Maintain one owner per fact: roadmap for sequence/status, phase for outcomes/exit criteria, slice for task evidence, decision register for choices, AI log for prompts and supervision. Link rather than duplicate.

Before implementation, link each slice to the criteria it advances and show how acceptance checks demonstrate them. At plan finalization and submission, review the complete checklist, including documentation and agent evidence. Record regressions and incomplete checks explicitly.
