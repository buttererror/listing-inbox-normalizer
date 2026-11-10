# Dwelleo — Listing Inbox Normalizer

Dwelleo turns unstructured Saudi real-estate broker messages into structured listing records. It handles Arabic, English, and mixed-language messages, including Arabic-Indic digits, sales and rentals, multiple offers, off-plan projects, buyer requests, and unrelated messages.

The CLI processes JSONL files and emits **one JSON result per nonblank input line, in input order**. A table view is available for manual review. The HTTP service exposes liveness (`GET /health`), persistent single-message ingestion (`POST /messages`), and listing reads (`GET /listings`); approval and deduplication are planned for subsequent tasks.

> **Current stage:** Phase 03 extraction and independent evaluation completed (November 10, 2026). Phase 04 implementation is underway. **Offline tests require no API key; actual LLM extraction requires a configured API provider or an authenticated local CLI.**

## Quick start

**Requirements:** Node.js 24 and pnpm 10.28.2.

```sh
pnpm install --frozen-lockfile
```

If pnpm is not installed directly, Corepack can run the version pinned in `package.json`:

```sh
corepack pnpm install --frozen-lockfile
```

### 1. Configure a provider

Create a local `.env` file (which must remain uncommitted) and set the default Gemini API credential:

```dotenv
LLM_PROVIDER=gemini
LLM_API_KEY=your_api_key
# LLM_MODEL=gemini-3.6-flash
```

You can also use an authenticated `claude` or `agy` CLI without `LLM_API_KEY`. See [Provider configuration](#provider-configuration).

### 2. Process broker messages

```sh
pnpm --silent run cli process test/fixtures/fixture-a-valid.jsonl
```

The CLI writes machine-readable JSONL to **stdout**. For a human-readable table with review explanations:

```sh
pnpm --silent run cli process test/fixtures/fixture-a-valid.jsonl --format=table
```

### 3. Run tests (offline)

```sh
pnpm test
```

The test suite uses mocked model responses: **no network access or LLM credentials are needed**. Additional verification commands:

```sh
pnpm run typecheck
pnpm run build
```

### 4. Start the HTTP service

```sh
pnpm start
```

This builds the application, applies committed SQLite migrations, and starts the server on port `3000` by default (`PORT` overrides the port):

- `GET /health` returns `{ "status": "ok" }`.
- `POST /messages` validates one JSON message (`id`, `sender`, `received_at`, `text`), runs the shared processor, and atomically persists the result snapshot and ordered listings in SQLite (`200` on new success or exact replay, `400` `invalid_input`, `409` `message_conflict`, `502` `invalid_extraction`, `503` `provider_unavailable`, `504` `provider_timeout`, `500` `internal_error`).

```sh
curl -sS -X POST http://localhost:3000/messages \
  -H 'content-type: application/json' \
  -d '{"id":"m-001","sender":"+966551234567","received_at":"2026-11-01T09:12:00+03:00","text":"For sale: Villa in Riyadh. Asking 3.2M SAR."}'
```

`GET /listings?needs_review=true|false` returns persisted listings in stable ingestion and offer order; omit the filter to return all listings. The approval endpoint accepts an empty body or an optional note:

```sh
curl -sS -X POST http://localhost:3000/listings/LISTING_ID/approve

curl -sS -X POST http://localhost:3000/listings/LISTING_ID/approve \
  -H 'content-type: application/json' \
  -d '{"note":"Reviewed the incomplete details and accepted the listing as-is."}'
```

Approval accepts the current extracted listing without editing its fields or review reasons, then sets its current `needs_review` flag to `false`. Notes are trimmed, optional, and limited to 1,000 characters. `GET /listings` and approval responses include the stored `approval_note` (`null` when absent); ingestion and CLI schemas remain unchanged. Repeated approval retains the first timestamp and note. Invalid approval bodies return `400 invalid_input`; an unknown listing returns `404 listing_not_found`; a listing that never needed review returns `409 approval_conflict`. Exact message replay still returns the original ingestion snapshot and original review flag. The CLI processes each JSONL input without applying migrations or storing results. Use `pnpm run db:migrate` to author a migration and `pnpm run db:deploy` to apply committed migrations separately.

#### Bruno API collection

An offline-ready [Bruno](https://www.usebruno.com/) collection is included in [`bruno/`](bruno/) for interactive HTTP testing against the running server:

1. Start the HTTP server with `pnpm start`.
2. In Bruno, open the [`bruno/`](bruno/) directory as a collection and select the [`local`](bruno/environments/local.bru) environment (`baseUrl: http://localhost:3000`).
3. Run [`01-health.bru`](bruno/01-health.bru), the sample ingestion/replay/error requests in [`bruno/messages/`](bruno/messages/), or the listing filter and approval requests in [`bruno/listings/`](bruno/listings/).
   - [`01-ingest-english-villa.bru`](bruno/messages/01-ingest-english-villa.bru), [`03-ingest-multi-offer-rental.bru`](bruno/messages/03-ingest-multi-offer-rental.bru), [`04-ingest-mixed-intent.bru`](bruno/messages/04-ingest-mixed-intent.bru), and [`01-list-all.bru`](bruno/listings/01-list-all.bru) capture `cleanListingId`, `noteListingId`, and `listingId` after a successful response for downstream listing and approval requests.
   - [`06-approve-listing-with-note.bru`](bruno/listings/06-approve-listing-with-note.bru), [`07-approve-invalid-extra-field.bru`](bruno/listings/07-approve-invalid-extra-field.bru), and [`08-approve-malformed-json.bru`](bruno/listings/08-approve-malformed-json.bru) exercise optional approval notes and `400 invalid_input` error handling, while [`12-replay-mixed-after-approval.bru`](bruno/messages/12-replay-mixed-after-approval.bru) checks that replay retains the original ingestion snapshot.

### 5. Run the live evaluation (optional)

With an authenticated local `agy` installation, run the frozen 20-case evaluation corpus:

```sh
LLM_PROVIDER=agy LLM_MODEL=gemini-3.8-flash-low \
  pnpm ts-node scripts/evaluate.ts \
  --cases test/evaluation/cases.jsonl \
  --expected test/evaluation/expected.json \
  --output-dir evaluation-results/post-fix
```

See [Evaluation and quality](#evaluation-and-quality) for prerequisites, results, and offline re-scoring of saved output.

## What works today

| Capability | Status |
| --- | --- |
| JSONL CLI extraction and JSONL output | Implemented |
| Human-readable CLI table output | Implemented |
| Message classification and mixed-intent detection | Implemented |
| Multiple listing offers per message | Implemented |
| Arabic/English extraction and normalization | Implemented |
| Missing, uncertain, or unsupported value review reasons | Implemented |
| LLM gateway validation and error handling | Implemented |
| Offline automated tests | Implemented |
| `GET /health` | Implemented |
| SQLite message & listing persistence (HTTP) | Implemented (Tasks 04.1–04.2) |
| `POST /messages` (ingestion, replay, conflicts) | Implemented (Task 04.3) |
| `GET /listings` with current `approval_note` | Implemented (Task 04.4) |
| `POST /listings/{id}/approve` with optional note | Implemented (Task 04.5) |
| Cross-broker duplicate detection | Planned — Phase 05 |

The primary rule is **never invent listing data**. Missing or insufficiently supported values remain `null` and are flagged for review instead of being guessed. An LLM response is treated as untrusted input, not accepted as an authoritative record.

### Processing approach

1. **Classify and segment:** identify the message's intents and individual property offers.
2. **Extract candidates:** request structured values from the configured model gateway.
3. **Validate and resolve:** enforce strict output schemas, normalize supported values, and reject unsupported or malformed candidates.
4. **Flag for review:** expose machine-readable review reasons and human-readable explanations in table mode.
5. **Emit results:** produce contract-compliant JSONL in the same order as the input messages.

The extraction pathway makes a single model request per message. Provider-level behavior, including internal CLI retries, can still affect latency and token use. See [`src/extraction/`](src/extraction/) and [`src/llm-gateway/`](src/llm-gateway/) for implementation details.

## Provider configuration

The application validates environment variables using Zod in [`src/config/env.ts`](src/config/env.ts). Blank or whitespace-only values are treated as unset so defaults can apply.

| `LLM_PROVIDER` | Connection | Authentication | Model | Verification status |
| --- | --- | --- | --- | --- |
| `gemini` (default) | Direct API | `LLM_API_KEY` | `gemini-3.6-flash` by default | Live CLI check passed |
| `anthropic` | Direct API | `LLM_API_KEY` | `LLM_MODEL` required | Offline mocked tests; live check pending |
| `openai` | Direct API | `LLM_API_KEY` | `LLM_MODEL` required | Offline mocked tests; live check pending |
| `claude-cli` (`claude`) | Local Claude Code CLI | Local OAuth or `ANTHROPIC_API_KEY` | CLI default or optional override | Offline mocked tests; live check pending |
| `agy` (`antigravity`) | Local Antigravity CLI | Local OAuth | CLI default or optional override | Live 20-case Phase 03 evaluation |

Direct API requests use [`AiSdkGateway`](src/llm-gateway/ai-sdk.gateway.ts) with native JSON-schema constraints, no tools, and `maxRetries: 0`. The Claude CLI gateway requests structured output and disables tools, MCP discovery, slash commands, and session persistence; the Antigravity gateway uses its sandbox and schema options. See the gateway sources for the exact subprocess settings.

### Example provider overrides

```sh
# Gemini API (default model)
LLM_PROVIDER=gemini LLM_API_KEY=your_key pnpm --silent run cli process test/fixtures/fixture-a-valid.jsonl

# Anthropic API
LLM_PROVIDER=anthropic LLM_MODEL=claude-sonnet-4-6 LLM_API_KEY=your_key pnpm --silent run cli process test/fixtures/fixture-a-valid.jsonl

# OpenAI API
LLM_PROVIDER=openai LLM_MODEL=gpt-4.1-mini LLM_API_KEY=your_key pnpm --silent run cli process test/fixtures/fixture-a-valid.jsonl

# Locally authenticated Claude CLI
LLM_PROVIDER=claude-cli pnpm --silent run cli process test/fixtures/one-message.jsonl

# Locally authenticated Antigravity CLI
LLM_PROVIDER=agy pnpm --silent run cli process test/fixtures/one-message.jsonl
```

**Local CLI authentication:** `claude-cli` requires an installed `claude` executable and an authenticated session (`claude` then `/login`, or `ANTHROPIC_API_KEY`). `agy` requires an installed and authenticated `agy` executable. Both ignore `LLM_API_KEY`, allowing provider switches without forwarding an API credential to those subprocesses. Set `CLAUDE_EXECUTABLE` or `AGY_EXECUTABLE` if the executable cannot be found automatically.

The Claude CLI gateway passes the broker message through stdin, runs in a temporary working directory, and maps failed processes or invalid responses to provider errors. Timeouts are terminated; structured-output failures are passed to downstream validation. See [`claude-cli.gateway.ts`](src/llm-gateway/claude-cli.gateway.ts) and [`agy.gateway.ts`](src/llm-gateway/agy.gateway.ts).

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port (1–65535) |
| `DATABASE_URL` | `file:./dev.db` | SQLite database connection |
| `LLM_PROVIDER` | `gemini` | API or local CLI gateway |
| `LLM_MODEL` | `gemini-3.6-flash` for Gemini; otherwise provider-dependent | Model identifier; required for direct Anthropic/OpenAI |
| `LLM_API_KEY` | Unset | Required by direct API providers; ignored by local CLI gateways |
| `LLM_TIMEOUT_MS` | `45000` | Model request / subprocess timeout in milliseconds |
| `CLAUDE_EXECUTABLE` | Discovered local executable or `claude` | Override Claude CLI path |
| `AGY_EXECUTABLE` | Discovered local executable or `agy` | Override Antigravity CLI path |
| `DWELLEO_TELEMETRY` | Unset | Set to `1` for JSON diagnostics on stderr |

## Evaluation and quality

On **November 10, 2026**, Phase 03 evaluated the public CLI against **20 independently authored synthetic Saudi real-estate messages**: 8 Arabic, 6 English, and 6 mixed-language. The fixed corpus contained 16 expected offers across 14 listing/mixed messages, plus 2 buyer requests, 2 projects, and 2 irrelevant messages.

The evaluation used `agy` CLI `1.5.3` with `gemini-3.8-flash-low`. A schema-description fix in [`src/extraction/domain-prompt.ts`](src/extraction/domain-prompt.ts) aligned candidate key descriptions with `stage1GatewayWireSchema` without changing strict downstream validation or expected labels.

| Metric | Before schema-description fix | After fix |
| --- | ---: | ---: |
| Classification accuracy | 20/20 (100%) | **20/20 (100%)** |
| Detected-class accuracy | 20/20 (100%) | **20/20 (100%)** |
| Offer-count accuracy | 20/20 (100%) | **20/20 (100%)** |
| Applicable-field accuracy | 137/171 (80.1%) | **169/171 (98.8%)** |
| Unsupported-value acceptance | 0/26 (0%) | **0/26 (0%)** |
| Supported-value omission | 34/150 (22.7%) | **2/150 (1.3%)** |
| Review precision | 12/16 (75%) | **12/13 (92.3%)** |
| Review recall | 12/12 (100%) | **12/12 (100%)** |
| Mean gateway latency | 10,758.5 ms | **6,804.4 ms** |
| Median gateway latency | 11,637.3 ms | **4,929.8 ms** |

**What changed:** The initial `agy` outputs sometimes placed `role` inside `price.value` and `kind` inside `area_sqm.value`. Strict validation correctly rejected those malformed candidates, but valid prices and areas were consequently omitted. Clarifying the candidate schema descriptions reduced supported-value omissions from 34 to 2 without loosening validation.

**Remaining errors:** Two synthetic phone numbers were flagged uncertain; two price-related cases produced review reasons different from the expected labels, while retaining `price.amount: null` and `needs_review: true`. Detailed case-level results and the baseline/post-fix comparison are in [`docs/evaluation-baseline-analysis.md`](docs/evaluation-baseline-analysis.md).

**Limit of evidence:** These figures describe this frozen 20-case synthetic corpus. They are **not** estimates of production accuracy or hidden-test performance. Direct Anthropic/OpenAI and Claude CLI live evaluations remain pending.

### Reproduce the evaluation

```sh
LLM_PROVIDER=agy LLM_MODEL=gemini-3.8-flash-low \
  pnpm ts-node scripts/evaluate.ts \
  --cases test/evaluation/cases.jsonl \
  --expected test/evaluation/expected.json \
  --output-dir evaluation-results/post-fix
```

This command requires a working, authenticated `agy` installation. The evaluator also accepts `--actual <path.jsonl>` to re-score previously saved CLI output **offline without model calls**.

Recorded verification (November 10, 2026): `pnpm test` passed **228/228 tests across 20 suites** without an API key; type checking and build passed; the post-fix evaluation scored 20/20 cases with zero provider failures.

## Per-message cost and latency

Each processed message requests one model extraction; its billable usage depends on the selected transport, model, and provider. Enable telemetry to inspect provider/model, request duration, token usage, and errors **per message**:

```sh
DWELLEO_TELEMETRY=1 pnpm --silent run cli process test/fixtures/one-message.jsonl
```

Telemetry goes to **stderr**, preserving machine-readable JSONL on stdout. The evaluation runner captures it separately in `evaluation-results/telemetry.jsonl`.

In the post-fix 20-case `agy` evaluation:

| Measurement | Observed |
| --- | ---: |
| Mean / median gateway request | 6,804.4 ms / 4,929.8 ms per message |
| Gateway request range | 1,855.3–21,304.5 ms |
| Total input tokens | 330,563 (16,528.2 per message on average) |
| Total output tokens | 11,703 (585.1 per message on average) |
| USD cost | **Not available for the evaluated OAuth-backed `agy` model** |

The durations cover the provider call, including any internal `agy` retries; they exclude approximately 1 second of one-time CLI startup and less than 1 millisecond of downstream resolution/review. The `agy` CLI injects agent context (approximately 10,000–33,000 input tokens per call), and output tokens include reasoning tokens. The tested `gemini-3.8-flash-low` transport uses OAuth quota without a published USD rate card, so no dollar cost is inferred.

**For direct API providers**, estimate per-message API cost by multiplying *actual input and output token counts* by the selected model's published per-token rates. This README does not claim a fixed dollar price because model rates and message usage vary. Local CLI OAuth usage also must not be represented as a zero-cost or guaranteed-offline service.

## Known limitations

- **No offline inference mode:** offline tests and rescoring work without credentials; fresh extraction still requires a reachable API or authenticated CLI that may use remote models.
- **Approval does not correct extracted fields:** it records a human decision and optional context; field edits, reviewer identity, approval history, rejection, and undo are not available.
- **Approval timestamps remain internal:** listing reads and approval responses expose `approval_note`, while message and CLI output do not expose approval metadata.
- **No cross-broker deduplication yet:** duplicate detection remains a Phase 05 responsibility.
- **Model/provider variability:** the evaluation figures are specific to one model, CLI version, and corpus; other providers are not equally live-qualified.
- **Uncertain data remains reviewable:** incorrect or incomplete evidence may yield `null` values and review reasons instead of authoritative listing fields.

## Gaps

- **Approval notes cannot be revised:** repeated `POST /listings/{id}/approve` requests return the first approved state and ignore a different note. There is no endpoint to amend an approval decision or its note.

## Next steps

**With another day:** finish Phase 04 close-out verification; then implement Phase 05 cross-broker deduplication and qualify the default direct Gemini API against the evaluation cases.

For deeper project context, see the [documentation index](docs/README.md), [roadmap](docs/roadmap.md), and [evaluation analysis](docs/evaluation-baseline-analysis.md).
