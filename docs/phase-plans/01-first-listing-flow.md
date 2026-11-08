# 01: First listing flow

- **Status:** Draft.
- **Approval evidence:** Pending. D-009 approves this planning structure, not this phase's detailed scope.
- **Goal:** Demonstrate one listing through the shared processor with source-backed fields, persisted state, and equivalent CLI/HTTP results.
- **Requirements:** [Brief](../task-brief.md): CLI, HTTP ingestion, embedded persistence, extraction, normalization, review flagging, and minimum output contract.
- **Success criteria:** [SC-01–SC-05, SC-07–SC-09, SC-11 and SC-13](../success-criteria.md#brief-requirements). This phase advances relevant parts; it does not by itself complete the full criteria.
- **Current state:** Modules and bootstraps exist; processor, contracts, domain persistence, and provider adapter remain unimplemented.
- **Proposed included scope:** One supported listing path connecting the configured model gateway, domain checks, SQLite, CLI and HTTP. Offline tests control the model boundary; a separate live synthetic case checks the real adapter. Listing retrieval exposes persisted results.
- **Deferred coverage:** Broader classification/segmentation, project qualifiers, cross-broker duplicates and full approval workflow are later candidate phases. The final assessment still requires them.
- **Governing choices:** Existing stack/module decisions and D-009. OPEN-01, OPEN-02, OPEN-04, OPEN-05, OPEN-07 and OPEN-08 need review to the extent this slice depends on them; do not silently resolve them in code.
- **Next planning action:** Discuss and approve the minimum contracts, evidence policy and scope; then create the first slice using the [slice format](../slices/README.md). No implementation slice is authorized by this draft.
- **Proposed exit criteria:** Supported input yields required output with unsupported fields null and review reasons; a fresh context can retrieve persisted state; CLI stdout contains only result records; HTTP/CLI behavior agrees; offline tests pass and a separate live smoke test has recorded limits.
- **Close-out:** Pending.
