# Agent instructions

## Project contract

- Follow the [assessment brief](docs/task-brief.md), [architecture](docs/architecture.md), and [decision register](docs/DECISIONS.md). Distinguish implemented behavior from proposals.
- Preserve the existing PLAN.md and its pre-implementation content. The dated amendment records the finalized phase-and-task plan. Record later choices and deviations in the decision register.
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
- The individual foundation review is complete. D-001 and D-003 through D-014 are Accepted. D-002 is Superseded. Review the open policies governing each phase before dependent implementation.
- Preserve rejected and superseded decisions with their history. Missing historical rationale or approval must be identified for review.

## AI evidence and review

- Record significant implementation sessions, consequential planning, meaningful user corrections, and model experiments in the [AI log](docs/AI_LOG.md). Use its compact format and six-point evidence checklist; preserve actual important prompts and label excerpts and paraphrases accurately.
- Track Evidence status (Unchecked, Evidence checked, or Needs clarification) separately from Human review (Not requested, Requested, or Confirmed). Evidence checked means comparison with available sources, not independent verification or user approval; Confirmed requires explicit user confirmation and its source.
- Request targeted human review for uncertain attribution, disputed accounts, important user-caught mistakes, or ambiguity materially affecting the assessment narrative. Routine log entries do not block commits solely for lack of user review. Decision approval, evidence checking, human review, and commit authorization remain separate.
- Record genuine agent errors in the [decision register](docs/DECISIONS.md#agent-error-records), including who detected each incident, evidence, correction and verification. Link the session log, preserve user correction prompts when available, and never invent examples. Environment restrictions and reasonable alternatives are not automatically errors.
- Present user-caught incidents as a short digest: error ID, issue, user detection, correction and specific unresolved question. Do not request review of the whole log when only one detail needs clarification.

## Planning and phase tasks

- Preserve the original plan as historical evidence. Use the [roadmap](docs/roadmap.md) for phase order and [phase plans](docs/phase-plans/README.md) for tasks, exit checks and evidence. D-014 governs this structure. Obtain explicit authorization before committing PLAN.md.
- Start planning with the root [plan](PLAN.md), relevant [success criteria](docs/success-criteria.md), roadmap and governing decisions. Refine only the near-term phases. Leave later outcomes as candidates.
- Resolve consequential choices with the user and record approval before dependent implementation. Implement the authorized tasks in order. Follow each with focused verification under D-013, then continue dependent work.
- Keep model execution and persistence testable offline. Record live-provider evidence separately. Integrate Antigravity through the verified baseline CLI in Phase 02.0 under D-023. Resolve OPEN-01 and OPEN-08 before untrusted input. Pair each Phase 02 task with offline verification and a separate manual live CLI check. Use Phase 03 for independent provider evaluation. Verify HTTP and SQLite offline in Phase 04.
- Record task outcomes, checks, limitations, dated criteria evidence and significant prompts. Mark a phase Verified after its exit checks pass. Review affected criteria and carry remaining decisions and checks forward at close-out. Keep verification, user review and commit authorization separate.
- At plan finalization and submission, review the complete success checklist, including documentation and agent evidence.
