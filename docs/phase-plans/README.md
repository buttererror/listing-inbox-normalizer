# Phase plans

Phases refine the [roadmap](../roadmap.md) shortly before implementation. Keep future phases lightweight. Each phase links its slice records and governing [decisions](../DECISIONS.md).

## Index

- [01: First listing flow](01-first-listing-flow.md) — Draft, awaiting scope review.

## Phase format

```text
# NN: Outcome
Status: Draft | Active | Verified | Closed
Approval evidence: Pending, or user instruction/excerpt.
Goal and requirement references: Observable result and brief sections.
Success-criteria IDs: Links to the canonical checklist and affected criteria.
Current state: Relevant implemented behavior and remaining gap.
Included / deferred: Concrete boundaries.
Governing decisions: Accepted IDs and unresolved proposals with checkpoints.
Slices: Links to individually scoped slice records; approve incrementally.
Exit criteria: Observable behavior and verification required for phase completion.
Close-out: Review affected success criteria and carry remaining work to the roadmap;
  record evidence, limitations, and decisions resolved or handed forward.
```

A phase can be approved while later slices remain drafts. Verified means its exit checks passed; Closed records explicit acceptance of the outcome. Neither status implies commit authorization or AI-log review.
