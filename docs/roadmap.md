# Development roadmap

Strategy: [D-009](DECISIONS.md#d-009-separate-the-baseline-plan-from-the-evolving-roadmap). Requirements: [candidate brief](task-brief.md). The original PLAN.md remains an untracked baseline awaiting user finalization; this roadmap records evolving sequencing and never replaces that evidence.

## Current state

The stack is implemented and its foundation checks passed. Documentation organization and pnpm migration are present in the working tree. Their log entries require evidence checks and targeted user review where applicable; the original plan remains excluded from commits. Domain behavior is not implemented.

## Candidate phases

Only the strategy is accepted. The following sequence is a proposal for refinement, not approval to implement all listed work. Refine one phase at a time and budget against the brief's approximate five focused hours; elapsed focused time has not been tracked exactly.

| Phase | Observable outcome | Status / details |
| --- | --- | --- |
| Foundation | HTTP liveness and reusable application context; offline tests and SQLite driver work | Implemented; documentation/evidence checks and plan finalization remain |
| 01: First listing flow | One supported listing travels through extraction, validation, normalization and SQLite to equivalent CLI/HTTP results; persisted review state is queryable | [Draft phase](phase-plans/01-first-listing-flow.md) |
| 02: Broader message coverage | Classification, multiple properties, Arabic/mixed text, projects, ambiguity and contradictions follow the required contract | Candidate; refine after phase 01 |
| 03: Property identity and review | Cross-broker reposts, similar distinct properties and human approval behave consistently | Candidate; refine after phase 02 |
| 04: Submission readiness | Clean setup, hidden-message readiness, independent model evaluation, documentation and agent evidence are demonstrated | Candidate; includes assessment deliverable audit |

## How this roadmap evolves

Use [phase plans](phase-plans/README.md) to define outcomes and exit criteria, and [slice records](slices/README.md) to scope the next end-to-end change. Record approval where it occurs. Revisit sequencing with the user when a discovery materially changes scope or priorities. Keep unfinished work explicit; avoid optional UI, additional providers, or standalone gateway deployment until core assessment behavior is complete.
