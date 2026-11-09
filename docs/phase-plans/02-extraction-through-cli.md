# 02 — Extraction through CLI

**Status** — Planned. Start after Phase 01 verification and implementation authorization.

Verify classification, extraction and normalization for one supported sale listing per message through the CLI. Use the [approved contracts](01-contracts-and-cli.md#approved-contract-and-policy-choices) and an offline test gateway. Both the one-line and multi-line fixtures use the same JSONL input shape.

**Criteria advanced** — SC-01, SC-06–SC-09, SC-11, SC-13 and PC-01. See the [success checklist](../success-criteria.md#brief-requirements) for full acceptance conditions.

| Task | Implementation outcome | Focused testing task |
| --- | --- | --- |
| 02.1 — Classification, extraction and evidence | Use a controlled gateway fixture to exercise single-listing classification, strict schema validation, and exact source quotes with field-specific grounding. | Reject an invalid envelope and unsupported listing counts. Check that invented quotes and quotes used in the wrong context leave affected fields null with review reasons. |
| 02.2 — Normalize and explain | Derive supported normalized values and readable review reasons from grounded assertions. | Check an Arabic or mixed fixture and an independent sale example. Cover Arabic-Indic and decimal prices, Saudi contact format, missing fields, and conflicting assertions. |
| 02.3 — Offline CLI integration | Exercise the shared processor with test dependencies and serialize the public result. Preserve `duplicate_of: null` for this first path. | Check the full result shape for one-line and multi-line fixtures, including Arabic or mixed text and an independent sale example. Verify stdout and the failure exit status. |

## Exit check

The offline CLI path demonstrates grounded and normalized listing results and readable reasons for unsupported values. Run the offline suite, type check, and build. Record the results and update affected success criteria. Persistence, replay, HTTP parity and live qualification have [separate acceptance checks](../roadmap.md#phase-03-carryover-checks). Verification evidence is pending.
