# Vertical slices

A slice is one reviewable observable capability across the necessary application boundaries. Related tests and documentation belong with it. Use stable names such as `001-first-listing.md`; keep records small and linked from their governing phase. No slices have been approved yet.

## Slice format

```text
# NNN: Observable capability
Phase: Link to the governing phase.
Status: Draft | Ready | In progress | Verified | Done
User outcome: Trigger and visible result.
Scope / deferred: Included behavior and explicit boundaries.
Governing decisions: Accepted IDs; pending choices and dependencies.
Success-criteria IDs: Links to the canonical checklist and criteria advanced.
Acceptance checks: Inputs, observable results, failure cases, and how each check demonstrates coverage.
Verification boundary: Offline doubles, temporary persistence, entry-point checks;
  separate live-model check if applicable.
Approval evidence: User instruction/excerpt approving scope.
Implementation evidence: Actual changes, commands/results, limits, and commit if one exists;
  update affected checklist coverage with dated evidence, regressions and incomplete checks.
Decision/log references: Links to canonical records.
```

Draft is a proposal. Ready requires scope approval and resolution of blocking decisions. In progress means authorized implementation has begun. Verified requires the acceptance checks to pass, with limitations reported. Done records the user's acceptance of the delivered slice; user acceptance may occur in the same instruction as another authorized action. Commit status and AI-log review remain separate.
